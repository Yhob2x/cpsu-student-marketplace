# CPSU Marketplace — image upload safety and content review
**Date:** 2026-11-16
**Scope:** Local development only; no production deployment. Follows MASTER_BLUEPRINT.md and docs/SECURITY_GUIDELINES.md.

## User goal and current protection

Students must not be able to publish pornography, explicit sexual imagery, graphic violence, or other prohibited imagery. **Automatic NSFW/pornography classification is NOT included in this update.** This change protects against malformed uploads and requires explicit human review before newly uploaded photos become public. A human may still make mistakes.

## Implemented controls

1. Seller ownership, deleted/status checks, and the six-photo quota are checked before Multer accepts the upload bytes. Only drafts, changes-requested, and published listings accept additional photos.
2. The server accepts a single file ≤3 MiB declared JPEG/PNG/WebP, verifies that its decoder-detected format matches that declaration, enforces a 24-megapixel bound, rejects multi-frame images and malformed input, then re-encodes the still image as WebP (max 2400px). Re-encoding removes EXIF/GPS and other source metadata, as well as appended source-file payloads.
3. Temporary raw uploads are deleted whether processing succeeds or fails. Only random-name, sanitized WebP files are registered in the database. A sanitized output is also removed if its database transaction fails. New upload attempts are audited.
4. A newly added photo forces a published listing into draft inside the same database transaction. The newly added photo cannot become public through the old approval.
5. The server refuses an approval unless the campus reviewer sends `photosReviewed: true` and the listing contains at least one photo. The admin UI provides an explicit, unchecked confirmation listing prohibited types. The reviewer decision log records the confirmation and number of photos. Other moderation decisions do not require this confirmation.
6. The seller upload UI displays content policy text, and the admin review UI states that photo content recognition is not automated.

**No schema migration or paid/cloud moderation API was added.** Sharp is a free local image-decoding/re-encoding dependency. Older media are not transformed retroactively.

## Actual security guarantees and limits

- **Automated validation:** malformed, misdeclared, multi-frame, oversized image data cannot be accepted as a newly sanitized file.
- **Human content gate:** a seller cannot self-publish a new photo. A campus reviewer must acknowledge having inspected every photo before publishing.
- **Not provided:** actual automatic nudity/pornography detection, malware scanning of every existing file, image fingerprinting, guaranteed prevention of browser Save Image As/screenshots, reviewer honesty checks, or retrospective quarantine of already published images.
- Any media already accessible publicly can potentially be saved by a visitor. Technical controls cannot reliably prohibit copying a visible image; the primary control is to prevent harmful images from becoming public.
- Rejection, reporting and suspension remain the existing authorized moderation workflows.

## Verification

- Synthetic local sanitizer unit tests: **3/3 pass**, including JPEG EXIF removal, PNG disguised as JPEG, and non-image bytes mislabeled PNG. The original uploaded file is not retained.
- Server-side human photo-review gate unit tests: **5/5 pass** (missing/false attestation, zero photos, approved attestation and nonapproval decisions).
- Existing permission tests: **5/5 pass**. Total direct tests: **13/13 pass**.
- Web TypeScript/Vite production build: **pass** after the UI changes.
- Added isolated MySQL integration assertions for pre-upload authorization, forged content type, corrupt data, normalized output, campus reviewer attestation, and forced re-review on a published listing.
- **Integration acceptance remains blocked:** the concurrent PWA push-notification feature currently fails module import before the integration tests run (`web-push` default export under Bun). API TypeScript also has pre-existing stale Prisma-generated-client errors in `src/push.ts` and `src/routes/push.ts`. Do not mark full integration or API compile as passing until this is independently resolved.
- Physical-device and human screen-reader review remain pending.

## Next approval gate

1. Resolve the unrelated concurrent PWA push build/test baseline without overwriting its owner’s work; regenerate Prisma client safely, then run the isolated full integration suite and API TypeScript check.
2. Evaluate an **offline/local content classification** engine with documented provenance, supported image types, decision thresholds, privacy boundaries, failure behavior, benchmark metrics, human escalation/appeal, and explicit CPSU policy approval. Do not falsely equate image-format validation with semantic moderation.
3. Inspect and reprocess pre-existing media through an approved backup and migration plan; test real phone uploads and review workflow before launch.
