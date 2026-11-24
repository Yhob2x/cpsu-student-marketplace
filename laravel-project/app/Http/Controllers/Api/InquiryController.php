<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Handoff;
use App\Models\InquiryMessage;
use App\Models\InquiryPreference;
use App\Models\InquiryThread;
use App\Models\Listing;
use App\Models\Notification;
use App\Models\Transaction;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use App\Support\Tx;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class InquiryController extends Controller
{
    private const MAX_ID = 2147483647;

    private const TYPING_MS = 5000;

    private const PRESENCE_MS = 25000;

    private const MESSAGE_TYPES = ['inquiry.new', 'inquiry.reply'];

    private const HANDOFF_METHODS = ['campus_pickup', 'scheduled_meeting', 'seller_delivery', 'off_campus', 'digital_delivery', 'appointment'];

    private const HANDOFF_STATUSES = ['proposed', 'agreed', 'completed', 'cancelled', 'not_confirmed'];

    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);
        $input = ApiQuery::all($request);
        $limit = ApiQuery::int($input, 'limit', null, 1, 50);
        $beforeId = ApiQuery::int($input, 'beforeId', null, 1, self::MAX_ID);
        if ($beforeId !== null && $limit === null) {
            throw ApiInput::invalid('beforeId', 'beforeId requires limit', 'custom');
        }

        $query = $this->participantThreads($userId)
            ->whereDoesntHave('preferences', fn ($preference) => $preference->where('userId', $userId)->where('hidden', true))
            ->with([
                'listing:id,title',
                'buyer:id,displayName',
                'seller.owner:id,displayName,status',
                'messages' => fn ($message) => $message->orderByDesc('createdAt')->orderByDesc('id')->limit(1),
                'preferences' => fn ($preference) => $preference->where('userId', $userId),
            ]);
        if ($limit !== null) {
            if ($beforeId !== null) {
                $query->where('id', '<', $beforeId);
            }
            $query->orderByDesc('id')->limit($limit + 1);
        } else {
            $query->orderByDesc('createdAt')->orderBy('id');
        }
        $rows = $query->get();

        // A thread stays unread while any incoming message is unseen.
        $unread = $rows->isEmpty() ? collect() : InquiryMessage::query()->toBase()->selectRaw('threadId, COUNT(*) AS total')
            ->whereIn('threadId', $rows->pluck('id'))->where('authorUserId', '!=', $userId)->whereNull('seenAt')
            ->groupBy('threadId')->pluck('total', 'threadId');

        $items = $rows->map(function ($thread) use ($userId, $unread) {
            $last = $thread->messages->first();

            return [
                'id' => $thread->id,
                'status' => $thread->status->value,
                'listing' => ['id' => $thread->listing->id, 'title' => $thread->listing->title],
                'muted' => $thread->preferences->first()?->muted ?? false,
                'unreadCount' => (int) ($unread[$thread->id] ?? 0),
                'otherStudentName' => $thread->buyerUserId === $userId ? $thread->seller->owner->displayName : $thread->buyer->displayName,
                'lastMessage' => $last ? $last->toArray() + ['mine' => $last->authorUserId === $userId, 'receipt' => $this->receipt($last)] : null,
                'role' => $thread->buyerUserId === $userId ? 'buyer' : 'seller',
            ];
        });

        if ($limit === null) {
            return ApiResponse::json($items->all());
        }

        $page = $items->take($limit)->values();
        $hasMore = $rows->count() > $limit;

        return ApiResponse::json(['items' => $page->all(), 'hasMore' => $hasMore, 'nextBeforeId' => $hasMore ? $rows->take($limit)->last()?->id : null]);
    }

    public function create(Request $request): JsonResponse
    {
        $body = ApiInput::object($request);
        $listingId = ApiInput::integer($body, 'listingId');
        $text = ApiInput::string($body, 'body', 1, 1000, true);
        $userId = $this->userId($request);

        $listing = ListingAccess::publicListing(Listing::query()->whereKey($listingId))->with('seller:id,ownerUserId')->first(['id', 'title', 'sellerProfileId', 'availabilityState']);
        if ($listing === null) {
            throw new ApiError(404, 'not_found');
        }
        if ($listing->seller->ownerUserId === $userId) {
            throw new ApiError(400, 'own_listing');
        }
        if ($listing->availabilityState->value !== 'available') {
            throw new ApiError(409, 'listing_unavailable');
        }

        // Looks up first, because INSERT IGNORE would consume an id on every repeat inquiry.
        $thread = InquiryThread::query()->firstOrCreate(['listingId' => $listing->id, 'buyerUserId' => $userId], ['sellerProfileId' => $listing->sellerProfileId])->fresh();
        if ($thread->status->value !== 'open') {
            throw new ApiError(409, 'thread_closed');
        }

        $message = Tx::serializable(fn () => $this->appendMessage($thread->id, $userId, $text));
        $this->notifyUnlessMuted($listing->seller->ownerUserId, $thread->id, 'inquiry.new', $message->id, $listing->title);

        return ApiResponse::json(['id' => $thread->id], 201);
    }

    public function messages(Request $request, string $id): JsonResponse
    {
        $threadId = ApiInput::positiveId($id, 'id', self::MAX_ID);
        $input = ApiQuery::all($request);
        $limit = ApiQuery::int($input, 'limit', null, 1, 100);
        $beforeId = ApiQuery::int($input, 'beforeId', null, 1, self::MAX_ID);
        if ($beforeId !== null && $limit === null) {
            throw ApiInput::invalid('beforeId', 'beforeId requires limit', 'custom');
        }

        $userId = $this->userId($request);
        $thread = $this->participantThread($userId, $threadId);
        $deliveredAt = Carbon::now('UTC');
        $stamp = $deliveredAt->format('Y-m-d H:i:s.v');
        $hasEarlier = null;

        if ($limit !== null) {
            $rows = InquiryMessage::query()->where('threadId', $thread->id)
                ->when($beforeId !== null, fn ($query) => $query->where('id', '<', $beforeId))
                ->with('author:id,displayName')->orderByDesc('id')->limit($limit + 1)->get();
            $hasEarlier = $rows->count() > $limit;
            $messages = $rows->take($limit)->reverse()->values();

            // A delivery receipt is recorded only for messages this client actually fetched.
            $ids = $messages->filter(fn ($message) => $message->authorUserId !== $userId && $message->deliveredAt === null)->pluck('id')->all();
            if ($ids !== []) {
                InquiryMessage::query()->where('threadId', $thread->id)->whereIn('id', $ids)->where('authorUserId', '!=', $userId)
                    ->whereNull('deliveredAt')->update(['deliveredAt' => $stamp]);
                $messages->each(function ($message) use ($ids, $deliveredAt) {
                    if (in_array($message->id, $ids, true)) {
                        $message->deliveredAt = $deliveredAt;
                    }
                });
            }
        } else {
            InquiryMessage::query()->where('threadId', $thread->id)->where('authorUserId', '!=', $userId)->whereNull('deliveredAt')->update(['deliveredAt' => $stamp]);
            $messages = InquiryMessage::query()->where('threadId', $thread->id)->with('author:id,displayName')->orderBy('createdAt')->orderBy('id')->get();
        }

        $handoff = Handoff::query()->where('inquiryThreadId', $thread->id)->first();
        $transaction = Transaction::query()->where('inquiryThreadId', $thread->id)
            ->where(fn ($query) => $query->where('buyerUserId', $userId)->orWhere('sellerUserId', $userId))
            ->orderByDesc('id')->first(['id', 'status', 'buyerMeetupConfirmedAt', 'sellerMeetupConfirmedAt', 'buyerCompletionConfirmedAt', 'sellerCompletionConfirmedAt']);

        $listing = $thread->listing;
        $other = $thread->buyerUserId === $userId ? $thread->seller->ownerUserId : $thread->buyerUserId;
        $visible = $listing->status->value === 'published' && $listing->deletedAt === null
            && $thread->seller->approvalStatus->value === 'approved' && $thread->seller->owner->status->value === 'active';
        $lead = $visible ? $listing->media->sortBy([['position', 'asc'], ['id', 'asc']])->first() : null;
        $open = $thread->status->value === 'open';

        return ApiResponse::json([
            'thread' => [
                'id' => $thread->id,
                'status' => $thread->status->value,
                'listingId' => $thread->listingId,
                'otherStudentName' => $thread->buyerUserId === $userId ? $thread->seller->owner->displayName : $thread->buyer->displayName,
            ],
            'listing' => [
                'id' => $listing->id,
                'title' => $listing->title,
                'type' => $listing->type->value,
                'price' => (float) $listing->price,
                'priceBasis' => $listing->priceBasis,
                'condition' => $listing->condition?->value,
                'availability' => $visible ? $listing->availabilityState->value : 'unavailable',
                'imageUrl' => $lead ? "/api/v1/media/{$lead->id}" : null,
            ],
            'messages' => $messages->map(fn ($message) => [
                'id' => $message->id,
                'body' => $message->body,
                'createdAt' => ApiResponse::date($message->createdAt),
                'mine' => $message->authorUserId === $userId,
                'author' => $message->author->displayName,
                'receipt' => $this->receipt($message),
                'seenAt' => ApiResponse::date($message->seenAt),
            ])->all(),
            'handoff' => $handoff?->toArray(),
            'transaction' => $transaction?->toArray(),
        ] + ($hasEarlier !== null ? ['hasEarlier' => $hasEarlier] : []) + [
            // Never disclose stale heartbeats for a closed thread.
            'typing' => $open && $this->active('typing', $thread->id, $other),
            'otherActiveInChat' => $open && $this->active('presence', $thread->id, $other),
            'muted' => $this->muted($userId, $thread->id),
        ]);
    }

    public function presence(Request $request, string $id): Response
    {
        return $this->heartbeat($request, $id, 'presence', self::PRESENCE_MS);
    }

    public function typing(Request $request, string $id): Response
    {
        return $this->heartbeat($request, $id, 'typing', self::TYPING_MS);
    }

    /** The upper bound keeps messages further down the thread unread. */
    public function seen(Request $request, string $id): Response
    {
        $userId = $this->userId($request);
        $thread = $this->participantThread($userId, ApiInput::routeInt($id));
        $upToId = ApiInput::positiveInteger(ApiInput::object($request), 'upToId');
        $now = ListingAccess::now();
        $incoming = fn () => InquiryMessage::query()->where('threadId', $thread->id)->where('authorUserId', '!=', $userId)->where('id', '<=', $upToId);
        $incoming()->whereNull('deliveredAt')->update(['deliveredAt' => $now]);
        $incoming()->whereNull('seenAt')->update(['seenAt' => $now]);

        // Clear only notices for messages that were actually visible.
        $pending = Notification::query()->where('userId', $userId)->whereNull('readAt')->whereIn('type', self::MESSAGE_TYPES)
            ->orderByDesc('createdAt')->limit(200)->get(['id', 'payload']);
        $readIds = $pending->filter(function ($notice) use ($thread, $upToId) {
            $payload = $notice->payload;

            return is_array($payload) && ($payload['threadId'] ?? null) === $thread->id
                && (is_int($payload['messageId'] ?? null) || is_float($payload['messageId'] ?? null)) && $payload['messageId'] <= $upToId;
        })->pluck('id')->all();
        if ($readIds !== []) {
            Notification::query()->where('userId', $userId)->whereIn('id', $readIds)->whereNull('readAt')->update(['readAt' => $now]);
        }

        return response()->noContent();
    }

    public function send(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $thread = $this->participantThread($userId, ApiInput::routeInt($id));
        if ($thread->status->value !== 'open') {
            throw new ApiError(409, 'thread_closed');
        }
        if ($thread->seller->owner->status->value !== 'active') {
            throw new ApiError(409, 'seller_unavailable');
        }

        $text = ApiInput::string(ApiInput::object($request), 'body', 1, 1000, true);
        $message = Tx::serializable(fn () => $this->appendMessage($thread->id, $userId, $text));
        $other = $thread->buyerUserId === $userId ? $thread->seller->ownerUserId : $thread->buyerUserId;
        $this->notifyUnlessMuted($other, $thread->id, 'inquiry.reply', $message->id, $thread->listing->title);

        return ApiResponse::json(['id' => $message->id], 201);
    }

    public function preferences(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $threadId = ApiInput::positiveId($id, 'id', self::MAX_ID);
        $this->participantThread($userId, $threadId);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['muted']);
        $muted = ApiInput::boolean($body, 'muted');
        DB::table('InquiryPreference')->upsert([['threadId' => $threadId, 'userId' => $userId, 'muted' => $muted]], ['threadId', 'userId'], ['muted']);

        return ApiResponse::json(['muted' => $this->muted($userId, $threadId)]);
    }

    /** Hides only from this student's inbox. Messages and transactions are preserved. */
    public function hide(Request $request, string $id): Response
    {
        $userId = $this->userId($request);
        $threadId = ApiInput::positiveId($id, 'id', self::MAX_ID);
        $this->participantThread($userId, $threadId);

        DB::transaction(function () use ($threadId, $userId) {
            DB::table('InquiryPreference')->upsert([['threadId' => $threadId, 'userId' => $userId, 'hidden' => true]], ['threadId', 'userId'], ['hidden']);
            // Clear alert badges without claiming unseen messages were read.
            Notification::query()->where('userId', $userId)->whereNull('readAt')->whereIn('type', self::MESSAGE_TYPES)
                ->whereRaw("JSON_EXTRACT(`payload`, '$.threadId') = ?", [$threadId])->update(['readAt' => ListingAccess::now()]);
        });

        return response()->noContent();
    }

    public function close(Request $request, string $id): Response
    {
        $userId = $this->userId($request);
        $thread = $this->participantThread($userId, ApiInput::positiveId($id));

        Tx::serializable(function () use ($thread, $userId) {
            $current = InquiryThread::query()->find($thread->id, ['id', 'status']);
            if ($current === null) {
                throw new ApiError(404, 'not_found');
            }
            if ($current->status->value === 'closed') {
                return;
            }
            InquiryThread::query()->whereKey($thread->id)->update(['status' => 'closed']);
            AuditLog::create(['actorUserId' => $userId, 'action' => 'inquiry.closed', 'targetType' => 'inquiry_thread', 'targetId' => $thread->id]);
        });

        foreach ([$thread->buyerUserId, $thread->seller->ownerUserId] as $participant) {
            Cache::forget($this->activityKey('typing', $thread->id, $participant));
            Cache::forget($this->activityKey('presence', $thread->id, $participant));
        }

        return response()->noContent();
    }

    /** Outcomes here are self-reported and are not verified sales. */
    public function handoff(Request $request, string $id): JsonResponse
    {
        $thread = $this->participantThread($this->userId($request), ApiInput::routeInt($id));
        $body = ApiInput::object($request);
        $data = [
            'method' => ApiInput::enum($body, 'method', self::HANDOFF_METHODS),
            'timeWindow' => ApiInput::string($body, 'timeWindow', null, 80),
            'generalLocation' => ApiInput::string($body, 'generalLocation', null, 120),
            'status' => array_key_exists('status', $body) ? ApiInput::enum($body, 'status', self::HANDOFF_STATUSES) : 'proposed',
        ];

        $handoff = DB::transaction(function () use ($thread, $data) {
            $latest = Transaction::query()->where('inquiryThreadId', $thread->id)->orderByDesc('id')->first(['id']);
            $confirmed = null;
            if ($latest !== null) {
                // Serializes with confirm-meetup, even for this older route.
                Transaction::query()->whereKey($latest->id)->update(['updatedAt' => ListingAccess::now()]);
                $confirmed = Transaction::query()->find($latest->id, ['id', 'buyerMeetupConfirmedAt', 'sellerMeetupConfirmedAt']);
            }

            $existing = Handoff::query()->where('inquiryThreadId', $thread->id)->first();
            $changed = $existing === null || $existing->generalLocation !== $data['generalLocation']
                || $existing->timeWindow !== $data['timeWindow'] || $existing->method->value !== $data['method'];
            if ($changed && ($confirmed?->buyerMeetupConfirmedAt || $confirmed?->sellerMeetupConfirmedAt)) {
                throw new ApiError(409, 'meetup_location_locked');
            }

            return Handoff::query()->updateOrCreate(['inquiryThreadId' => $thread->id], $data)->fresh();
        });

        return ApiResponse::json($handoff->toArray());
    }

    private function userId(Request $request): int
    {
        return $request->attributes->get('authUser')->id;
    }

    private function participantThreads(int $userId)
    {
        return InquiryThread::query()->where(fn ($query) => $query->where('buyerUserId', $userId)
            ->orWhereHas('seller', fn ($seller) => $seller->where('ownerUserId', $userId)));
    }

    private function participantThread(int $userId, int $id): InquiryThread
    {
        $thread = $this->participantThreads($userId)->whereKey($id)->with([
            'seller.owner:id,displayName,status',
            'buyer:id,displayName',
            'listing:id,title,type,price,priceBasis,condition,availabilityState,status,deletedAt',
            'listing.media:id,listingId,position',
        ])->first();
        if ($thread === null) {
            throw new ApiError(404, 'not_found');
        }

        return $thread;
    }

    /** A receipt reflects observed server activity, not an assumed delivery or view. */
    private function receipt(InquiryMessage $message): string
    {
        return $message->seenAt ? 'read' : ($message->deliveredAt ? 'delivered' : 'sent');
    }

    private function appendMessage(int $threadId, int $authorId, string $body): InquiryMessage
    {
        $thread = InquiryThread::query()->find($threadId, ['id', 'status']);
        if ($thread === null || $thread->status->value !== 'open') {
            throw new ApiError(409, 'thread_closed');
        }

        $message = InquiryMessage::create(['threadId' => $threadId, 'authorUserId' => $authorId, 'body' => $body]);
        // An incoming message brings a removed conversation back to the inbox.
        InquiryPreference::query()->where('threadId', $threadId)->where('hidden', true)->update(['hidden' => false]);

        return $message;
    }

    private function muted(int $userId, int $threadId): bool
    {
        return InquiryPreference::query()->where('threadId', $threadId)->where('userId', $userId)->value('muted') == true;
    }

    private function notifyUnlessMuted(int $recipient, int $threadId, string $type, int $messageId, string $title): void
    {
        if (! $this->muted($recipient, $threadId)) {
            Notification::create(['userId' => $recipient, 'type' => $type, 'payload' => ['threadId' => $threadId, 'messageId' => $messageId, 'listingTitle' => $title]]);
        }
    }

    private function heartbeat(Request $request, string $id, string $kind, int $milliseconds): Response
    {
        $userId = $this->userId($request);
        $thread = $this->participantThread($userId, ApiInput::routeInt($id));
        if ($thread->status->value !== 'open') {
            throw new ApiError(409, 'thread_closed');
        }

        Cache::put($this->activityKey($kind, $thread->id, $userId), (int) (microtime(true) * 1000) + $milliseconds, (int) ceil($milliseconds / 1000) + 1);

        return response()->noContent();
    }

    private function active(string $kind, int $threadId, int $userId): bool
    {
        return (int) Cache::get($this->activityKey($kind, $threadId, $userId), 0) > (int) (microtime(true) * 1000);
    }

    private function activityKey(string $kind, int $threadId, int $userId): string
    {
        return "chat:{$kind}:{$threadId}:{$userId}";
    }
}
