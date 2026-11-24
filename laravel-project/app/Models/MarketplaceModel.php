<?php

namespace App\Models;

use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/** Keeps Eloquent compatible with the existing camelCase schema and API date format. */
abstract class MarketplaceModel extends Model
{
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected function serializeDate(DateTimeInterface $date): string
    {
        return \Illuminate\Support\Carbon::instance($date)->utc()->format('Y-m-d\TH:i:s.v\Z');
    }

    protected function setKeysForSaveQuery($query): Builder
    {
        if (! defined(static::class.'::COMPOSITE_KEY')) {
            return parent::setKeysForSaveQuery($query);
        }

        foreach (static::COMPOSITE_KEY as $column) {
            $query->where($column, '=', $this->original[$column] ?? $this->getAttribute($column));
        }

        return $query;
    }

    protected function setKeysForSelectQuery($query): Builder
    {
        return defined(static::class.'::COMPOSITE_KEY') ? $this->setKeysForSaveQuery($query) : parent::setKeysForSelectQuery($query);
    }
}
