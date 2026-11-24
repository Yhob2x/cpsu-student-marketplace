<?php

return [
    'jwt_secret' => env('JWT_SECRET'),
    'cookie_secure' => filter_var(env('COOKIE_SECURE', false), FILTER_VALIDATE_BOOLEAN),
    'student_identity_enabled' => filter_var(env('STUDENT_ID_COLLECTION_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'student_identity_approval_ref' => trim((string) env('STUDENT_ID_PRIVACY_APPROVAL_REF', '')),
    'rate_limits' => [
        'reads_per_minute' => 900,
        'writes_per_minute' => 300,
        'auth_per_15_minutes' => env('APP_ENV') === 'production' ? 30 : 300,
        'failed_logins_per_account' => 10,
    ],
];
