/**
 * Generate an isolated Prisma schema candidate without changing the app's
 * canonical prisma/schema.prisma or its applied migrations.
 *
 * Run from apps/api: bun scripts/prepare-integrity-candidate.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const schema = path.resolve(import.meta.dir, '../prisma/schema.prisma');
const target = path.resolve(import.meta.dir, '../prisma/candidates/stage1-integrity/schema.prisma');

const fields: Record<string, string[]> = {
  Campus: [
    'campusRoles           UserRole[]',
    'campusPolicies        CampusPolicy[]',
    'restrictedCategories  RestrictedCategory[]',
    'sellerProfiles        SellerProfile[]',
  ],
  Category: [
    'parent               Category?            @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: NoAction, onUpdate: NoAction)',
    'children             Category[]           @relation("CategoryHierarchy")',
    'restrictedCategories RestrictedCategory[]',
  ],
  User: [
    'sessions              Session[]',
    'listingReviews        ListingReview[]      @relation("ListingReviewer")',
    'savedListings         SavedListing[]',
    'buyerThreads          InquiryThread[]',
    'reportedItems         Report[]             @relation("ReportReporter")',
    'assignedReports       Report[]             @relation("ReportAssignee")',
    'notifications         Notification[]',
    'auditLogs             AuditLog[]',
  ],
  UserRole: [
    'campus Campus? @relation(fields: [campusId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  Session: [
    'user User @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  CampusPolicy: [
    'campus         Campus          @relation(fields: [campusId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'listingReviews ListingReview[]',
  ],
  RestrictedCategory: [
    'campus   Campus   @relation(fields: [campusId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  SellerProfile: [
    'campus  Campus   @relation(fields: [campusId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'reports Report[] @relation("ReportSeller")',
  ],
  Listing: [
    'listingReviews ListingReview[]',
    'reports        Report[] @relation("ReportListing")',
    '@@index([status, categoryId, campusId, createdAt], map: "Listing_discovery_idx")',
  ],
  ListingReview: [
    'listing  Listing       @relation(fields: [listingId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'reviewer User          @relation("ListingReviewer", fields: [reviewerId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'policy   CampusPolicy? @relation(fields: [policyVersionId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  InquiryThread: [
    'buyer   User     @relation(fields: [buyerUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'handoff Handoff?',
  ],
  Handoff: [
    'thread InquiryThread @relation(fields: [inquiryThreadId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  SavedListing: [
    'user User @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  Report: [
    'reporter        User           @relation("ReportReporter", fields: [reporterUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'listing         Listing?       @relation("ReportListing", fields: [listingId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'seller          SellerProfile? @relation("ReportSeller", fields: [sellerProfileId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
    'assignedReviewer User?         @relation("ReportAssignee", fields: [assignedReviewerId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  AuditLog: [
    'actor User? @relation(fields: [actorUserId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
  Notification: [
    'user User @relation(fields: [userId], references: [id], onDelete: Restrict, onUpdate: Cascade)',
  ],
};

let contents = readFileSync(schema, 'utf8');
for (const [model, additions] of Object.entries(fields)) {
  const re = new RegExp('(model ' + model + ' \\{)([\\s\\S]*?)(\\n\\})');
  const matches = [...contents.matchAll(new RegExp(re.source, 'g'))];
  if (matches.length !== 1) throw new Error('Expected precisely one model ' + model);
  const body = matches[0][2];
  if (additions.some(a => body.includes(a))) {
    throw new Error('Candidate field already in source. Aborting: ' + model);
  }
  const attrs = additions.filter(a => a.startsWith('@@'));
  const relations = additions.filter(a => !a.startsWith('@@'));
  const extra = '\n  ' + [...relations, ...attrs].join('\n  ') + '\n';
  const index = body.search(/\n\s*@@/);
  const updated = index === -1 ? body + extra : body.slice(0, index) + extra + body.slice(index);
  contents = contents.replace(re, '$1' + updated + '$3');
}
contents = '// STAGE 1 CANDIDATE ONLY. DO NOT USE FOR APPLICATION GENERATION OR DEPLOYMENT.\n' +
  '// Source: prisma/schema.prisma; generated by scripts/prepare-integrity-candidate.ts.\n' + contents;
writeFileSync(target, contents, { flag: 'w' });
console.log('Prepared isolated candidate schema: ' + target);
console.log('Canonical prisma/schema.prisma has not been modified.');
