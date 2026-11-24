<?php

namespace App\Services;

/** A push endpoint is a secret capability URL. Only browser push providers are allowed. */
class PushEndpoints
{
    private const HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'web.push.apple.com'];

    private const SUFFIXES = ['.push.apple.com', '.notify.windows.com', '.wns.windows.com'];

    public static function permitted(string $raw): bool
    {
        // Backslashes and control characters parse differently across URL libraries.
        if (strlen($raw) > 2048 || preg_match('/[\\\\\s\x00-\x1F\x7F]/', $raw) === 1) {
            return false;
        }

        $url = parse_url($raw);
        if ($url === false || strtolower($url['scheme'] ?? '') !== 'https' || isset($url['user']) || isset($url['pass'])) {
            return false;
        }
        if (isset($url['port']) && (int) $url['port'] !== 443) {
            return false;
        }

        $host = strtolower($url['host'] ?? '');
        if (in_array($host, self::HOSTS, true)) {
            return true;
        }
        foreach (self::SUFFIXES as $suffix) {
            if (str_ends_with($host, $suffix)) {
                return true;
            }
        }

        return false;
    }

    public static function hash(string $endpoint): string
    {
        return hash('sha256', $endpoint);
    }
}
