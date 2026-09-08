# Supabase (optional accounts and progress sync)

Accounts are optional. Study progress lives in the browser (`localStorage`, `cs-*` keys);
signing in with an emailed magic link backs that whole document up to one row per user
and syncs it across devices. Without Supabase the app runs fully offline.

## Schema

`schema.sql` is the complete database: one table, `public.progress`, with row-level
security so a user can only read and write their own row.

| column       | type        | notes                                             |
| ------------ | ----------- | ------------------------------------------------- |
| `user_id`    | uuid (PK)   | references `auth.users`, cascades on delete       |
| `data`       | jsonb       | the `cs-*` key/value document (strings as stored) |
| `updated_at` | timestamptz | set by the client; used as a compare-and-set token |

Sync protocol (`auth-progress.js`): the client reads the row, records `updated_at` as its
base revision, and only writes with `UPDATE … WHERE updated_at = <base>`. A zero-row
update, a duplicate insert, or a remote row that disappeared is surfaced to the person as
a conflict with both copies downloadable; nothing is overwritten silently. Guest work and
each account's work are kept in separate archived copies in the browser.

## One-time project setup

1. Create a project at supabase.com.
2. SQL Editor: run `schema.sql`.
3. Settings → API: the project URL and the **publishable** key go into the two constants at
   the top of `auth.js`. That key is meant to be public; row-level security is the
   protection, not key secrecy.
4. Authentication → URL Configuration: Site URL `https://cortexmedical.academy`; add
   `http://127.0.0.1:8765` to Redirect URLs for local testing.

## Checks

`node scripts/check-auth-rls-readonly.mjs` proves read isolation between two dedicated
test accounts using tokens from `CORTEX_TEST_ACCOUNT_A_TOKEN` and
`CORTEX_TEST_ACCOUNT_B_TOKEN`. It performs no writes. The write policies were exercised
directly in the SQL Editor on 2026-09-06 (see `context/STATE.md`, local only).

## Retired: `usage_events`

An earlier analytics table (`usage_events`, insert-only for the anon role) was only
written by the retired UTSA Genetics, CCMA and Cognitive Psychology modules. No shipped
code references it. If the table still exists in the project, drop it so the public key
cannot be used to fill it:

```sql
drop policy if exists "anon insert events" on public.usage_events;
drop table if exists public.usage_events;
```
