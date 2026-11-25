<?php

namespace App\Console\Commands;

use App\Services\PushDelivery;
use App\Services\PushPolicy;
use Illuminate\Console\Command;
use Throwable;

final class DrainMarketplacePush extends Command
{
    protected $signature = 'marketplace:push-drain {--watch : Keep processing while delivery is explicitly enabled}';
    protected $description = 'Process a bounded batch of approved marketplace push deliveries';

    public function handle(PushPolicy $policy, PushDelivery $delivery): int
    {
        if (! $policy->deliveryEnabled()) {
            $this->info('Push delivery disabled; no jobs claimed or sent.');
            return self::SUCCESS;
        }
        do {
            try {
                $count = $delivery->drain();
                $this->info('Processed '.$count.' push jobs.');
            } catch (Throwable) {
                $this->error('Push drain failed; expired leases are recoverable.');
                return self::FAILURE;
            }
            if (! $this->option('watch')) break;
            sleep($count > 0 ? 1 : 5);
        } while ($policy->deliveryEnabled());
        return self::SUCCESS;
    }
}
