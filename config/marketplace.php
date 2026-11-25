<?php

return [
    'jwt_secret' => env('JWT_SECRET'),
    'cookie_secure' => filter_var(env('COOKIE_SECURE', false), FILTER_VALIDATE_BOOLEAN),
    'student_identity_enabled' => filter_var(env('STUDENT_ID_COLLECTION_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'student_identity_approval_ref' => trim((string) env('STUDENT_ID_PRIVACY_APPROVAL_REF', '')),
    // During migration this must point at the Express upload folder so both backends read the same photos.
    'upload_dir' => (function () {
        $directory = (string) env('UPLOAD_DIR', storage_path('app/marketplace-media'));

        return preg_match('/^(?:[A-Za-z]:[\\\\\/]|[\\\\\/])/', $directory) === 1 ? $directory : base_path($directory);
    })(),
    'media_storage' => env('MEDIA_STORAGE', 'local'),
    'google_drive' => [
        'client_id' => env('GOOGLE_DRIVE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_DRIVE_CLIENT_SECRET'),
        'refresh_token' => env('GOOGLE_DRIVE_REFRESH_TOKEN'),
        'folder_id' => env('GOOGLE_DRIVE_FOLDER_ID'),
    ],
    'photo_service' => [
        'url' => env('PHOTO_SERVICE_URL', 'http://127.0.0.1:4310'),
        'token' => env('PHOTO_SERVICE_TOKEN'),
    ],
    'push' => [
        'subscriptions_enabled' => filter_var(env('PUSH_SUBSCRIPTIONS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        'delivery_enabled' => filter_var(env('PUSH_DELIVERY_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        'delivery_approval_ref' => env('PUSH_DELIVERY_APPROVAL_REF', ''),
        'vapid_public_key' => env('VAPID_PUBLIC_KEY'),
        'vapid_private_key' => env('VAPID_PRIVATE_KEY'),
        'vapid_subject' => env('VAPID_SUBJECT'),
        'origins' => (string) env('CORS_ORIGINS', 'http://localhost:5173'),
    ],
    'rate_limits' => [
        'reads_per_minute' => 900,
        'writes_per_minute' => 300,
        'auth_per_15_minutes' => env('APP_ENV') === 'production' ? 30 : 300,
        'failed_logins_per_account' => 10,
    ],
];
