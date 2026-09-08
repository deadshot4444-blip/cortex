/* Backup previews and explicit offline downloads for the active device. */
window.AcademyStorage = (() => {
  let generation = 0;
  let preparedURL = null;
  function clearPrepared() { if (preparedURL) URL.revokeObjectURL(preparedURL); preparedURL = null; }
  window.addEventListener('pagehide', clearPrepared);
  function render() {
    clearPrepared();
    const current = ++generation, root = el('<div></div>'); root.appendChild(topbar('academy'));
    const main = el(`<main class="panel academy-shell academy-storage">
      <div class="academy-intro"><span class="label">Your study data</span><h1>Keep a copy. Pick up where you left off.</h1>
      <p>Back up your saved study workspace, restore a file you have reviewed, or download course content for offline use.</p></div>
      <p id="storage-workspace"></p>
      <section aria-labelledby="backup-title"><h2 id="backup-title">Back up this workspace</h2>
      <p>A portable backup contains the active workspace’s saved answers, progress, notes, drafts and study settings. It excludes sign-in tokens, other accounts, downloaded courses and device-only MCAT pilot reflections. Export those reflections separately in MCAT Review.</p>
      <p>The file is private but unencrypted. Keep it somewhere you control. Its integrity check detects changes; it does not prove who created the file.</p>
      <div class="academy-lesson-nav"><button class="btn btn-solid" id="storage-export">Prepare study backup</button><button class="btn" id="storage-recovery">Download recovery copies</button></div>
      <p id="storage-export-status" role="status"></p><div id="storage-download"></div></section>
      <section aria-labelledby="restore-title"><h2 id="restore-title">Restore a study backup</h2>
      <p>Choose a Cortex study backup to inspect first. Restoring replaces this workspace with the selected file, including removal of records missing from it. The previous workspace is retained in this browser’s recovery copies. If you are signed in, the restored work will sync after checking for cloud changes.</p>
      <label for="storage-file">Choose a study backup · JSON, up to 16 MB</label>
      <input type="file" id="storage-file" accept="application/json,.json">
      <p id="storage-import-status" role="status"></p><div id="storage-preview"></div></section>
      <section aria-labelledby="offline-title"><h2 id="offline-title">Downloaded courses</h2><div id="storage-offline"></div></section>
      <p><a href="${esc(sectionUrl('academy'))}">Return to the Academy</a></p>
    </main>`);
    root.appendChild(main); setView(root);
    const active = () => generation === current && main.isConnected;
    const text = (id, message) => { if (active()) main.querySelector(id).textContent = message; };
    const requireSaved = () => { if (StudyStorage.paused) throw Error('Saving is paused. Download recovery copies and resolve the save problem before preparing or restoring a portable backup.'); };
    text('#storage-workspace', 'Active: ' + CortexAccount.label);
    main.querySelector('#storage-export').onclick = async e => {
      const button = e.currentTarget; button.disabled = true;
      const host = main.querySelector('#storage-download'); clearPrepared(); host.replaceChildren();
      try {
        requireSaved(); const snapshot = CortexAccount.snapshot(), identity = JSON.stringify(snapshot);
        const file = await StudyBackup.create(snapshot.data, APP_VERSION, { checkMarkup: StudyBackup.safeMarkup });
        if (!active()) return;
        const link = document.createElement('a'); link.className = 'btn btn-solid'; link.textContent = 'Download prepared backup';
        preparedURL = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
        link.href = preparedURL; link.download = 'cortex-study-' + new Date().toISOString().slice(0, 10) + '.json';
        link.onclick = event => {
          try {
            requireSaved();
            if (!active() || JSON.stringify(CortexAccount.snapshot()) !== identity) throw Error('Saved work changed. Prepare a new backup before downloading.');
            text('#storage-export-status', 'Download requested. Check that the file reached your Downloads folder.');
          } catch (error) { event.preventDefault(); clearPrepared(); host.replaceChildren(); text('#storage-export-status', error.message); }
        };
        host.appendChild(link);
        const count = Object.keys(snapshot.data).length;
        text('#storage-export-status', `Backup prepared from ${count} saved record${count === 1 ? '' : 's'}. Download the file below.`);
      } catch (error) { text('#storage-export-status', error.message); }
      finally { if (active()) button.disabled = false; }
    };
    main.querySelector('#storage-recovery').onclick = () => {
      try { CortexAccount.downloadRecovery(); text('#storage-export-status', 'Recovery download prepared. This separate recovery format may contain prior device, cloud and guest copies; it is not a portable import file.'); }
      catch { text('#storage-export-status', 'Could not prepare recovery copies. Keep this tab open.'); }
    };
    let selection = 0;
    main.querySelector('#storage-file').onchange = async e => {
      const request = ++selection, file = e.target.files?.[0], host = main.querySelector('#storage-preview'); host.replaceChildren();
      if (!file) { text('#storage-import-status', 'No file selected.'); return; }
      text('#storage-import-status', 'Checking the file…');
      try {
        requireSaved();
        if (file.size > StudyBackup.MAX_BYTES) throw Error('Choose a study backup smaller than 16 MB.');
        const parsed = await StudyBackup.parse(await file.text(), { checkMarkup: StudyBackup.safeMarkup });
        if (!active() || request !== selection) return;
        requireSaved(); const preview = CortexAccount.prepareRestore(parsed.data);
        const panel = el(`<div class="academy-day-summary"><h3>Review the replacement</h3><p data-file></p><p data-target></p>
          <ul data-changes></ul><details><summary>Inspect saved records</summary><pre data-records></pre></details>
          <label class="storage-confirm"><input type="checkbox" data-confirm> I reviewed this file and want it to replace the active workspace.</label>
          <div class="academy-lesson-nav"><button class="btn btn-solid" data-apply disabled>Restore and reload</button><button class="btn" data-cancel>Cancel</button></div></div>`);
        panel.querySelector('[data-file]').textContent = 'Created ' + new Date(parsed.createdAt).toLocaleString() + ' · app ' + parsed.appVersion + ' · integrity check passed.';
        panel.querySelector('[data-target]').textContent = 'Destination: ' + CortexAccount.label;
        const list = panel.querySelector('[data-changes]');
        for (const action of ['add', 'replace', 'remove', 'keep']) {
          const count = preview.changes.filter(c => c.action === action).length;
          const li = document.createElement('li'); li.textContent = `${count} record${count === 1 ? '' : 's'}: ${action}`; list.appendChild(li);
        }
        panel.querySelector('[data-records]').textContent = JSON.stringify(Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => { try { return [k, JSON.parse(v)]; } catch { return [k, v]; } })), null, 2);
        const apply = panel.querySelector('[data-apply]'), checkbox = panel.querySelector('[data-confirm]');
        checkbox.onchange = () => { apply.disabled = !checkbox.checked; };
        panel.querySelector('[data-cancel]').onclick = () => { selection++; host.replaceChildren(); main.querySelector('#storage-file').value = ''; text('#storage-import-status', 'Restoration canceled. Your work is unchanged.'); };
        apply.onclick = () => {
          if (!checkbox.checked || request !== selection || !active()) return;
          apply.disabled = true;
          try { requireSaved(); CortexAccount.restore(preview); text('#storage-import-status', 'Workspace restored. Reloading…'); }
          catch (error) {
            selection++; host.replaceChildren(); main.querySelector('#storage-file').value = '';
            text('#storage-import-status', CortexAccount.state === 'paused'
              ? 'Restoration did not finish. Download a recovery copy, restore browser storage access, then reload to recover the previous workspace.'
              : error.message + ' Choose the file again to review a fresh preview.');
          }
        };
        host.appendChild(panel); text('#storage-import-status', 'File checked. Nothing has been restored yet.');
      } catch (error) { if (request === selection && active()) { main.querySelector('#storage-file').value = ''; text('#storage-import-status', error.message); } }
    };
    if (window.CortexOffline) CortexOffline.render(main.querySelector('#storage-offline'));
    else text('#storage-offline', 'Offline downloads are unavailable in this build.');
  }
  return { render };
})();
