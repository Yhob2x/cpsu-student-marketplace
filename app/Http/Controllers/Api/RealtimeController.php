<?php
namespace App\Http\Controllers\Api;

use App\Services\Realtime;
use App\Support\ApiError;
use App\Support\ApiInput;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

final class RealtimeController
{
    public function config()
    {
        return ApiResponse::json([
            'enabled' => Realtime::enabled(),
            'key' => Realtime::enabled() ? config('realtime.key') : null,
            'port' => (int) config('realtime.browser_port'),
            'sameOrigin' => (bool) config('realtime.same_origin'),
        ], 200, ['Cache-Control' => 'private, no-store']);
    }

    public function authorize(Request $request)
    {
        if (!Realtime::enabled()) throw new ApiError(503, 'realtime_unavailable');
        $body = ApiInput::object($request);
        ApiInput::strictKeys($body, ['channel_name', 'socket_id']);
        $channel = ApiInput::string($body, 'channel_name', 1, 100);
        $socket = ApiInput::string($body, 'socket_id', 1, 100);
        $user = $request->attributes->get('authUser');
        if ($channel !== 'private-market-user.'.$user->id) throw new ApiError(403, 'forbidden');
        if (!preg_match('/^\d+\.\d+$/D', $socket)) throw ApiInput::invalid('socket_id', 'Invalid socket', 'custom');
        return ApiResponse::json(json_decode(Realtime::client()->authorizeChannel($channel, $socket), true, 512, JSON_THROW_ON_ERROR), 200, ['Cache-Control' => 'private, no-store']);
    }
}
