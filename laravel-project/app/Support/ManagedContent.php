<?php

namespace App\Support;

/** Published-content validation shared by public pages. Ported from home-page-content.ts. */
final class ManagedContent
{
    public const DEFAULT_GUIDELINES = <<<'TEXT'
# What you can list
Student-made goods, pre-loved items, and skills-based services such as design, tutoring and IT help.

# What gets a closer look
Food, drinks, printing and school supplies may overlap with campus establishments. A campus reviewer checks these before they appear, and may restrict them under the campus rules.

# Not allowed
Paid cheating or impersonation, harassment, and anything prohibited by campus or national rules.

# Meeting and paying
You and the other person agree on payment and handoff. Meet at a campus pickup spot where possible. The marketplace never holds money.

# Problems
Use Report on any listing. A reviewer looks at it and records the outcome.
TEXT;

    public const IMAGE_SLOTS = ['hero', 'steps', 'cta'];

    private const LINES = [
        'heroEyebrow' => 70, 'heroLine1' => 70, 'heroAccent' => 12, 'heroLine2' => 70, 'heroLine3' => 70,
        'searchHeading' => 100, 'categoryHeading' => 70, 'trustHeading' => 100, 'trustAccent' => 70,
        'stepsEyebrow' => 70, 'stepsHeading' => 80, 'stepsAccent' => 70, 'ctaHeading' => 100,
    ];

    private const COPY_KEYS = [
        'heroEyebrow', 'heroLine1', 'heroAccent', 'heroLine2', 'heroLine3', 'heroBody', 'searchHeading', 'categoryHeading',
        'trustHeading', 'trustAccent', 'trustItems', 'stepsEyebrow', 'stepsHeading', 'stepsAccent', 'steps', 'ctaHeading', 'ctaBody',
    ];

    private static function plain(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $text = ApiInput::trim($value);
        $length = ApiInput::length($text);

        return $length >= 1 && $length <= $max && preg_match('/[<>]/', $text) !== 1 ? $text : null;
    }

    private static function line(mixed $value, int $max): ?string
    {
        $text = self::plain($value, $max);

        return $text !== null && preg_match('/[\r\n]/', $text) !== 1 ? $text : null;
    }

    private static function sameKeys(mixed $value, array $keys): bool
    {
        if (! is_array($value) || count($value) !== count($keys)) {
            return false;
        }

        return array_diff($keys, array_map('strval', array_keys($value))) === [];
    }

    /** Returns the cleaned snapshot, or null when stored content is invalid. */
    public static function parseHomePage(mixed $snapshot): ?array
    {
        if (! self::sameKeys($snapshot, ['copy', 'images']) || ! self::sameKeys($snapshot['copy'], self::COPY_KEYS) || ! self::sameKeys($snapshot['images'], self::IMAGE_SLOTS)) {
            return null;
        }

        $source = $snapshot['copy'];
        $copy = [];
        foreach (self::COPY_KEYS as $key) {
            if (isset(self::LINES[$key])) {
                $copy[$key] = self::line($source[$key], self::LINES[$key]);
                if ($copy[$key] === null) {
                    return null;
                }
            }
        }
        $copy['heroBody'] = self::plain($source['heroBody'], 240);
        $copy['ctaBody'] = self::plain($source['ctaBody'], 180);
        if ($copy['heroBody'] === null || $copy['ctaBody'] === null) {
            return null;
        }

        if (! is_array($source['trustItems']) || ! array_is_list($source['trustItems']) || count($source['trustItems']) !== 4) {
            return null;
        }
        $copy['trustItems'] = [];
        foreach ($source['trustItems'] as $item) {
            $text = self::line($item, 100);
            if ($text === null) {
                return null;
            }
            $copy['trustItems'][] = $text;
        }

        if (! is_array($source['steps']) || ! array_is_list($source['steps']) || count($source['steps']) !== 3) {
            return null;
        }
        $copy['steps'] = [];
        foreach ($source['steps'] as $step) {
            if (! self::sameKeys($step, ['title', 'body'])) {
                return null;
            }
            $title = self::line($step['title'], 70);
            $body = self::plain($step['body'], 160);
            if ($title === null || $body === null) {
                return null;
            }
            $copy['steps'][] = ['title' => $title, 'body' => $body];
        }

        $images = [];
        foreach (self::IMAGE_SLOTS as $slot) {
            $image = $snapshot['images'][$slot];
            if ($image !== null && (! is_string($image) || ApiInput::length($image) < 1 || ApiInput::length($image) > 512)) {
                return null;
            }
            $images[$slot] = $image;
        }

        return ['copy' => array_replace(array_flip(self::COPY_KEYS), $copy), 'images' => $images];
    }

    public static function defaultHomePage(): array
    {
        $defaults = json_decode((string) file_get_contents(resource_path('shared/home-page-defaults.json')), true, 16, JSON_THROW_ON_ERROR);

        return self::parseHomePage($defaults) ?? throw new \RuntimeException('Default home page content is invalid.');
    }

    public static function publicHomePage(array $snapshot, int $revision): array
    {
        $images = [];
        foreach (self::IMAGE_SLOTS as $slot) {
            $images[$slot] = $snapshot['images'][$slot] ? "/api/v1/home-page/images/{$slot}?v={$revision}" : null;
        }

        return ['copy' => $snapshot['copy'], 'images' => $images];
    }
}
