# Supabase (optional accounts and progress sync)

Accounts are optional. Study progress lives in the browser (`localStorage`, `cs-*` keys);
signing in with an emailed magic link backs that whole document up to one row per user
and syncs it across devices. Without Supabase the app runs fully offline.

## Schema

`schema.sql` is the complete database: `public.progress`, with row-level security so a user
can only read and write their own row and a 16 MB cap on one account's document, and
`public.preview_access` (below). No policy names the `anon` role: a visitor who is not signed
in can read and write nothing.

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

## Reviewer preview access

`public.preview_access` lets Kevin open a closed course (`available: false` in `academy.js`)
for one person before it is public. It holds one row per reviewer email with the course ids
they may open. Row-level security lets a signed-in account read only the row for its own
email; nobody can write it through the publishable key. Grants are SQL:

```sql
-- grant (works before or after the reviewer's first sign-in)
insert into public.preview_access (email, courses, note)
values ('reviewer@example.com', '{socrates}', 'Learn to Learn contributor')
on conflict (email) do update set courses = excluded.courses, note = excluded.note;
-- add a course
update public.preview_access set courses = array_append(courses, 'anatomy') where email = 'reviewer@example.com';
-- revoke (closes the course on their next page load)
delete from public.preview_access where email = 'reviewer@example.com';
```

Course ids: `socrates` (Learn to Learn), `anatomy`, `reference` (Medicine), `neuro`, `lab`
(Alzheimer's Histology Lab). After sign-in, `auth.js` reads the row once and caches the course
list in the browser under
`cortex-preview-access-v1` (not a `cs-` key, so it never syncs or enters a backup);
`app.js` honours the cache only while that account owns the browser's saved work.

This is a presentation gate, not secrecy. The site is static and the repository is public, so
a closed course's files are downloadable by anyone who looks for them. The grant decides what
the site shows on cortexmedical.academy; keeping material off `main` is the only way to keep
it unpublished.

## Checks

`node scripts/check-auth-rls-readonly.mjs` proves read isolation between two dedicated
test accounts using tokens from `CORTEX_TEST_ACCOUNT_A_TOKEN` and
`CORTEX_TEST_ACCOUNT_B_TOKEN`. It performs no writes. The write policies were exercised
directly in the SQL Editor on 2026-09-06 (see `context/STATE.md`, local only).

A signed-out visitor's view can be checked from any terminal without reading a row. Both
counts must be `*/0`:

```sh
URL=https://<project>.supabase.co; KEY=<the publishable key from auth.js>
for t in progress preview_access; do
  curl -sI "$URL/rest/v1/$t?select=*" -H "apikey: $KEY" -H "Prefer: count=exact" | grep -i content-range
done
```

## Dashboard settings the repository cannot see

These live in the Supabase dashboard, so nothing here can test them. Check them after any
change to sign-in:

- **Authentication → URL Configuration.** Site URL `https://cortexmedical.academy`. Redirect
  URLs: that address and the localhost one, nothing with a `*`. A wildcard that covers Netlify
  preview addresses lets a stranger's pull-request preview receive a real sign-in link.
- **Authentication → Rate Limits.** Keep the email limits on; they bound how many sign-in
  emails the project will send.
- **Authentication → Attack Protection → Enable CAPTCHA protection.** A CAPTCHA stops the
  "Email me a link" form from being used to send mail to strangers. It is a code change
  first: `auth.js` has to pass a `captchaToken` with the sign-in request (and the provider's
  script and host have to be added to the Content-Security-Policy). Turning the toggle on
  before that ships breaks sign-in for everyone.
- **Advisors → Security.** It lists any table without row-level security.
- **Account.** Two-step sign-in on the Supabase account itself; it can read every row.

## Retired: `usage_events`

An earlier analytics table (`usage_events`) was only written by the retired UTSA Genetics,
CCMA and Cognitive Psychology modules. No shipped code references it. Its one policy lets
anyone holding the public key insert rows without limit, which can fill the database and stop
progress from saving. It must not exist in the live project with that policy.

Close it without losing the rows already collected (they stay readable in the dashboard):

```sql
drop policy if exists "anon insert events" on public.usage_events;
```

Or, once the old rows are exported or no longer wanted, remove it entirely:

```sql
drop table if exists public.usage_events;
```
