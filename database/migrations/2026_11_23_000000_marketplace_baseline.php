<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Creates the approved schema on an empty database and never alters an existing one. */
    public function up(): void
    {
        if (Schema::hasTable('User')) {
            return;
        }

        DB::unprepared('SET FOREIGN_KEY_CHECKS=0;'.file_get_contents(database_path('schema/marketplace-baseline.sql')).'SET FOREIGN_KEY_CHECKS=1;');
    }

    /** Deliberately empty: rolling back must never drop marketplace data. */
    public function down(): void {}
};
