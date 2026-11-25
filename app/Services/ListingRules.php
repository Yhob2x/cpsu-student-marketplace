<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Listing;
use App\Models\RestrictedCategory;

/** Flags possible policy issues. It only flags: a human reviewer decides. */
class ListingRules
{
    private const OVERLAP_TERMS = ['food', 'meal', 'snack', 'drink', 'coffee', 'milk tea', 'lunch', 'printing', 'photocopy', 'xerox', 'school supplies', 'uniform', 'ballpen'];

    private const INTEGRITY_TERMS = ['do your assignment', 'write your thesis', 'take your exam', 'ghostwrit', 'impersonat'];

    /** @return list<string> */
    public function flags(Listing $listing, int $imageCount): array
    {
        $flags = [];
        $text = mb_strtolower("{$listing->title} {$listing->description}");

        $category = Category::query()->find($listing->categoryId);
        if ($category !== null && $category->policyRiskLevel > 0) {
            $flags[] = 'sensitive_category';
        }

        $restricted = RestrictedCategory::query()->where('campusId', $listing->campusId)->where('categoryId', $listing->categoryId)->first();
        if ($restricted !== null) {
            $flags[] = $restricted->policyAction->value === 'prohibit' ? 'restricted_prohibited' : 'restricted_review';
        }
        if ($this->containsAny($text, self::OVERLAP_TERMS)) {
            $flags[] = 'possible_establishment_overlap';
        }
        if ($this->containsAny($text, self::INTEGRITY_TERMS)) {
            $flags[] = 'academic_integrity_concern';
        }
        if ($imageCount === 0) {
            $flags[] = 'missing_images';
        }
        if ((float) $listing->price <= 0) {
            $flags[] = 'invalid_price';
        }

        return $flags;
    }

    private function containsAny(string $text, array $terms): bool
    {
        foreach ($terms as $term) {
            if (str_contains($text, $term)) {
                return true;
            }
        }

        return false;
    }
}
