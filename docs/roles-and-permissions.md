# Roles and permissions (as implemented)

| Role | How it is granted | What the API allows |
|---|---|---|
| Visitor | Not signed in | Browse published listings, stores, categories, campuses, guidelines |
| Student buyer | Any registered account | Save listings, send inquiries, report, edit own profile |
| Verified student seller | Affiliation status `verified` | Open one store, create and submit own listings, upload photos |
| Campus reviewer | `user_roles` row with a `campus_id` | Verify affiliations and decide listings for that campus only |
| University admin | `user_roles` row, `campus_id` null = all campuses | Same as reviewer, across all campuses; analytics |
| System administrator | `user_roles` row | Infrastructure only. **Cannot approve listings** (see `permissions.ts`) |
| Approved campus establishment | Role exists in the schema | No establishment endpoints in v1 (directory deferred) |

Rules enforced in code: roles are loaded from the database on every request (never from the token); out-of-scope records return 404;
drafts and pending listings are never public; sellers can only touch their own listings and threads.
