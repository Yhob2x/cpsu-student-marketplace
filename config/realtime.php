<?php
return [
    'enabled' => filter_var(env('MARKET_REALTIME_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'key' => env('REVERB_APP_KEY'),
    'secret' => env('REVERB_APP_SECRET'),
    'app_id' => env('REVERB_APP_ID'),
    // Server publisher is always loopback; browser uses the public reverse proxy.
    'host' => '127.0.0.1',
    'port' => env('REVERB_SERVER_PORT', 8080),
    'browser_port' => env('REVERB_BROWSER_PORT', 8080),
    'same_origin' => filter_var(env('REVERB_SAME_ORIGIN', false), FILTER_VALIDATE_BOOLEAN),
];
