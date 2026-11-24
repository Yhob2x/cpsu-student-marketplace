<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Handoff;
use App\Models\InquiryThread;
use App\Models\Listing;
use App\Models\Notification;
use App\Models\Transaction;
use App\Models\TransactionStatusLog;
use App\Models\User;
use App\Services\ListingStock;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiQuery;
use App\Support\ApiResponse;
use App\Support\ListingAccess;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Self-reported, mutually confirmed student transactions. No payment is processed. */
class TransactionController extends Controller
{
    public function __construct(private readonly ListingStock $stock) {}

    public function create(Request $request): JsonResponse
    {
        $buyerId = $this->userId($request);
        $this->eligibleStudent($buyerId);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['listingId']);
        $listingId = ApiInput::positiveInteger($body, 'listingId');

        $listing = $this->sellableListing(Listing::query()->whereKey($listingId))->with('seller:id,ownerUserId')->first();
        if ($listing === null) {
            throw new ApiError(404, 'not_found');
        }
        if ($listing->seller->ownerUserId === $buyerId) {
            throw new ApiError(400, 'own_listing');
        }

        // Replays of the same request return the existing active order.
        $existing = $this->activeOrder($listingId, $buyerId);
        if ($existing !== null) {
            return ApiResponse::json($this->row($existing));
        }
        if ($listing->availabilityState->value !== 'available') {
            throw new ApiError(409, 'listing_unavailable');
        }

        try {
            $created = DB::transaction(function () use ($listingId, $buyerId, $listing) {
                $live = $this->sellableListing(Listing::query()->whereKey($listingId))->where('availabilityState', 'available')->first();
                if ($live === null) {
                    throw new ApiError(409, 'listing_unavailable');
                }

                $thread = InquiryThread::query()->firstOrCreate(['listingId' => $listingId, 'buyerUserId' => $buyerId], ['sellerProfileId' => $listing->sellerProfileId]);
                $prior = Transaction::query()->where('activeThreadId', $thread->id)->first();
                if ($prior !== null) {
                    return [$prior, false];
                }

                $transaction = Transaction::create([
                    'inquiryThreadId' => $thread->id, 'activeThreadId' => $thread->id, 'listingId' => $listingId,
                    'buyerUserId' => $buyerId, 'sellerUserId' => $listing->seller->ownerUserId, 'status' => 'pending',
                    'price' => $live->getRawOriginal('price'), 'currency' => $live->currency,
                ]);
                $this->logEvent($transaction, $buyerId, 'requested', null, 'pending');

                return [$transaction->fresh(), true];
            });
        } catch (UniqueConstraintViolationException) {
            // Concurrent duplicates race on the nullable active-thread unique index.
            $retry = $this->activeOrder($listingId, $buyerId);
            if ($retry === null) {
                throw new ApiError(409, 'request_changed');
            }

            return ApiResponse::json($this->row($retry));
        }

        return ApiResponse::json($this->row($created[0]), $created[1] ? 201 : 200);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        $input = ApiQuery::all($request);
        ApiQuery::strictKeys($input, ['page', 'pageSize', 'role']);
        $page = ApiQuery::int($input, 'page', 1, 1, 1000);
        $pageSize = ApiQuery::int($input, 'pageSize', 20, 1, 30);
        $role = ApiQuery::enum($input, 'role', ['all', 'buying', 'selling'], 'all');

        $where = fn () => match ($role) {
            'buying' => Transaction::query()->where('buyerUserId', $userId),
            'selling' => Transaction::query()->where('sellerUserId', $userId),
            default => $this->participantQuery($userId),
        };
        $items = $where()->with('listing:id,title,type', 'buyer:id,displayName', 'seller:id,displayName')
            ->orderByDesc('createdAt')->offset(($page - 1) * $pageSize)->limit($pageSize)->get();

        return ApiResponse::json([
            'items' => $items->map(function ($transaction) {
                $row = $this->scalarRow($transaction);
                $row['listing'] = ['title' => $transaction->listing->title, 'type' => $transaction->listing->type->value];
                $row['buyer'] = ['displayName' => $transaction->buyer->displayName];
                $row['seller'] = ['displayName' => $transaction->seller->displayName];

                return $row;
            })->all(),
            'total' => $where()->count(),
            'page' => $page,
            'pageSize' => $pageSize,
        ], 200, ['Cache-Control' => 'no-store']);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        $history = TransactionStatusLog::query()->where('transactionId', $transaction->id)->orderBy('id')
            ->get(['id', 'event', 'fromStatus', 'toStatus', 'actorUserId', 'reason', 'createdAt']);
        $handoff = Handoff::query()->where('inquiryThreadId', $transaction->inquiryThreadId)->first();

        return ApiResponse::json($this->withListing($transaction) + ['history' => $history->toArray(), 'handoff' => $handoff?->toArray()], 200, ['Cache-Control' => 'no-store']);
    }

    public function decision(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        if ($transaction->sellerUserId !== $userId) {
            throw new ApiError(404, 'not_found');
        }
        if ($transaction->status->value !== 'pending') {
            throw new ApiError(409, 'invalid_transaction_state');
        }
        if ($transaction->listing->seller->approvalStatus->value !== 'approved') {
            throw new ApiError(409, 'seller_unavailable');
        }

        $body = ApiInput::object($request);
        $action = ApiInput::enum($body, 'action', ['accept', 'reject']);
        ApiInput::strictKeys($body, $action === 'accept' ? ['action'] : ['action', 'reason']);
        $reason = $action === 'reject' ? ApiInput::string($body, 'reason', 10, 500, true) : null;

        $result = DB::transaction(function () use ($transaction, $userId, $action, $reason) {
            $pending = fn () => $this->participantQuery($userId)->whereKey($transaction->id)->where('status', 'pending')->where('activeThreadId', $transaction->inquiryThreadId);
            if ($action === 'accept') {
                // The buyer may have lost eligibility after submitting the request.
                $eligibleBuyer = User::query()->whereKey($transaction->buyerUserId)->where('status', 'active')->whereDoesntHave('roles')
                    ->whereHas('affiliations', fn ($affiliation) => ListingAccess::currentAffiliation($affiliation)->whereHas('campus', fn ($campus) => $campus->where('active', true)))
                    ->exists();
                if (! $eligibleBuyer) {
                    throw new ApiError(409, 'buyer_unavailable');
                }
                if ($pending()->update(['status' => 'accepted']) === 0) {
                    throw new ApiError(409, 'invalid_transaction_state');
                }
                if ($transaction->listing->type->value === 'physical_product') {
                    $this->stock->hold($transaction->listingId);
                } elseif (! Listing::query()->whereKey($transaction->listingId)->where('status', 'published')->whereNull('deletedAt')->where('availabilityState', 'available')->exists()) {
                    throw new ApiError(409, 'listing_unavailable');
                }
                $this->logEvent($transaction, $userId, 'accepted', 'pending', 'accepted');
            } else {
                if ($pending()->update(['status' => 'cancelled', 'activeThreadId' => null]) === 0) {
                    throw new ApiError(409, 'invalid_transaction_state');
                }
                $this->logEvent($transaction, $userId, 'rejected', 'pending', 'cancelled', $reason);
            }

            return Transaction::query()->findOrFail($transaction->id);
        });

        return ApiResponse::json($this->row($result));
    }

    public function negotiating(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        ApiInput::emptyObject($request);
        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        if ($transaction->status->value !== 'accepted') {
            throw new ApiError(409, 'invalid_transaction_state');
        }
        $this->ensureNotModerated($transaction->listing);

        $result = DB::transaction(function () use ($transaction, $userId) {
            if ($this->participantQuery($userId)->whereKey($transaction->id)->where('status', 'accepted')->update(['status' => 'negotiating']) === 0) {
                throw new ApiError(409, 'invalid_transaction_state');
            }
            $this->logEvent($transaction, $userId, 'negotiating', 'accepted', 'negotiating');

            return Transaction::query()->findOrFail($transaction->id);
        });

        return ApiResponse::json($this->row($result));
    }

    /** Revising an agreed meetup clears both confirmations and is never silent. */
    public function meetupLocation(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['place', 'timeWindow', 'lat', 'lng', 'resetConfirmations']);
        $place = ApiInput::string($body, 'place', 3, 74, true);
        $timeWindow = ApiInput::string($body, 'timeWindow', 3, 80, true);
        $lat = $this->coordinate($body, 'lat', 85);
        $lng = $this->coordinate($body, 'lng', 180);
        $reset = array_key_exists('resetConfirmations', $body) ? ApiInput::boolean($body, 'resetConfirmations') : false;

        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        $status = $transaction->status->value;
        if (! in_array($status, ['accepted', 'negotiating', 'for_meetup'], true) || $transaction->buyerCompletionConfirmedAt || $transaction->sellerCompletionConfirmedAt) {
            throw new ApiError(409, 'meetup_location_locked');
        }
        $needsReconfirmation = $status === 'for_meetup' || (bool) ($transaction->buyerMeetupConfirmedAt || $transaction->sellerMeetupConfirmedAt);
        if ($needsReconfirmation && ! $reset) {
            throw new ApiError(409, 'meetup_reconfirmation_required');
        }
        $this->ensureNotModerated($transaction->listing);
        $generalLocation = "{$place} [geo:".$this->toFixed5($lat).','.$this->toFixed5($lng).']';

        $handoff = DB::transaction(function () use ($transaction, $userId, $needsReconfirmation, $timeWindow, $generalLocation, $status) {
            $query = $this->participantQuery($userId)->whereKey($transaction->id)
                ->whereIn('status', $needsReconfirmation ? ['accepted', 'negotiating', 'for_meetup'] : ['accepted', 'negotiating'])
                ->where('activeThreadId', $transaction->inquiryThreadId)
                ->whereNull('buyerCompletionConfirmedAt')->whereNull('sellerCompletionConfirmedAt');
            if (! $needsReconfirmation) {
                $query->whereNull('buyerMeetupConfirmedAt')->whereNull('sellerMeetupConfirmedAt');
            }
            $data = $needsReconfirmation
                ? ['status' => 'negotiating', 'buyerMeetupConfirmedAt' => null, 'sellerMeetupConfirmedAt' => null]
                : ['updatedAt' => ListingAccess::now()];
            if ($query->update($data) === 0) {
                throw new ApiError(409, 'meetup_location_locked');
            }

            $row = Handoff::query()->where('inquiryThreadId', $transaction->inquiryThreadId)->first();
            if ($row === null) {
                $row = Handoff::create(['inquiryThreadId' => $transaction->inquiryThreadId, 'method' => 'campus_pickup', 'timeWindow' => $timeWindow, 'generalLocation' => $generalLocation, 'status' => 'proposed']);
            } else {
                $row->update(['timeWindow' => $timeWindow, 'generalLocation' => $generalLocation, 'status' => 'proposed']);
            }
            $this->logEvent($transaction, $userId, $needsReconfirmation ? 'meetup_location_revised' : 'meetup_location_shared', $status, $needsReconfirmation ? 'negotiating' : $status);

            return $row->fresh();
        });

        return ApiResponse::json($handoff->toArray(), 200, ['Cache-Control' => 'no-store']);
    }

    public function confirmMeetup(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        ApiInput::emptyObject($request);
        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        if (! in_array($transaction->status->value, ['accepted', 'negotiating'], true)) {
            throw new ApiError(409, 'invalid_transaction_state');
        }
        $this->ensureNotModerated($transaction->listing);
        $field = $transaction->buyerUserId === $userId ? 'buyerMeetupConfirmedAt' : 'sellerMeetupConfirmedAt';

        $result = DB::transaction(function () use ($transaction, $userId, $field) {
            $open = fn () => $this->participantQuery($userId)->whereKey($transaction->id)->whereIn('status', ['accepted', 'negotiating']);
            if ($open()->whereNull($field)->update([$field => ListingAccess::now()]) === 0) {
                throw new ApiError(409, 'already_confirmed_or_changed');
            }

            $updated = Transaction::query()->findOrFail($transaction->id);
            $both = $updated->buyerMeetupConfirmedAt !== null && $updated->sellerMeetupConfirmedAt !== null;
            if ($both && $open()->update(['status' => 'for_meetup']) === 0) {
                throw new ApiError(409, 'invalid_transaction_state');
            }
            $this->logEvent($transaction, $userId, 'meetup_confirmed', $updated->status->value, $both ? 'for_meetup' : $updated->status->value);

            return Transaction::query()->findOrFail($transaction->id);
        });

        return ApiResponse::json($this->row($result));
    }

    public function confirmCompletion(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        ApiInput::emptyObject($request);
        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        if ($transaction->status->value !== 'for_meetup') {
            throw new ApiError(409, 'invalid_transaction_state');
        }
        $this->ensureNotModerated($transaction->listing);
        $field = $transaction->buyerUserId === $userId ? 'buyerCompletionConfirmedAt' : 'sellerCompletionConfirmedAt';

        $result = DB::transaction(function () use ($transaction, $userId, $field) {
            $open = fn () => $this->participantQuery($userId)->whereKey($transaction->id)->where('status', 'for_meetup');
            if ($open()->whereNull($field)->update([$field => ListingAccess::now()]) === 0) {
                throw new ApiError(409, 'already_confirmed_or_changed');
            }

            $updated = Transaction::query()->findOrFail($transaction->id);
            $both = $updated->buyerCompletionConfirmedAt !== null && $updated->sellerCompletionConfirmedAt !== null;
            if ($both) {
                if ($transaction->listing->type->value === 'physical_product') {
                    $this->stock->complete($transaction->listingId, $transaction->id);
                }
                if ($open()->where('activeThreadId', $transaction->inquiryThreadId)->update(['status' => 'completed', 'activeThreadId' => null]) === 0) {
                    throw new ApiError(409, 'invalid_transaction_state');
                }
            }
            $this->logEvent($transaction, $userId, 'completion_confirmed', $updated->status->value, $both ? 'completed' : 'for_meetup');

            return Transaction::query()->findOrFail($transaction->id);
        });

        return ApiResponse::json($this->row($result));
    }

    public function cancel(Request $request, string $id): JsonResponse
    {
        $userId = $this->userId($request);
        $this->eligibleStudent($userId);
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['reason']);
        $reason = ApiInput::string($body, 'reason', 10, 500, true);
        $transaction = $this->participant($userId, ApiInput::positiveId($id));
        $status = $transaction->status->value;
        if (in_array($status, ['completed', 'cancelled'], true)) {
            throw new ApiError(409, 'invalid_transaction_state');
        }

        $result = DB::transaction(function () use ($transaction, $userId, $status, $reason) {
            $cancelled = $this->participantQuery($userId)->whereKey($transaction->id)->whereNotIn('status', ['completed', 'cancelled'])
                ->where('activeThreadId', $transaction->inquiryThreadId)->update(['status' => 'cancelled', 'activeThreadId' => null]);
            if ($cancelled === 0) {
                throw new ApiError(409, 'invalid_transaction_state');
            }
            if ($transaction->listing->type->value === 'physical_product' && $status !== 'pending') {
                $this->stock->release($transaction->listingId, $transaction->id);
            }
            $this->logEvent($transaction, $userId, 'cancelled', $status, 'cancelled', $reason);

            return Transaction::query()->findOrFail($transaction->id);
        });

        return ApiResponse::json($this->row($result));
    }

    private function userId(Request $request): int
    {
        return $request->attributes->get('authUser')->id;
    }

    /** Staff roles cannot act as a student buyer or seller, even with an affiliation. */
    private function eligibleStudent(int $userId): void
    {
        $eligible = User::query()->whereKey($userId)->where('status', 'active')->whereDoesntHave('roles')
            ->whereHas('affiliations', fn ($affiliation) => ListingAccess::currentAffiliation($affiliation)->whereHas('campus', fn ($campus) => $campus->where('active', true)))
            ->exists();
        if (! $eligible) {
            throw new ApiError(403, 'student_verification_required');
        }
    }

    private function sellableListing($query)
    {
        return $query->where('status', 'published')->whereNull('deletedAt')->whereHas('seller', fn ($seller) => ListingAccess::visibleStore($seller));
    }

    private function activeOrder(int $listingId, int $buyerId): ?Transaction
    {
        return Transaction::query()->where('listingId', $listingId)->where('buyerUserId', $buyerId)->whereNotNull('activeThreadId')->first();
    }

    private function participantQuery(int $userId)
    {
        return Transaction::query()->where(fn ($query) => $query->where('buyerUserId', $userId)->orWhere('sellerUserId', $userId));
    }

    private function participant(int $userId, int $id): Transaction
    {
        $transaction = $this->participantQuery($userId)->whereKey($id)->with('listing.seller:id,approvalStatus,ownerUserId')->first();
        if ($transaction === null) {
            throw new ApiError(404, 'not_found');
        }

        return $transaction;
    }

    private function ensureNotModerated(Listing $listing): void
    {
        if ($listing->status->value !== 'published' || $listing->deletedAt !== null) {
            throw new ApiError(409, 'listing_under_review');
        }
    }

    private function logEvent(Transaction $transaction, int $actor, string $event, ?string $previous, string $next, ?string $reason = null): void
    {
        TransactionStatusLog::create(['transactionId' => $transaction->id, 'actorUserId' => $actor, 'fromStatus' => $previous, 'toStatus' => $next, 'event' => $event, 'reason' => $reason]);
        AuditLog::create([
            'actorUserId' => $actor, 'targetType' => 'transaction', 'targetId' => $transaction->id, 'action' => "transaction.{$event}",
            'metadata' => ['fromStatus' => $previous, 'toStatus' => $next] + ($reason ? ['reason' => $reason] : []),
        ]);
        Notification::create([
            'userId' => $actor === $transaction->buyerUserId ? $transaction->sellerUserId : $transaction->buyerUserId,
            'type' => "transaction.{$event}",
            'payload' => ['transactionId' => $transaction->id, 'listingId' => $transaction->listingId, 'status' => $next],
        ]);
    }

    private function scalarRow(Transaction $transaction): array
    {
        $row = $transaction->attributesToArray();
        $row['price'] = (float) $transaction->price;

        return $row;
    }

    private function row(Transaction $transaction): array
    {
        return $this->scalarRow($transaction);
    }

    private function withListing(Transaction $transaction): array
    {
        $listing = $transaction->listing;
        $row = $this->scalarRow($transaction);
        $row['listing'] = $listing->attributesToArray();
        $row['listing']['seller'] = ['approvalStatus' => $listing->seller->approvalStatus->value, 'ownerUserId' => $listing->seller->ownerUserId];

        return $row;
    }

    private function coordinate(array $body, string $field, int $limit): float
    {
        $value = $body[$field] ?? null;
        if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value) || abs((float) $value) > $limit) {
            throw ApiInput::invalid($field, 'Invalid coordinate');
        }

        return (float) $value;
    }

    /** JavaScript toFixed(5): exact binary value, with ties rounded away from zero. */
    private function toFixed5(float $value): string
    {
        [$whole, $fraction] = explode('.', sprintf('%.50F', abs($value)));
        $scaled = (int) ($whole.substr($fraction, 0, 5));
        if ((int) $fraction[5] >= 5) {
            $scaled++;
        }
        $digits = str_pad((string) $scaled, 6, '0', STR_PAD_LEFT);

        return ($value < 0 ? '-' : '').substr($digits, 0, -5).'.'.substr($digits, -5);
    }
}
