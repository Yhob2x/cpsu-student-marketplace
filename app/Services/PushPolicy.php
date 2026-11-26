<?php

namespace App\Services;

/**
 * Fail-closed release gates for browser push. Enrollment needs valid keys, an approved contact
 * and a production HTTPS origin (or isolated, opt-in local HTTPS QA). Production delivery requires explicit
 * configuration and a recorded institutional delivery approval.
 */
class PushPolicy
{
    public function subscriptionsEnabled(): bool
    {
        $push = config('marketplace.push');
        $qa = app()->environment('testing');

        return (bool) $push['subscriptions_enabled']
            && $this->validPair($push['vapid_public_key'], $push['vapid_private_key'])
            && $this->validContact((string) $push['vapid_subject'], $qa)
            && ($qa || $this->localTestingReady() || $this->productionReady((string) $push['origins']));
    }

    public function deliveryEnabled(): bool
    {
        $push = config('marketplace.push');
        return $this->subscriptionsEnabled() && (bool) ($push['delivery_enabled'] ?? false)
            && ($this->localTestingReady() || trim((string) ($push['delivery_approval_ref'] ?? '')) !== '');
    }

    public function publicKey(): ?string
    {
        return $this->subscriptionsEnabled() ? config('marketplace.push.vapid_public_key') : null;
    }

    /** Real-device QA is opt-in and must never use the normal marketplace database. */
    private function localTestingReady(): bool
    {
        if (! app()->environment('local', 'push-qa') || ! config('marketplace.push.local_test_enabled')
            || config('app.debug') || ! config('marketplace.cookie_secure')) {
            return false;
        }

        $connection = config('database.default');
        $database = config('database.connections.'.$connection, []);
        if (! in_array($connection, ['mysql', 'mariadb'], true)
            || ! empty($database['url'])
            || ! empty($database['unix_socket'])
            || ! in_array($database['host'] ?? null, ['127.0.0.1', 'localhost', '::1'], true)
            || ($database['database'] ?? null) !== 'cpsu_marketplace_laravel_push_test') {
            return false;
        }

        $origin = rtrim((string) config('app.url'), '/');
        return $this->validOrigin($origin)
            && rtrim(trim((string) config('marketplace.push.origins')), '/') === $origin;
    }

    private function productionReady(string $origins): bool
    {
        if (! app()->isProduction() || ! config('marketplace.cookie_secure')) {
            return false;
        }

        foreach (explode(',', $origins) as $origin) {
            if (! $this->validOrigin(trim($origin))) {
                return false;
            }
        }

        return true;
    }

    private function publicHostname(string $raw): bool
    {
        $host = preg_replace('/\.$/', '', strtolower($raw));

        return str_contains($host, '.')
            && preg_match('/^[a-z0-9.-]+\z/', $host) === 1
            && preg_match('/^(?:\d{1,3}\.){3}\d{1,3}\z/', $host) !== 1
            && preg_match('/(?:^|\.)(localhost|local|internal|lan|invalid|test|example)\z/', $host) !== 1
            && preg_match('/(?:^|\.)example\.(com|net|org)\z/', $host) !== 1
            && ! str_starts_with($host, '-')
            && ! str_contains($host, '..');
    }

    private function validOrigin(string $raw): bool
    {
        $url = parse_url($raw);

        return is_array($url) && ($url['scheme'] ?? '') === 'https' && isset($url['host'])
            && ! isset($url['user']) && ! isset($url['pass']) && ! isset($url['port'])
            && in_array($url['path'] ?? '/', ['', '/'], true) && ! isset($url['query']) && ! isset($url['fragment'])
            && $this->publicHostname($url['host']);
    }

    private function validContact(string $raw, bool $allowSynthetic): bool
    {
        if (str_starts_with($raw, 'mailto:')) {
            $email = substr($raw, 7);
            if (preg_match('/^[^@\s\/?#]+@[^@\s\/?#]+\.[^@\s\/?#]+\z/', $email) !== 1) {
                return false;
            }
            $host = substr($email, strrpos($email, '@') + 1);

            return $this->publicHostname($host) || ($allowSynthetic && $host === 'example.invalid');
        }

        $url = parse_url($raw);

        return is_array($url) && ($url['scheme'] ?? '') === 'https' && isset($url['host'])
            && ! isset($url['port']) && ! isset($url['user']) && ! isset($url['pass'])
            && ! isset($url['query']) && ! isset($url['fragment'])
            && $this->publicHostname($url['host']);
    }

    /** Confirms that the configured private key derives the configured P-256 public key. */
    private function validPair(?string $public, ?string $private): bool
    {
        if (preg_match('/^[A-Za-z0-9_-]{87}\z/', (string) $public) !== 1 || preg_match('/^[A-Za-z0-9_-]{43}\z/', (string) $private) !== 1) {
            return false;
        }

        $secret = base64_decode(strtr((string) $private, '-_', '+/').'=', true);
        if ($secret === false || strlen($secret) !== 32) {
            return false;
        }

        // SEC1 ECPrivateKey for prime256v1. OpenSSL derives the public point while parsing it.
        $der = "\x30\x31\x02\x01\x01\x04\x20".$secret."\xA0\x0A\x06\x08\x2A\x86\x48\xCE\x3D\x03\x01\x07";
        $pem = "-----BEGIN EC PRIVATE KEY-----\n".chunk_split(base64_encode($der), 64, "\n")."-----END EC PRIVATE KEY-----\n";
        $key = @openssl_pkey_get_private($pem);
        $details = $key === false ? false : openssl_pkey_get_details($key);
        if (! is_array($details) || ! isset($details['ec']['x'], $details['ec']['y'])) {
            return false;
        }

        $point = "\x04".str_pad($details['ec']['x'], 32, "\0", STR_PAD_LEFT).str_pad($details['ec']['y'], 32, "\0", STR_PAD_LEFT);

        return hash_equals((string) $public, rtrim(strtr(base64_encode($point), '+/', '-_'), '='));
    }
}
