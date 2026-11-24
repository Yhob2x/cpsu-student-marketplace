<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/** Explicit isolation levels for the flows that depended on them under Prisma. */
final class Tx
{
    public static function serializable(callable $callback): mixed
    {
        DB::statement('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');

        return DB::transaction($callback);
    }

    public static function readCommitted(callable $callback): mixed
    {
        DB::statement('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');

        return DB::transaction($callback);
    }
}
