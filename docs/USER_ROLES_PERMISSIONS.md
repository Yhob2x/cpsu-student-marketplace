# User roles and permissions

**Blueprint target (PART III):** two primary roles — **Student** and **Administrator** — with the access matrix in §3.2.
**As-built:** a finer-grained role set, documented below. Reconciling the two is conflict **C1** in `docs/MVP_SCOPE.md` §4 and needs
owner approval; nothing has been changed.

## 1. Blueprint roles → implemented roles

| Blueprint role | Implemented equivalent | Notes |
|---|---|---|
| Student | Any authenticated `User` | No role row needed. Buyer and seller are the same account. |
| Administrator | `university_admin` (all campuses) or `campus_reviewer` (one campus) | The pilot splits Administrator into a campus-scoped reviewer and a global admin, which is stricter than the blueprint. |
| — (no blueprint equivalent) | `system_admin` | Infrastructure role. Deliberately **cannot** approve listings; unit-tested in `apps/api/test/permissions.test.ts`. |
| — (no blueprint equivalent) | `establishment` | Reserved for a deferred campus-establishment directory; no endpoints in v1. |
| Visitor (unauthenticated) | Allowed to browse published listings | See conflict **C3**: the blueprint matrix lists only Student and Administrator. |

Roles live in `UserRole` with an optional `campusId`; `campusId = null` on a `university_admin` means "all campuses".
A person can hold several roles.

## 2. Role assignment

- Roles are created only by database/seed operations (or a future admin UI). There is **no API to grant a role**.
- Changing a role requires infrastructure access; every review decision it enables is still audited.
- Roles are never trusted from a token: `authenticate` (in `apps/api/src/auth.ts`) loads the user and roles from MySQL on every request,
  and rejects non-`active` users.

## 3. Authorization primitives

| Helper | File | Behavior |
|---|---|---|
| `canReview(user, campusId)` | `src/permissions.ts` | True for a `campus_reviewer` on that campus, or a `university_admin` with `campusId` null or matching. `system_admin` always false. |
| `reviewCampusIds(user)` | `src/permissions.ts` | `'all'` for a global admin, otherwise the list of campus ids. |
| `requireAuth` | `src/auth.ts` | `401 unauthenticated`. |
| `requireReviewer` | `src/auth.ts` | `401`, then `403` when the resolved scope is empty. |
| `scope(user)` | `routes/admin.ts` | Turns scope into a Prisma `where` fragment for list queries. |

## 4. Capability matrix as implemented

| Function | Student | Campus reviewer | University admin | System admin | Visitor |
|---|---:|---:|---:|---:|---:|
| Browse / search / view published listing | Yes | Yes | Yes | Yes | Yes |
| Open a store | Verified only | — | — | — | No |
| Create / edit own listing | Verified + store | No | No | No | No |
| Delete own listing | **Not built** | — | — | — | — |
| Send / read own inquiries | Yes | No* | No* | No* | No |
| Save favorites | Yes | Yes | Yes | Yes | No |
| Report a listing | Yes | Yes | Yes | Yes | No |
| Review affiliation / listing (own campus) | No | Yes | Yes | No | No |
| Suspend a listing | No | Yes | Yes | No | No |
| Suspend / reactivate an account | **Not built** | — | — | — | — |
| Manage categories | **Not built** | — | — | — | — |
| View analytics (campus-scoped, suppressed <5) | No | Yes | Yes | No | No |
| Resolve reports | No | Yes | Yes | No | No |
| View audit logs | **Not built** | — | — | — | — |

\* Reviewers and admins are not barred from messaging as ordinary students: role rows do not remove student abilities. The blueprint's
matrix says an Administrator does not send messages; this is a minor divergence to confirm (conflict **C1a**).

## 5. Enforcement patterns worth preserving

1. **Out-of-scope is indistinguishable from nonexistent.** Decisions, suspensions, affiliation verification, media, threads, and listings all
   return `404` rather than `403` so record ids cannot be probed.
2. **Ownership is checked from the database, never from the request body.** `ownListing` and `participantThread` join through the owner.
3. **Client-supplied campus, seller, or role values are ignored.** Seller campus comes from the store; verification comes from the
   affiliation table.
4. **Public payloads are shaped by `publicListing()`**, which whitelists fields — so a seller's email can never leak through an include.
