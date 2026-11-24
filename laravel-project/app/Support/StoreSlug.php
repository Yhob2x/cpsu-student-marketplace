<?php

namespace App\Support;

use Normalizer;

final class StoreSlug
{
    public static function fromName(string $name): string
    {
        $text = (string) Normalizer::normalize($name, Normalizer::FORM_KD);
        $text = (string) preg_replace('/[\x{0300}-\x{036f}]/u', '', $text);
        $text = (string) preg_replace("/[\x{2018}\x{2019}']/u", '', $text);
        $text = (string) preg_replace('/[^\p{L}\p{N}]+/u', '-', mb_strtolower($text));
        $text = (string) preg_replace('/^-|-\z/', '', $text);

        return $text === '' ? 'store' : $text;
    }

    /** @param iterable<array{id:int, storeName:string}> $stores */
    public static function canonical(array $stores, array $store): string
    {
        $base = self::fromName($store['storeName']);
        $duplicate = $base === 'store';
        foreach ($stores as $row) {
            if (! $duplicate && $row['id'] < $store['id'] && self::fromName($row['storeName']) === $base) {
                $duplicate = true;
            }
        }

        return $duplicate ? "{$base}--{$store['id']}" : $base;
    }

    public static function find(array $stores, string $slug): ?array
    {
        foreach ($stores as $store) {
            if (self::canonical($stores, $store) === $slug) {
                return $store;
            }
        }

        // Keep links made by the earlier scheme, which suffixed every duplicate.
        foreach ($stores as $store) {
            $base = self::fromName($store['storeName']);
            if ($base === 'store' || "{$base}--{$store['id']}" !== $slug) {
                continue;
            }
            foreach ($stores as $other) {
                if ($other['id'] !== $store['id'] && self::fromName($other['storeName']) === $base) {
                    return $store;
                }
            }
        }

        return null;
    }
}
