<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Throwable;

final class PhotoHealth extends Command
{
    protected $signature = 'marketplace:photo-health';
    protected $description = 'Check the private photo service without uploading a photo';

    public function handle(): int
    {
        try {
            $url = rtrim((string) config('marketplace.photo_service.url'), '/').'/health';
            $response = Http::connectTimeout(2)->timeout(4)->withoutRedirecting()->get($url);
            if ($response->successful() && $response->json('ok') === true) {
                $this->info('Photo service healthy.');
                return self::SUCCESS;
            }
        } catch (Throwable) {
            // Avoid exposing internal connection details.
        }
        $this->error('Photo service unavailable. Uploads remain safely blocked.');
        return self::FAILURE;
    }
}
