<?php

namespace App\Support;

/** Seller listing input rules. Unknown keys are ignored, matching the Express schema. */
final class ListingPayload
{
    public const TYPES = ['physical_product', 'service'];

    public const CONDITIONS = ['new', 'like_new', 'good', 'fair'];

    /** @return array{fields: array<string, mixed>, stockQuantity: ?int, hasStock: bool} */
    public static function parse(array $body, bool $partial): array
    {
        $fields = [];
        $wants = fn (string $key) => ! $partial || array_key_exists($key, $body);

        if ($wants('type')) {
            $fields['type'] = ApiInput::enum($body, 'type', self::TYPES);
        }
        if ($wants('categoryId')) {
            $fields['categoryId'] = ApiInput::integer($body, 'categoryId');
        }
        if ($wants('title')) {
            $fields['title'] = ApiInput::string($body, 'title', 3, 120, true);
        }
        if ($wants('description')) {
            $fields['description'] = ApiInput::string($body, 'description', 10, 3000, true);
        }
        if ($wants('price')) {
            $price = $body['price'] ?? null;
            if ((! is_int($price) && ! is_float($price)) || $price <= 0 || $price > 1000000) {
                throw ApiInput::invalid('price', 'Invalid price');
            }
            $fields['price'] = $price;
        }
        if (array_key_exists('priceBasis', $body)) {
            $fields['priceBasis'] = ApiInput::string($body, 'priceBasis', null, 40);
        } elseif (! $partial) {
            $fields['priceBasis'] = 'per item';
        }
        if (array_key_exists('condition', $body)) {
            $fields['condition'] = $body['condition'] === null ? null : ApiInput::enum($body, 'condition', self::CONDITIONS);
        }
        if (array_key_exists('handoffNote', $body)) {
            $fields['handoffNote'] = ApiInput::string($body, 'handoffNote', null, 200);
        }

        $hasStock = array_key_exists('stockQuantity', $body);
        $stock = null;
        if ($hasStock) {
            $stock = ApiInput::integer($body, 'stockQuantity');
            if ($stock < 0 || $stock > 100000) {
                throw ApiInput::invalid('stockQuantity', 'Invalid stock quantity');
            }
        }

        return ['fields' => $fields, 'stockQuantity' => $stock, 'hasStock' => $hasStock];
    }
}
