<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Liveness never touches the database or authentication.
Route::get('/health', fn () => response()->json(['ok' => true]));

// Readiness is loopback-only and refuses forwarded clients.
Route::get('/internal/ready', function (Request $request) {
    $loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    if (! in_array($request->server('REMOTE_ADDR'), $loopback, true) || ! in_array($request->ip(), $loopback, true)) {
        abort(404);
    }

    try {
        DB::select('SELECT 1');

        return response()->json(['ok' => true])->header('Cache-Control', 'no-store');
    } catch (Throwable) {
        return response()->json(['ok' => false], 503)->header('Cache-Control', 'no-store');
    }
});

// React owns every browser route. API, build assets and the health check stay outside the shell.
Route::view('/{path?}', 'app')->where('path', '^(?!api(?:/|$)|build/|up$).*$');
