<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\PushAttempt;
use App\Models\PushOutbox;
use App\Models\PushPreference;
use App\Models\PushSubscription;
use App\Models\InquiryPreference;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class PushDelivery
{
    public function __construct(private readonly PushPolicy $policy, private readonly PushTransport $transport) {}

    public static function category(string $type): ?string
    {
        if (in_array($type, ['inquiry.new', 'inquiry.reply'], true)) return 'messages';
        if (in_array($type, ['listing.decision', 'listing.suspended'], true)) return 'listingReviews';
        if (in_array($type, ['affiliation.decision', 'account.status', 'store.new_listing'], true) || str_starts_with($type, 'transaction.')) return 'accountUpdates';
        return null;
    }

    public function enqueue(Notification $notice): void
    {
        $category = self::category($notice->type);
        if (! $this->policy->deliveryEnabled() || $category === null) return;
        $now = Carbon::now('UTC');
        PushOutbox::query()->firstOrCreate(['notificationId' => $notice->id], [
            'userId' => $notice->userId, 'category' => $category, 'state' => 'pending',
            'nextAttemptAt' => $now, 'expiresAt' => $now->copy()->addMinutes(15),
        ]);
    }

    /** Bounded run. Expired claims are recoverable; all writes are fenced by lease token. */
    public function drain(): int
    {
        if (! $this->policy->deliveryEnabled()) return 0;
        $now = Carbon::now('UTC');
        PushOutbox::query()->whereIn('state', ['pending', 'leased'])->where(function ($q) use ($now) {
            $q->where('state', 'pending')->orWhere('leasedUntil', '<=', $now->format('Y-m-d H:i:s.v'));
        })->where(function ($q) use ($now) {
            $q->where('expiresAt', '<=', $now->format('Y-m-d H:i:s.v'))->orWhere('attemptCount', '>=', 5);
        })->update(['state' => 'failed', 'leaseToken' => null, 'leasedUntil' => null, 'lastStatus' => 'expired_or_exhausted']);
        $eligible = fn () => PushOutbox::query()->where('expiresAt', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))
            ->where('attemptCount', '<', 5)->where('nextAttemptAt', '<=', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))
            ->where(fn ($q) => $q->where('state', 'pending')->orWhere(fn ($q) => $q->where('state', 'leased')->where('leasedUntil', '<=', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))));
        $count = 0;
        foreach ($eligible()->orderBy('id')->limit(8)->pluck('id') as $id) {
            $lease = Str::random(48);
            if ($eligible()->whereKey($id)->update(['state' => 'leased', 'leaseToken' => $lease,
                'leasedUntil' => Carbon::now('UTC')->addSeconds(120), 'attemptCount' => DB::raw('attemptCount + 1')]) !== 1) continue;
            $job = PushOutbox::query()->whereKey($id)->where('leaseToken', $lease)->firstOrFail();
            $this->deliver($job, $lease);
            $count++;
        }
        return $count;
    }

    private function allowed(PushOutbox $job): bool
    {
        if (! $this->policy->deliveryEnabled()) return false;
        $notice = Notification::query()->whereKey($job->notificationId)->where('userId', $job->userId)->whereNull('readAt')->first();
        if (! $notice || self::category($notice->type) !== $job->category) return false;
        if (! User::query()->whereKey($job->userId)->where('status', 'active')->exists()) return false;
        $preference = PushPreference::find($job->userId);
        if ($preference && (! $preference->masterEnabled || ! $preference->{$job->category})) return false;
        if ($preference && $preference->quietStartMinute !== null && $preference->quietEndMinute !== null) {
            $now = Carbon::now('Asia/Manila');
            $minute = $now->hour * 60 + $now->minute;
            $start = $preference->quietStartMinute; $end = $preference->quietEndMinute;
            if ($start === $end || ($start < $end ? $minute >= $start && $minute < $end : $minute >= $start || $minute < $end)) return false;
        }
        if ($job->category === 'messages') {
            $thread = $notice->payload['threadId'] ?? null;
            if (! is_int($thread) || InquiryPreference::query()->where('userId', $job->userId)->where('threadId', $thread)->where('muted', true)->exists()) return false;
        }
        return true;
    }

    private function reserveBudget(PushOutbox $job, string $lease): bool
    {
        return DB::transaction(function () use ($job, $lease) {
            $current = PushOutbox::query()->whereKey($job->id)->where('leaseToken', $lease)->where('leasedUntil', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))->lockForUpdate()->first();
            if (! $current) return false;
            $now = Carbon::now('UTC');
            $day = $now->copy()->setTimezone('Asia/Manila')->toDateString();
            if ($current->budgetReservedAt) return $current->budgetReservedAt->copy()->setTimezone('Asia/Manila')->toDateString() === $day;
            DB::table('PushDailyBudget')->insertOrIgnore(['userId' => $job->userId, 'dayKey' => $day, 'count' => 0, 'createdAt' => $now, 'updatedAt' => $now]);
            $reserved = DB::table('PushDailyBudget')->where('userId', $job->userId)->where('dayKey', $day)->where('count', '<', 5)->increment('count', 1, ['updatedAt' => $now]);
            if ($reserved !== 1) return false;
            $current->update(['budgetReservedAt' => $now]);
            return true;
        });
    }

    private function deliver(PushOutbox $job, string $lease): void
    {
        $finish = function (string $state, string $status) use ($job, $lease) {
            $changes = ['state' => $state, 'lastStatus' => $status, 'leaseToken' => null, 'leasedUntil' => null];
            if ($state === 'pending') $changes['nextAttemptAt'] = Carbon::now('UTC')->addSeconds(min(300, 30 * (2 ** max(0, $job->attemptCount - 1))));
            if ($state === 'sent') $changes['sentAt'] = Carbon::now('UTC');
            PushOutbox::query()->whereKey($job->id)->where('leaseToken', $lease)->update($changes);
        };
        if (! $this->allowed($job)) { $finish('skipped', 'not_eligible'); return; }
        $devices = PushSubscription::query()->where('userId', $job->userId)
            ->where(fn ($q) => $q->whereNull('expiresAt')->orWhere('expiresAt', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v')))
            ->orderBy('id')->limit(8)->get();
        if ($devices->isEmpty() || ! $this->reserveBudget($job, $lease)) { $finish('skipped', 'no_device_or_budget'); return; }
        $retry = false;
        $sent = false;
        foreach ($devices as $candidate) {
            if (! $this->allowed($job)) break;
            if (! PushOutbox::query()->whereKey($job->id)->where('leaseToken', $lease)->where('leasedUntil', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))->where('expiresAt', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))->exists()) return;
            // Recheck current account ownership before each external send.
            $device = PushSubscription::query()->whereKey($candidate->id)->where('userId', $job->userId)->where('endpointHash', $candidate->endpointHash)
                ->where(fn ($q) => $q->whereNull('expiresAt')->orWhere('expiresAt', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v')))->first();
            if (! $device) continue;
            $attempt = PushAttempt::query()->firstOrCreate(['outboxId' => $job->id, 'endpointHash' => $device->endpointHash], ['state' => 'pending', 'nextAttemptAt' => Carbon::now('UTC')]);
            if ($attempt->state === 'sent') { $sent = true; continue; }
            if ($attempt->state === 'failed') continue;
            // Never expose message bodies, student names, identifiers or private listing details on the lock screen.
            $code = $this->transport->send($device, ['body' => 'You have a new marketplace update.', 'url' => '/notifications', 'tag' => 'cpsu-'.$job->notificationId]);
            $ok = $code >= 200 && $code < 300;
            $transient = $code === 408 || $code === 429 || $code >= 500;
            $sent = $sent || $ok;
            $retry = $retry || $transient;
            if (! PushOutbox::query()->whereKey($job->id)->where('leaseToken', $lease)->where('leasedUntil', '>', Carbon::now('UTC')->format('Y-m-d H:i:s.v'))->exists()) return;
            $attempt->update(['state' => $ok ? 'sent' : ($transient ? 'pending' : 'failed'), 'lastStatus' => (string) $code, 'attemptCount' => $attempt->attemptCount + 1]);
            if (in_array($code, [404, 410], true)) PushSubscription::query()->whereKey($device->id)->where('userId', $job->userId)->where('endpointHash', $device->endpointHash)->delete();
        }
        if ($retry && $job->attemptCount < 5 && $job->expiresAt->gt(Carbon::now('UTC')->addSeconds(30))) $finish('pending', 'retry');
        elseif ($sent) $finish('sent', 'accepted');
        else $finish('failed', 'not_delivered');
    }
}
