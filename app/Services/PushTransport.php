<?php

namespace App\Services;

use App\Models\PushSubscription;
use GuzzleHttp\Client;
use Minishlink\WebPush\ContentEncoding;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/** Only generic content is sent to allowlisted browser push providers. */
class PushTransport
{
    public function send(PushSubscription $device, array $payload): int
    {
        if (! PushEndpoints::permitted($device->endpoint)) return 410;
        $push = config('marketplace.push');
        try {
            $webPush = new WebPush(['VAPID' => [
                'subject' => $push['vapid_subject'],
                'publicKey' => $push['vapid_public_key'],
                'privateKey' => $push['vapid_private_key'],
            ]], ['TTL' => 300, 'urgency' => 'normal'], new Client([
                'timeout' => 8, 'connect_timeout' => 3, 'allow_redirects' => false,
            ]));
            $report = $webPush->sendOneNotification(new Subscription(
                $device->endpoint, $device->p256dh, $device->auth, ContentEncoding::aes128gcm
            ), json_encode($payload, JSON_THROW_ON_ERROR));
            return $report->getResponse()?->getStatusCode() ?? ($report->isSuccess() ? 201 : 503);
        } catch (Throwable) {
            // Do not log capability URLs, secrets or provider exception bodies.
            return 503;
        }
    }
}
