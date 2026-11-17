# CPSU STUDENT MARKETPLACE
## MASTER SYSTEM BLUEPRINT & AI DEVELOPMENT GOVERNANCE

**Document Version:** 1.0  
**Project:** CPSU Student Marketplace  
**Institution:** Central Philippines State University (CPSU)  
**Platform:** Responsive Web Application / Progressive Web Application (PWA)  
**Future Platform:** Android and iOS  
**Document Classification:** Primary System Development Reference  
**Status:** Approved Development Baseline

---

# PART I. MASTER DEVELOPMENT DIRECTIVE

## 1.1 Purpose

This document establishes the official system architecture, functional requirements, business rules, MVP boundaries, development standards, and implementation guidelines for the CPSU Student Marketplace.

All AI coding assistants, developers, and contributors MUST follow this document.

This document serves as the primary reference for:
- System planning.
- Requirements analysis.
- Database design.
- UI/UX implementation.
- Backend development.
- Frontend development.
- API development.
- Testing and quality assurance.
- Feature implementation.
- System maintenance.

## 1.2 System Vision

The CPSU Student Marketplace is a centralized digital platform that connects verified CPSU students through student-to-student buying, selling, exchanging, and service offerings.

The system aims to:

1. Provide students with access to affordable academic and personal resources.
2. Allow students to sell permitted pre-owned products.
3. Enable students to showcase their skills and offer legitimate services.
4. Improve communication and coordination between student buyers and sellers.
5. Encourage resource sharing and responsible student entrepreneurship.
6. Provide CPSU with a centralized platform for monitoring student marketplace activities.

## 1.3 Core Product Identity

The CPSU Student Marketplace is NOT intended to become a conventional commercial e-commerce platform.

Its identity is based on:

- Student-to-student transactions.
- Student services.
- Campus-based discovery.
- Resource sharing.
- Verified university community participation.

The platform must complement existing university establishments, not compete with or disrupt their operations.

---

# PART II. AI DEVELOPMENT GOVERNANCE

## 2.1 Mandatory AI Instructions

Every AI development agent working on this project MUST observe the following instructions.

### RULE 01 — Follow the Master Blueprint

This document is the authoritative reference for system requirements.

Do not independently redefine the system's purpose, modules, business rules, or MVP.

### RULE 02 — Respect MVP Boundaries

Only implement features included in the approved MVP.

Do not implement future-phase features unless explicitly authorized.

### RULE 03 — No Unauthorized Features

Do not introduce:
- Integrated payment gateways.
- Digital wallets.
- Escrow systems.
- Delivery management.
- Commission systems.
- Subscription plans.
- Commercial advertising systems.
- Vendor registration for external businesses.
- Public marketplace access.
- Unapproved monetization mechanisms.

These are outside the initial scope.

### RULE 04 — No Assumptions as Requirements

When a requirement is unclear:

1. Identify the ambiguity.
2. Explain its impact.
3. Present a recommended solution.
4. Wait for approval if it changes business logic or scope.

Do not silently invent requirements.

### RULE 05 — Preserve Existing Functionality

Before modifying existing code:

1. Inspect the existing implementation.
2. Identify affected components.
3. Check dependencies.
4. Understand existing database relationships.
5. Preserve working functionality.
6. Avoid unnecessary refactoring.

### RULE 06 — Database Integrity

Never independently:
- Delete existing database tables.
- Rename established columns.
- Change primary key structures.
- Remove existing relationships.
- Modify database constraints.

All structural changes must have a documented reason and migration strategy.

### RULE 07 — UI/UX Consistency

All interfaces must follow a unified design system.

Prioritize:
- Clean layouts.
- Clear navigation.
- Responsive behavior.
- Accessible interactions.
- Consistent components.
- Minimal cognitive load.
- Mobile-first usability.

Do not create unnecessary dashboards, widgets, or decorative elements.

### RULE 08 — Security and Privacy

Implement:
- Server-side authentication checks.
- Role-based access control.
- Input validation.
- Secure file uploads.
- Authorization checks.
- Protection against unauthorized data access.
- Appropriate audit logging.

Never expose sensitive student information to unauthorized users.

### RULE 09 — Functional Implementation

A user interface is not considered complete simply because it looks finished.

Every implemented feature must have:
- Working frontend interactions.
- Appropriate backend logic.
- Database integration when required.
- Input validation.
- Error handling.
- Loading states.
- Success and failure feedback.
- Permission enforcement.

Do not use mock data as a substitute for required production functionality.

### RULE 10 — Documentation

Every significant implementation must update the relevant documentation.

Maintain:
- Requirements documentation.
- Database documentation.
- API documentation.
- Development progress.
- Known issues.
- Testing results.
- Change history.

## 2.2 Feature Change Control

All proposed features must be classified into one of three categories.

| Classification | Meaning | Action |
|---|---|---|
| MVP | Included in Version 1.0 | Implement |
| Future | Approved for later versions | Document, do not implement |
| Out of Scope | Not part of the product direction | Do not implement |

If an AI agent identifies a potentially valuable feature that is not in the MVP, it must document it as a recommendation rather than automatically developing it.

---

# PART III. SYSTEM USERS AND ACCESS CONTROL

## 3.1 User Roles

The initial system has two primary user roles.

### ROLE 1 — Student

Students are the primary users of the marketplace.

They can:
- Register and authenticate.
- Manage their profiles.
- Browse listings.
- Search products and services.
- Publish products and services.
- Edit their listings.
- Communicate with other students.
- Submit purchase or service requests.
- Manage transactions.
- Save favorite listings.
- Report inappropriate content.
- Receive notifications.

### ROLE 2 — Administrator

Administrators are responsible for platform management and moderation.

They can:
- Access the administrative dashboard.
- Manage student accounts.
- Verify student accounts.
- Suspend and reactivate accounts.
- Monitor listings.
- Review reports.
- Remove prohibited listings.
- Monitor reported transactions.
- Manage categories.
- Publish announcements.
- Access marketplace analytics.
- Review administrative audit logs.

Administrative privileges must be restricted to authorized personnel.

## 3.2 Access Control Matrix

| Function | Student | Administrator |
|---|---:|---:|
| Browse listings | Yes | Yes |
| Search listings | Yes | Yes |
| Create listings | Yes | No |
| Edit own listings | Yes | No |
| Delete own listings | Yes | No |
| Send messages | Yes | No |
| Manage own transactions | Yes | Monitor |
| Save favorites | Yes | No |
| Report listings | Yes | Review |
| Verify students | No | Yes |
| Suspend accounts | No | Yes |
| Manage categories | No | Yes |
| View analytics | No | Yes |
| View audit logs | No | Yes |

Users must only access records and actions authorized by their assigned roles.

---

# PART IV. APPROVED SYSTEM MODULES

The following modules define the functional structure of the application.

## MODULE 01 — AUTHENTICATION AND STUDENT VERIFICATION

**Objective:** Ensure that only authorized CPSU students can participate in marketplace activities.

### Required Functions

- Student registration.
- Login and logout.
- University email verification.
- Student account verification.
- Password recovery.
- Account status management.
- Secure session management.

### Student Profile Fields

- Student ID.
- Full name.
- Email address.
- Campus.
- College.
- Course.
- Year level.
- Profile picture.
- Account verification status.

### Business Rules

1. Students must complete account verification before accessing marketplace transaction features.
2. Unverified accounts must not publish listings or initiate transactions.
3. Suspended accounts must not perform marketplace activities.
4. Students must not be able to modify their verification status.
5. Administrative verification decisions must be recorded.

The actual verification method must be finalized with CPSU's authorized offices before production deployment.

## MODULE 02 — MARKETPLACE LISTINGS

**Objective:** Allow verified students to publish permitted products.

### Required Functions

- Create product listings.
- Upload multiple images.
- Edit listings.
- Delete own listings.
- View listing details.
- Set product prices.
- Set product conditions.
- Set availability.
- Mark products as sold.
- Report listings.

### Required Listing Information

| Field | Description |
|---|---|
| Listing ID | Unique identifier |
| Seller ID | Owner of listing |
| Title | Product name |
| Description | Product details |
| Category ID | Product category |
| Price | Selling price |
| Condition | New, like new, good, fair |
| Images | Product photographs |
| Availability | Available, reserved, sold |
| Campus | Seller's campus |
| Created At | Listing creation date |
| Updated At | Last modification |

### Initial Product Categories

- Academic Materials.
- School Supplies.
- Electronics.
- Clothing and Accessories.
- Sports and Recreation.
- Dormitory Essentials.
- Others.

Categories must be manageable by administrators.

### Listing Rules

1. Only verified students can publish listings.
2. Students can modify only their own listings.
3. Students cannot directly modify another student's listings.
4. Prohibited products must not be allowed.
5. Listings must follow university marketplace policies.
6. Commercial food selling and activities that directly compete with authorized campus establishments require explicit university approval.

## MODULE 03 — STUDENT SERVICES

**Objective:** Allow students to showcase skills and offer legitimate services.

### Required Functions

- Create service listings.
- Edit service listings.
- Delete service listings.
- Upload portfolio images.
- Set service descriptions.
- Set service rates.
- Set availability.
- Receive service inquiries.
- Manage service requests.

### Initial Service Categories

- Graphic Design.
- Photography.
- Tutoring and Subject Coaching.
- Computer Troubleshooting.
- Programming and Technical Services.
- Illustration and Creative Services.
- Other Permitted Services.

### Service Rules

1. Only verified students can publish services.
2. Academic dishonesty is prohibited.
3. Service providers are responsible for their own service agreements.
4. All services must comply with university policies.
5. Services are managed separately from product listings at the business logic level.

## MODULE 04 — SEARCH AND DISCOVERY

**Objective:** Help students find relevant products and services.

### Required Functions

- Keyword search.
- Category filtering.
- Price filtering.
- Campus filtering.
- Product condition filtering.
- Sort by newest.
- Sort by price.
- Recently added listings.
- Popular listings.

### Homepage Sections

1. Featured Listings.
2. Recently Added.
3. Popular Listings.
4. Student Services.
5. Recommended Listings.
6. Campus-Based Listings.

### Discovery Rules

- Only active and available listings should appear in normal marketplace discovery.
- Sold products must not be presented as available products.
- Suspended users' listings must not be publicly accessible.
- Recommendations must be based on actual listing data and approved ranking logic.

Initial recommendation ranking may use:
- Listing recency.
- Listing views.
- Favorites.
- Inquiry activity.
- Campus relevance.

Do not introduce complex AI recommendation algorithms in Version 1.0.

## MODULE 05 — FAVORITES

**Objective:** Allow students to save listings for future reference.

### Required Functions

- Add to favorites.
- Remove from favorites.
- View saved listings.
- Display listing availability changes.

### Rules

- Each student may favorite a listing only once.
- Students must be authenticated.
- Students cannot favorite their own listings.
- Deleted or unavailable listings must be handled appropriately.

## MODULE 06 — MESSAGING

**Objective:** Facilitate direct communication between buyers and sellers.

### Required Functions

- Create conversations.
- Send messages.
- Receive messages.
- View conversation history.
- View related listing information.
- Send product inquiries.
- Send service inquiries.
- Block users.
- Report conversations or users.

### Rules

1. Only authenticated students can communicate.
2. Conversations must be associated with relevant marketplace interactions.
3. Students must not access conversations they are not part of.
4. Messages must be stored securely.
5. Users must be able to report inappropriate communication.

## MODULE 07 — TRANSACTION MANAGEMENT

**Objective:** Provide a structured way to coordinate student transactions.

### Required Functions

- Submit purchase requests.
- Accept requests.
- Reject requests.
- Negotiate transaction details through messaging.
- Confirm meetup arrangements.
- Update transaction status.
- Cancel transactions.
- Confirm completion.

### Transaction Statuses

| Status | Meaning |
|---|---|
| Pending | Request submitted |
| Accepted | Seller accepted |
| Negotiating | Parties discussing terms |
| For Meetup | Meetup agreed |
| Completed | Transaction confirmed |
| Cancelled | Transaction cancelled |

### Transaction Rules

1. No integrated payment processing in Version 1.0.
2. No digital wallet.
3. No escrow.
4. No automatic delivery management.
5. The buyer and seller coordinate payment and meetup independently.
6. Both parties must have appropriate permissions to update transaction information.
7. Status changes must be recorded.
8. Completed transactions may be used for ratings.

## MODULE 08 — NOTIFICATIONS

**Objective:** Inform students about relevant marketplace activities.

### Required Notifications

- New messages.
- Purchase requests.
- Request acceptance or rejection.
- Transaction status updates.
- Listing availability changes.
- Favorite listing updates.
- Account verification results.
- Marketplace announcements.

Version 1.0 should prioritize in-app notifications.

Push notifications and additional delivery channels may be implemented in later versions.

## MODULE 09 — ADMINISTRATION AND MODERATION

**Objective:** Provide authorized CPSU personnel with centralized marketplace management.

### User Management

- View students.
- Verify accounts.
- Suspend accounts.
- Reactivate accounts.
- Review user reports.

### Listing Management

- View listings.
- Review reported listings.
- Remove prohibited content.
- Manage categories.
- Monitor listing activity.

### Transaction Monitoring

- View transaction records.
- Review reported transactions.
- Investigate complaints.
- Monitor completion statistics.

### Announcements

- Create announcements.
- Edit announcements.
- Publish announcements.
- Archive announcements.

### Analytics

- Total registered students.
- Verified students.
- Active students.
- Active listings.
- Completed transactions.
- Popular categories.
- Campus participation.
- Reported listings.
- Monthly activity.

## MODULE 10 — REPORTING AND AUDIT LOGS

**Objective:** Support accountability and administrative monitoring.

### Reporting

Students can report:
- Prohibited listings.
- Suspicious accounts.
- Inappropriate messages.
- Fraudulent behavior.
- Misleading product descriptions.

Administrators can:
- Review reports.
- Assign report status.
- Record investigation findings.
- Take moderation action.
- Close reports.

### Audit Logs

Record important administrative actions, including:

- Account verification.
- Account suspension.
- Account reactivation.
- Listing removal.
- Category modification.
- Report resolution.
- Administrative configuration changes.

Audit logs must include the responsible administrator, action, affected record, and timestamp.

---

# PART V. STRICT MVP DEFINITION — VERSION 1.0

This section defines the non-negotiable initial development scope.

The AI development agent MUST use this section to determine what should and should not be implemented.

## 5.1 MVP Objective

Deliver a functional student marketplace that enables verified CPSU students to:

1. Register and access the platform.
2. Publish permitted products and services.
3. Browse and search marketplace listings.
4. Communicate with other students.
5. Coordinate transactions.
6. Manage their own listings and transactions.
7. Receive important notifications.

Administrators must be able to manage accounts, moderate content, and monitor platform activity.

## 5.2 MVP Feature Checklist

| ID | Feature | Priority | Scope |
|---|---|---|---|
| MVP-001 | Student registration | Critical | Included |
| MVP-002 | Login and logout | Critical | Included |
| MVP-003 | Student verification | Critical | Included |
| MVP-004 | Student profile | High | Included |
| MVP-005 | Product listings | Critical | Included |
| MVP-006 | Service listings | High | Included |
| MVP-007 | Listing image uploads | High | Included |
| MVP-008 | Marketplace categories | High | Included |
| MVP-009 | Search and filtering | Critical | Included |
| MVP-010 | Recently added listings | High | Included |
| MVP-011 | Popular listings | Medium | Included |
| MVP-012 | Favorites | Medium | Included |
| MVP-013 | Student messaging | Critical | Included |
| MVP-014 | Purchase requests | Critical | Included |
| MVP-015 | Transaction management | Critical | Included |
| MVP-016 | In-app notifications | High | Included |
| MVP-017 | Listing reports | High | Included |
| MVP-018 | User reports | High | Included |
| MVP-019 | Admin dashboard | Critical | Included |
| MVP-020 | User management | Critical | Included |
| MVP-021 | Listing moderation | Critical | Included |
| MVP-022 | Category management | High | Included |
| MVP-023 | Basic marketplace analytics | High | Included |
| MVP-024 | Administrative audit logs | High | Included |

## 5.3 Explicitly Excluded Features

The following features are NOT part of Version 1.0.

| Feature | Decision |
|---|---|
| Integrated online payments | Excluded |
| Digital wallet | Excluded |
| Escrow | Excluded |
| Delivery management | Excluded |
| External business/vendor registration | Excluded |
| Commission collection | Excluded |
| Subscription plans | Excluded |
| Paid advertisements | Excluded |
| Public guest transactions | Excluded |
| AI chatbot | Excluded |
| Advanced recommendation engine | Excluded |
| Loyalty and reward points | Excluded |
| Auction and bidding | Excluded |
| Live streaming | Excluded |
| Cryptocurrency payments | Excluded |

AI agents must not implement excluded features without an explicit scope revision.

## 5.4 MVP Completion Criteria

Version 1.0 is considered functionally complete only when:

- Students can register and authenticate.
- Verification restrictions work correctly.
- Students can publish and manage their listings.
- Students can publish and manage service offerings.
- Students can discover listings.
- Search and filtering return accurate results.
- Students can communicate.
- Transaction requests work.
- Transaction statuses are properly managed.
- Notifications are generated for required events.
- Reporting and moderation work.
- Administrators can manage users and listings.
- Analytics reflect actual database records.
- Audit logs record required administrative actions.
- Security and authorization tests pass.
- The application works on mobile and desktop browsers.

A visually completed interface does not constitute MVP completion.

---

# PART VI. APPLICATION STRUCTURE

## 6.1 Student Application Navigation

The student application must use a simple and predictable navigation structure.

### Primary Navigation

1. Home
2. Explore
3. Sell / Offer
4. Messages
5. Profile

### Home

Contains:
- Search bar.
- Featured listings.
- Categories.
- Recently added.
- Student services.
- Popular listings.

### Explore

Contains:
- Search functionality.
- Category filters.
- Price filters.
- Campus filters.
- Sorting options.

### Sell / Offer

Provides two primary actions:

- Sell a Product.
- Offer a Service.

### Messages

Contains:
- Conversation list.
- Message history.
- Related listing.
- Message input.

### Profile

Contains:
- Student information.
- My Listings.
- My Services.
- My Transactions.
- Favorites.
- Account Settings.

## 6.2 Administrative Application Navigation

1. Dashboard.
2. Students.
3. Listings.
4. Transactions.
5. Reports.
6. Categories.
7. Announcements.
8. Analytics.
9. Audit Logs.
10. Settings.

The administrative interface must be separate from the student-facing experience.

---

# PART VII. DATA ARCHITECTURE

## 7.1 Core Database Entities

The following tables define the initial database structure.

| Table | Purpose |
|---|---|
| users | Authentication and user records |
| student_profiles | Student information |
| campuses | Campus directory |
| colleges | College directory |
| categories | Marketplace categories |
| listings | Product and service listings |
| listing_images | Listing photographs |
| favorites | Saved listings |
| conversations | Messaging conversations |
| messages | Individual messages |
| transactions | Transaction records |
| transaction_status_logs | Transaction history |
| reviews | Transaction reviews |
| reports | Reported users and listings |
| notifications | In-app notifications |
| announcements | Marketplace announcements |
| admin_logs | Administrative audit records |

## 7.2 Database Standards

1. Use primary keys and foreign keys.
2. Use appropriate indexes.
3. Maintain referential integrity.
4. Use timestamps for important records.
5. Use soft deletion where appropriate.
6. Maintain transaction status history.
7. Avoid unnecessary duplicate information.
8. Validate data on both client and server.
9. Use database migrations for structural changes.
10. Do not store passwords in plain text.

## 7.3 Listing Type Architecture

Products and services must be logically distinguishable.

The initial system may use a shared listings table with a listing_type field:

- product
- service

The interface and validation rules must adapt according to the listing type.

For example:

A product requires:
- Condition.
- Selling price.
- Product images.

A service requires:
- Service description.
- Service rate.
- Availability.
- Optional portfolio images.

Do not create separate duplicated marketplace engines for products and services.

---

# PART VIII. UI/UX DEVELOPMENT STANDARDS

## 8.1 Design Philosophy

The application should feel like a modern student community marketplace.

Design characteristics:

- Modern.
- Minimalist.
- Friendly.
- Professional.
- Accessible.
- Mobile-first.

Avoid:
- Overly complicated dashboards.
- Excessive animations.
- Unnecessary gradients.
- Excessive decorative elements.
- Cluttered product cards.
- Unnecessary confirmation dialogs.

## 8.2 Responsive Requirements

The application must support:

- Mobile phones.
- Tablets.
- Desktop computers.
- Different screen resolutions.

Mobile must be treated as the primary student experience.

Administrative operations should be optimized for desktop while remaining responsive.

## 8.3 Design System Requirements

Maintain reusable:

- Buttons.
- Inputs.
- Dropdowns.
- Modal dialogs.
- Product cards.
- Service cards.
- Navigation components.
- Notification components.
- Tables.
- Status badges.
- Empty states.
- Loading states.
- Error messages.

Do not implement inconsistent UI patterns across modules.

---

# PART IX. SECURITY AND DATA PRIVACY

The system must follow applicable Philippine data privacy requirements, including the Data Privacy Act of 2012 and relevant university policies.

Mandatory controls:

1. Secure authentication.
2. Server-side authorization.
3. Role-based access control.
4. Secure password hashing.
5. Input validation.
6. Secure image upload handling.
7. Protection against SQL injection.
8. Protection against cross-site scripting.
9. Appropriate session management.
10. Audit logging.
11. Restricted administrative access.
12. Appropriate data retention and deletion procedures.

Student ID numbers and other personal information must not be unnecessarily displayed publicly.

The system must follow data minimization principles.

---

# PART X. TESTING AND QUALITY ASSURANCE

## 10.1 Required Testing

Every module must undergo:

- Functional testing.
- Validation testing.
- Authorization testing.
- Database testing.
- Responsive testing.
- Error handling testing.
- Integration testing.

## 10.2 Required Test Scenarios

Examples:

**Authentication**
- Unverified students cannot publish listings.
- Suspended students cannot initiate transactions.
- Invalid login credentials are rejected.

**Listings**
- Students can edit only their own listings.
- Invalid product prices are rejected.
- Sold listings cannot be purchased as available products.

**Messaging**
- Unauthorized students cannot access private conversations.
- Messages are associated with the correct participants.

**Transactions**
- Invalid status transitions are rejected.
- Only authorized participants can manage a transaction.
- Status history is recorded.

**Administration**
- Students cannot access administrative functions.
- Administrative actions are recorded.
- Unauthorized users cannot verify accounts.

## 10.3 Definition of Done

A feature is complete only when:

- Requirements are satisfied.
- UI is implemented.
- Backend functionality works.
- Database integration works.
- Permissions are enforced.
- Validation is implemented.
- Error handling is implemented.
- Testing is completed.
- Documentation is updated.

---

# PART XI. DEVELOPMENT WORKFLOW FOR AI AGENTS

AI agents must follow this development sequence.

## STEP 1 — PROJECT INSPECTION

Before writing code:

- Inspect the repository.
- Identify the framework.
- Inspect existing architecture.
- Inspect database structure.
- Identify existing components.
- Review dependencies.
- Identify incomplete modules.

Do not immediately start coding.

## STEP 2 — REQUIREMENTS MAPPING

Map the requested task to:

- Approved module.
- Functional requirement.
- Business rule.
- MVP classification.
- Database impact.
- UI impact.
- Security impact.

## STEP 3 — IMPLEMENTATION PLANNING

Before significant development:

- Identify affected files.
- Define required changes.
- Identify dependencies.
- Identify potential risks.
- Define testing requirements.

## STEP 4 — IMPLEMENTATION

Implement only the approved scope.

Follow established coding conventions and architecture.

Avoid unnecessary refactoring.

## STEP 5 — TESTING

Test:
- Expected behavior.
- Invalid inputs.
- Permission restrictions.
- Error handling.
- Database operations.
- Responsive behavior.

## STEP 6 — DOCUMENTATION

Update:
- Progress records.
- Requirements status.
- Database documentation.
- API documentation.
- Known issues.

## STEP 7 — COMPLETION REPORT

After implementation, provide:

1. Features implemented.
2. Files created.
3. Files modified.
4. Database changes.
5. Tests performed.
6. Test results.
7. Known limitations.
8. Remaining tasks.

Do not claim completion without verification.

---

# PART XII. PROJECT DOCUMENTATION STRUCTURE

Maintain the following project documentation.

```text
CPSU-STUDENT-MARKETPLACE/
│
├── MASTER_BLUEPRINT.md
│
├── docs/
│   ├── SYSTEM_OVERVIEW.md
│   ├── FUNCTIONAL_REQUIREMENTS.md
│   ├── NON_FUNCTIONAL_REQUIREMENTS.md
│   ├── BUSINESS_RULES.md
│   ├── USER_ROLES_PERMISSIONS.md
│   ├── DATABASE_DESIGN.md
│   ├── API_DOCUMENTATION.md
│   ├── UI_UX_GUIDELINES.md
│   ├── SECURITY_GUIDELINES.md
│   ├── TESTING_STRATEGY.md
│   ├── MVP_SCOPE.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── CHANGELOG.md
│
├── progress/
│   ├── IMPLEMENTATION_STATUS.md
│   ├── KNOWN_ISSUES.md
│   └── DEVELOPMENT_LOG.md
│
└── src/
    └── Application Source Code
```

The actual source code directory may differ depending on the selected framework.

Documentation must reflect the actual implementation rather than an assumed architecture.

---

# PART XIII. CHANGE MANAGEMENT

Any proposed modification to the approved blueprint must follow this process:

1. Identify the requested change.
2. Identify the affected module.
3. Determine whether it affects MVP scope.
4. Assess database impact.
5. Assess security impact.
6. Assess existing functionality.
7. Document the proposed modification.
8. Obtain project owner approval.
9. Update the master blueprint or relevant specification.
10. Implement the approved change.

Never silently modify approved requirements.

## Approved change record — C5 purchase requests and C1a transaction participation (2026-11-16)

**Decision:** Project owner approved WP3 C5 Approach A with student-only participation under C1a, and authorized test-first implementation **with schema migrations confined to an isolated local test database**. Development and production databases, live credentials, deployment and release remain outside this approval.

- **Eligible participants:** Active, verified CPSU students with no administrative or establishment roles. University/campus reviewers and administrators monitor only, including when they also have a student affiliation. This decision resolves C1a for transaction actions; broader staff marketplace capabilities remain a separate policy question.
- **Workflow:** Buyer submits a request (pending), active seller accepts or rejects; either participant may negotiate through existing inquiry chat; both independently confirm meetup before status `for_meetup`, then both independently confirm completion before `completed`. Neither chat reads nor a `Handoff` update can silently confirm a transaction.
- **Rejection/cancellation:** Rejected and withdrawn requests become `cancelled` with a recorded reason/event (no seventh status). Before completion either participant can cancel unilaterally with a required reason and an immutable audit/history entry, including after meetup agreement. `completed` and `cancelled` are terminal.
- **Inventory:** For physical products, seller acceptance atomically and exclusively changes available → reserved, cancellation releases only its own reservation, and mutual completion marks the listing sold permanently under approved C4. Service listings are not auto-reserved/sold. One active request per buyer/listing inquiry thread; fresh requests allowed after terminal status.
- **Trust:** Completion is a mutual **self-report**, not CPSU-verified payment, shipment or sale. No integrated payment, escrow, wallet or courier. Existing `Handoff` records remain intact and separate from the canonical transaction status.
- **Security and storage:** Server-owned participant identity and price snapshot, participant-only transaction access, append-only status logs, conditional transactional status updates, bounded pagination, authorized campus administration monitoring, in-app notifications, isolated test DB regression before any future deployment.
- **Reference:** `docs/superpowers/specs/2026-11-16-wp3-transaction-design.md` and `docs/superpowers/plans/2026-11-16-wp3-transactions.md`.

---

## Approved change record — C4 listing condition and availability (2026-11-11)

**Decision:** Project owner explicitly approved C4 and authorized Stage 1 development migration deployment and WP2 implementation. This resolves **C4 only**; C1, C1a, C2, C3, C5, C6 and C7 remain separately gated.

- **Affected MVP modules:** 02 Product Listings, 03 Student Services, 04 Search, 05 Favorites, 06 Messaging; additional integrity and testing under PART VII/X.
- **Scope:** Existing MVP listing completeness, not an expansion into payments, verified sales, shipping or transactions.
- **Condition:** Product-only enum `new | like_new | good | fair`; required when a product is *submitted for review*. Service conditions remain null. Existing products can remain condition-null until the seller updates them, without inventing historical condition data.
- **Availability:** Dedicated enum `available | reserved | sold`, independent of moderation `Listing.status`. New discovery and inquiries include only `available`; direct published detail and historical conversations may display reserved/sold with accurate labeling. An owner can set availability on a published listing; `sold` is terminal, so a different item requires a new listing.
- **Deletion:** Seller-only soft deletion via `deletedAt`. Active discovery and new inquiries hide deleted items. Messages, moderation, reports, saves and audit history remain in storage subject to future approved privacy/retention policy.
- **Favorites:** Owners cannot save their own listings. Unavailable listings cannot receive new saves; existing favorites remain removable.
- **Database:** Additive migrations; retain legacy `availability` for compatibility; canonical `availabilityState`; no destructive backfill. Stage 1 retains 19 restrictive FK constraints and listing discovery index. Foreign-key deletion behavior remains subject to institutional retention/privacy review before production deployment.
- **Security:** Owner checks, reviewer scope, audit changes, request validation, no access to other sellers' private listings.
- **Implementation verification:** Integration tests, API/web/mobile typechecks, web build; record any incomplete QA without claiming launch readiness.
- **Deployment:** This approval covers the local **development database only**; production requires a separate gate. Changes must not overwrite unrelated uncommitted work.

---

## Approved change record — Private Google Drive listing-photo storage adapter (2026-11-16)

**Decision:** The project owner requested transferring marketplace upload storage to Google Drive. This authorizes preparing an opt-in Google Drive-backed storage implementation for **existing MVP listing photos only**, not automatic activation or a nonlocal data transfer without account consent, verified backup, or privacy approval.

- **Affected modules:** 02 Product Listings, 03 Student Services (photo uploads), media serving and infrastructure.
- **Storage:** Default local mode is retained. App-owned private Google Drive files use narrow operator-authorized `drive.file` OAuth and server-side proxying through the same authenticated and moderated media API. No direct public Drive links or student Google account access is authorized.
- **Preservation:** Old media paths continue to work. Migration must be deliberate, backup-gated, checksum-verified, and leave local originals untouched until restored copies are proven. No database schema or photo moderation workflow changes.
- **Privacy:** Google-hosted student photos require CPSU's data-protection approval, documented retention and vendor/data-residency assessment before real-data activation.
- **Verification/deployment:** Mocked storage unit tests and local typechecks are not Google live acceptance. Production OAuth configuration, transfer, cutover, storage monitoring and backup/restore remain separate gates.
- **Reference:** `docs/GOOGLE_DRIVE_MEDIA_MIGRATION_2026-11-16.md`.

---

## Approved change record — Five-photo maximum per listing (2026-11-16)

**Decision:** The project owner explicitly approved reducing the upload maximum from 6 to **5 photos per listing**, with fewer photos permitted.

- **Scope:** Applies to product and service listings, independent of local or private Google Drive storage. Keep the existing requirement for at least one photo before submitting for campus review; drafts may have zero photos.
- **Enforcement:** The seller API checks before receiving the image and again in the database transaction. The seller interface displays the five-photo limit and disables additional uploads once reached. On 2026-11-16 the owner reported that the picker selected only one photo; the approved usability correction allows selecting multiple JPEG/PNG/WebP photos at once (up to remaining slots) and submits them sequentially through the existing single-image endpoint, with per-batch progress, pre-validation and explicit partial-success handling.
- **Data preservation:** Do not delete photos or alter records for pre-existing six-photo listings. Those listings remain viewable but cannot accept new photos while above the new limit.
- **No schema change:** The `ListingMedia` schema and private media-serving authorization stay unchanged.
- **Verification:** Unit policy tests, API TypeScript check, and web production build. Production rollout remains separately gated.

---

# PART XIV. FINAL MASTER INSTRUCTION TO AI

You are an AI software development agent assigned to the CPSU Student Marketplace project.

Your responsibility is to develop the system according to this master blueprint.

You must act as a disciplined software engineer, not an autonomous product decision-maker.

Your priorities, in order, are:

1. Requirements compliance.
2. MVP scope protection.
3. Functional correctness.
4. Security and data privacy.
5. Database integrity.
6. Maintainable architecture.
7. Consistent UI/UX.
8. Performance and usability.
9. Documentation.
10. Future scalability.

Before implementing any task, verify that it belongs to the approved MVP or an explicitly authorized scope revision.

If the requested implementation conflicts with this blueprint:

- Do not silently choose a solution.
- Explain the conflict.
- Identify the affected requirement.
- Recommend the safest approach.
- Request approval when necessary.

If a requested feature belongs to a future development phase, document it without implementing it.

Do not remove, replace, or redesign existing working functionality without authorization.

Do not declare a module complete based solely on visual implementation.

All features must be functional, tested, and documented.

**THE MASTER BLUEPRINT IS THE SINGLE SOURCE OF TRUTH FOR THE CPSU STUDENT MARKETPLACE.**

All AI agents and developers must follow it.

---

## Approved change record — Reviewer account separation (2026-11-16)

The project owner chose dedicated staff-only reviewer accounts, separate from student participation. Global university administrators may create campus reviewer accounts and edit their name, email, campus assignment, account status, and password. Reviewer accounts do not receive student affiliations on creation. Staff roles cannot sell, message as buyers or sellers, save listings, report as students, or participate in student transactions. Public browsing and authorized campus moderation remain available. Existing mixed-role accounts keep historical records but lose student action access. Only the campus reviewer role can be assigned by this management workflow; university and system administrator roles remain outside it. Changes are validated, audited, and sensitive account edits revoke refresh sessions. No new database table is required.

## Superseded change record — Seller profile pictures (2026-11-17)

This original pending-review design was superseded later the same day by the explicit **instant publication after upload** decision below. Keep this paragraph for design history only; do not implement its review requirements.

The project owner requested seller profile pictures. Sellers with an approved store may upload one independent profile picture; the image is validated, decoded, stripped of metadata, square-cropped to WebP, and held **private pending campus review**. Approved pictures are displayed on public store pages and seller identity on listings; existing avatars remain public until a replacement is approved, and initials are used when no public avatar exists. Sellers can withdraw pending pictures and remove approved pictures. Only authorized campus reviewers or global university administrators may approve/reject a pending picture after human inspection and a written reason. Review decisions and image changes are audited; the user receives a review notification. Existing listing-photo moderation is unchanged. Only the active app-configured private image-storage adapter may be used; no new paid service or new public Drive sharing. The additive two-column migration must be separately approved, backed up and verified before activation; its source-file creation is not deployment or permission to change any live database.

## Approved change record — Dedicated seller storefronts (2026-11-17)

The project owner provided marketplace shop examples and requested a **specific store for each seller with a profile picture the seller manually selects and uploads**. The existing ID-based public store route (`/stores/:id`) now presents that seller's own name, approved profile picture or initials, verified campus affiliation, store description, opened date, number of available published listings, and searchable/filterable products and services. The seller can manage the store name and description from the existing seller dashboard; store editing is owner-only, validated and audited. The profile photo is never selected or uploaded automatically: the seller explicitly chooses it. The later instant-publication decision below supersedes the earlier review workflow. Explore search can surface links to the stores represented in the current page of results, without implying comprehensive ranking. No invented followers, ratings, coupons, purchases or payment promises. No new paid storage or third-party APIs, database tables, migration or automatic publication of images are introduced by this storefront layout. The existing seller-profile-photo migration approval gate remains in force.

## Approved change record — Immediate seller profile photo publication (2026-11-17)

The project owner explicitly removed the requirement for human review of **seller/store profile pictures only**. After the authorized seller manually chooses and uploads a valid JPEG, PNG, or WebP picture (up to 3 MB), the server decodes, validates and converts it to a square 512×512 WebP with metadata removed, then stores it directly as the public profile picture. No reviewer queue, approval status for individual avatar uploads, or pending-avatar field is required. Replacement is transactional, checked for concurrent changes, and audited; the previous stored photo is deleted only after the replacement succeeds. Sellers may replace or remove their picture anytime, and initials appear when there is no picture. The existing student reporting mechanism handles prohibited/misleading store content after publication. **Image file validation is not explicit-content classification**; automatic publication cannot certify that an image complies with content rules. Seller verification and product-listing photo review remain unchanged. The prepared additive seller-avatar migration has not yet been applied and requires a separate backed-up, isolated-test and development-activation gate. No live database, deployment, commit or push is authorized by this source revision.

## Approved change record — Local seller-avatar explicit-image screening (2026-11-17)

The owner authorized adding automated explicit-content screening **for manually selected seller/store profile photos** before automatic publication. The API must validate/sanitize each image, run a local server-side NSFWJS MobileNetV2 classifier against the sanitized picture, and publish only a clearly safe result. Clearly explicit uploads are rejected, ambiguous or malformed classifications are withheld (seller can choose another photo), and classifier/model failures block new publication (fail closed). No file is sent to Google Drive or made publicly visible before a successful screening result; existing approved pictures remain unchanged when replacement is rejected. Rate-limit per authenticated seller and serialize CPU inference. The model is bundled with the pinned application dependency and runs on the server rather than sending images to an outside moderation service. No new vendor API, database table, or human avatar-review queue is required. Existing seller-affiliation verification, product-listing photo review, reports, and moderation powers are preserved. The model is imperfect: it can make both false-positive and false-negative decisions, and release should include controlled explicit-image sensitivity testing, monitoring, and continued user-report handling. This feature does not assert that all objectionable content is detectable. No production/staging deployment, database migration or real student data change is approved by the source-only implementation.

**END OF MASTER BLUEPRINT**

Document Version: 1.0  
Project: CPSU Student Marketplace  
Scope: MVP Version 1.0
