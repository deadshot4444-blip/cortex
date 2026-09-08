# Milestone 2.27: bounded educator workflow

Decision: deferred experiment, excluded from the stable local candidate. The
current application synchronizes a private progress row per account. It has no
group-membership, assignment or shared-artifact backend. A browser-only role
selector would not enforce access. No production database or permission settings
were changed. No educator or learner pilot is claimed.

The workflow proposed for a partner is deliberately small: an educator assigns
two existing lesson links for one study week; learners independently accept the
invitation, study in their own workspaces, and optionally share selected portfolio
artifacts with that educator. The educator provides optional written feedback.
Class grades, group chat, leaderboards, public profiles and whole-progress access
are outside the proposed pilot.

## Concrete journey

1. An authenticated educator drafts a group name, short purpose and an assignment
   naming current curriculum IDs, title snapshots, instructions, expected minutes,
   an explicit timezone and start/due times. Drafts are private until published.
2. The educator creates a limited-use, expiring invitation. The invitation reveals
   the purpose, organizer display name, assignment window and exactly what joining
   allows. Opening a link does not enroll its recipient. No sign-in email is sent
   by this workflow without the recipient requesting it.
3. A signed-in learner explicitly accepts. The roster uses an opaque account ID
   and chosen display name, not email or institution/student identifiers. Members
   do not receive a peer roster or other learners' work by default.
4. The learner opens assigned lessons normally. Assignment status is separate from
   personal completion and learning evidence. The due window is informational;
   falling behind does not block a personal course or erase work.
5. Sharing begins with nothing selected. The learner sees the exact artifact
   snapshot, recipient, purpose, expiry and withdrawal behavior before confirming.
   Shared fields preserve original writing, later revisions and assistance. No
   whole progress JSON, account token, private notes or unrelated artifact is sent.
6. The educator sees only explicitly shared snapshots for that group, and can add
   feedback to an active share. Feedback is attributed to its author; it does not
   become a credential, validated assessment or medical signoff.
7. Revoking a share removes future server access for the educator. Leaving the
   group revokes all active shares and invitations applicable to that membership,
   stops notifications, and preserves the learner's personal course and portfolio.
   An educator can archive a group without deleting personal work.

Previously viewed or downloaded copies cannot be remotely recalled. The sharing
preview must state this plainly. Prevent routine downloads during the first pilot
unless the partner workflow needs them; this still cannot prevent screenshots.

## Required server boundary before implementation is enabled

Use distinct records for groups, memberships, invitations, assignments, shares
and feedback. Never grant an educator access to the private progress table.

| Resource | Organizer | Joined learner | Peer / outsider |
| --- | --- | --- | --- |
| Private group draft | Own groups only | None | None |
| Published assignment | Own groups | Active memberships only | None |
| Roster | Minimal members of own group | Own membership only | None |
| Personal course / portfolio | Own personal work only | Own personal work only | None |
| Shared artifact | Current grants to this organizer | Own shares only | None |
| Feedback | Write to an active permitted share | Read feedback on own share | None |
| Revoke / leave | Archive own group; no personal deletion | Revoke own shares; leave self | None |

Authenticate the actor on the server, never from a request's asserted role or
user ID. Enforce both row-level reads and writes, including forged parent/group
IDs and direct API requests. Invitations need server-checked expiry, hashed
secrets, bounded use and atomic acceptance. Role changes must not be permitted
through generic row updates. Joining another group must not broaden an existing
share. Revoke, leave and archive must invalidate authorization at read time, not
only hide a UI control. Expired authorization cannot be revived by stale offline
data or a cached signed URL. Avoid publicly cacheable artifact responses.

## Acceptance evidence required

Run with separate authenticated educator, learner A, learner B and outsider
accounts against an isolated local backend before a production migration. Test
every matrix cell directly, not only through hidden controls. Include expired and
replayed invitations, concurrent acceptance, forged IDs, removed membership,
revocation during an open view, account changes, offline reconnection, failed
artifact saves and concurrent feedback. Check that leave and archive leave the
personal progress row byte-for-byte intact. Record denied as well as allowed
requests and demonstrate absence of secrets in response bodies and logs.

Then have a real partner complete the seven-step workflow, including revocation,
and document confusion, support time and required changes. Product usefulness and
server permission enforcement require different evidence; neither is currently
available. Do not substitute the existing portfolio export tests for group access
tests. Until both gates pass, no group UI or group-sharing claim enters the stable
product.

Pending: partner, agreed workflow, server schema and migration, access tests,
privacy/retention decisions, actual browser journeys and pilot evidence.
