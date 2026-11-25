<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Pusher\Pusher;
use Throwable;

/** Private, content-free invalidation. REST remains the authorization and data source. */
final class Realtime
{
    public static function enabled(): bool
    {
        return (bool) config('realtime.enabled') && config('realtime.key') && config('realtime.secret') && config('realtime.app_id');
    }

    public static function client(): Pusher
    {
        return new Pusher(config('realtime.key'), config('realtime.secret'), config('realtime.app_id'), [
            'host' => config('realtime.host'), 'port' => (int) config('realtime.port'),
            'scheme' => 'http', 'useTLS' => false, 'timeout' => 1,
        ]);
    }

    public static function changed(int $userId, string $scope): void
    {
        if (!self::enabled()) return;
        $send = static function () use ($userId, $scope) {
            try {
                self::client()->trigger('private-market-user.'.$userId, 'market.changed', ['scope' => $scope]);
            } catch (Throwable) {
                // A failed WebSocket delivery must never fail a committed marketplace action.
                Log::warning('Marketplace realtime delivery unavailable.');
            }
        };
        if (DB::transactionLevel() > 0) DB::afterCommit($send);
        else $send();
    }
}
