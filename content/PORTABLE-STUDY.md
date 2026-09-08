Portable study and offline content (local milestone 2.18)

Open `/academy?view=storage` for portable backups, replacement previews, recovery downloads and course downloads. These features remain pending real browser and supported-device verification. Local handler checks are not evidence of a hosted account or airplane-mode walkthrough.

Portable backup contract

- Format `cortex-study-backup`, version 1, scope `active-workspace`. `data` contains raw serialized values for recognized study keys. `sha256` covers the fixed-order metadata and sorted raw values. It detects accidental change, not authorship, trust or content correctness. The file is unencrypted.
- Export only the active account or guest workspace. Exclude authentication, sync metadata, other account archives, downloaded course files and the deliberately separate `cortex-mcat-pilot-v2` reflections. Those reflections retain their existing MCAT Review export.
- A portable import supports one whole-workspace replacement, not an inferred merge of learning evidence. A preview lists additions, changes, removals and unchanged records and lets the learner inspect their contents. It requires an explicit checked replacement action. Cancel changes nothing.
- The owner token and the full active saved copy are compared again at apply time. Account changes, newer tab writes, active sync, unresolved conflicts and unsaved study drafts stop restoration. Unknown keys/formats, damaged JSON, unsupported root shapes, excessive size/depth, prototype keys, unsafe source links and executable markup are rejected. Original raw values remain unchanged in accepted files.
- The account transaction retains the previous workspace, journals the operation, rotates the owner token and reloads. Failure rolls back; an interrupted rollback is recovered before app startup. Imports retain the known cloud revision and mark local work dirty, so reconnecting still requires the existing revision comparison. No unconditional cloud overwrite was added.
- Recovery downloads are separate from portable imports. They include available prior device/cloud/guest copies plus the newest drafts held by StudyStorage in this tab. They may need manual recovery; the portable importer does not interpret this broader recovery format.
- A stale or expired authentication session retains the existing policy: leave the former account workspace and preserve its scoped browser copy. Offline support does not weaken account isolation or convert account work to guest work silently. Hosted expired/revoked-session tests remain pending.

Offline contract

- Seven explicit course packs include the app shell and each course's required public assets/data. Scopes and sizes are shown before download. Review status and production gates remain unchanged. Python CDN packages, external reference pages, sign-in and cloud requests are not downloaded.
- Each download uses a new cache. Every file must match the manifest byte length and SHA-256 before the complete marker is written. Failure, cancellation or storage pressure leaves earlier complete packs intact. An unfinished cache has no complete marker and is never offered as ready.
- Downloaded availability is reverified on the storage screen and before opening a downloaded page. A partial eviction is reported as unavailable. Browser persistence is an explicit request and a separate backup is still needed.
- Offline URLs include the exact course cache identifier. The worker serves that version's shell, scripts, styles and data even if the network returns. A normal online page never fills missing assets from an unrelated old cache. If an ordinary navigation cannot reach the network, a compatible complete download produces a redirect to its explicit offline URL.
- The worker caches no API requests, learner records or authentication traffic. POST requests and cross-origin requests bypass it. It does not force activation, take over active pages, silently update downloaded sessions, or automatically remove older complete downloads.
- Removing a download only deletes its named public course cache. The worker refuses while a Cortex tab is using that version. Progress and account storage are unaffected. An interrupted tab may leave an incomplete cache; the download manager lists it separately with an explicit discard action. It is never shown as ready for offline study.

Updating the inventory

Run `python3 scripts/build-offline-manifest.py` whenever any included app, course or data file changes. `python3 scripts/build-offline-manifest.py --check` must pass before a candidate is packaged. The build identifier is derived from course descriptions and all file hashes. Preserve the old worker protocol or version it explicitly when changing the cache contract.

Verification

Run `node scripts/test-study-backup.cjs`, `node scripts/test-academy-storage.cjs`, `node scripts/test-auth-progress.cjs` and `node scripts/test-offline.cjs`. These cover pure functions, actual screen handlers with DOM stand-ins, in-memory storage failures and worker request decisions. Existing shared study-storage and Academy Today checks also apply. Actual file chooser/download handling, HTML template parsing, service-worker lifecycle, browser storage pressure, cross-device accounts and offline lesson completion need browser evidence before milestone acceptance.

Primary platform references

- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
