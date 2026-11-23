const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const project = 'bpwdxslrkgmcoewkwufu';
const url = `https://${project}.supabase.co`;
const key = 'sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6';
const bucket = 'lead-attachments';

async function verify() {
  const credentials = JSON.parse(fs.readFileSync('.test-credentials.local.json', 'utf8'));
  const environment = fs.readFileSync('.env', 'utf8');
  const connectionString = environment.match(/^DATABASE_URL\s*=([^\r\n]+)/m)?.[1].trim().replace(/^['"]|['"]$/g, '');
  const target = new URL(connectionString);
  assert(target.hostname === `db.${project}.supabase.co` ||
    (target.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(target.username) === `postgres.${project}`));
  const db = new Client({ connectionString, connectionTimeoutMillis: 12000 });
  let failureMode;
  const fixtureFetch = async (input, init) => {
    const isRemoval = String(input).includes('/storage/v1/object/') && init?.method === 'DELETE';
    const failure = isRemoval ? failureMode : undefined;
    if (failure) failureMode = undefined;
    if (failure === 'before') throw new Error('Synthetic network interruption before removal');
    const response = await fetch(input, init);
    if (failure === 'after') {
      await response.arrayBuffer();
      throw new Error('Synthetic network interruption after removal');
    }
    return response;
  };
  const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fixtureFetch } });
  async function login(email) {
    const client = makeClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password: credentials[email] });
    assert(!error && data.user, 'Development fixture login failed');
    return [client, data.user.id];
  }
  const [owner, ownerId] = await login('test.superadmin@finlonexa.test');
  const [restricted] = await login('test.bdo1@finlonexa.test');
  const files = owner.storage.from(bucket);
  const leadId = randomUUID();
  const fileName = `${randomUUID()}_attachment-acceptance.txt`;
  const path = `${leadId}/${fileName}`;
  const title = `Synthetic Lead Storage acceptance ${leadId}`;
  const body = 'Synthetic Lead file for Storage acceptance';
  async function history(action) {
    const result = await owner.from('lead_history').select('actor_id')
      .eq('lead_id', leadId).eq('field_name', 'attachment').eq('new_value', action);
    assert(!result.error, 'Lead History query failed');
    assert.equal(result.data?.length, 1, `Missing or duplicate ${action} event`);
    assert.equal(result.data[0].actor_id, ownerId, 'Attachment History actor mismatch');
    console.log(action + ' history actor: ' + (result.data[0].actor_id === ownerId ? 'verified' : 'unattributed'));
  }
  const orphanId = randomUUID();
  const orphanName = `${orphanId}_abandoned.txt`;
  const orphanPath = `${leadId}/${orphanName}`;
  let orphanUploaded = false;
  const faultConstraint = 'fixture_attachment_' + orphanId.replaceAll('-', '');
  let associationFault = false;

  async function clearAssociationFault() {
    if (!associationFault) return;
    await db.query(`alter table public.lead_pending_attachments drop constraint ${faultConstraint}`);
    associationFault = false;
  }
  let seeded = false;
  let uploaded = false;
  try {
    await db.connect();
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ownerId]);
    await db.query(
      'insert into public.leads(id,title,first_name,last_name,status,lead_owner_id,created_by_id) values($1,$2,$3,$4,$5,$6,$6)',
      [leadId, title, 'Synthetic', 'Storage', 'new', ownerId]);
    seeded = true;
    const noteId = fileName.slice(0, 36);
    const registration = { p_submission_id: noteId, p_lead_id: leadId, p_name: fileName };
    assert(!(await owner.rpc('begin_lead_pending_attachment', registration)).error, 'Pending registration failed');
    assert(!(await owner.rpc('begin_lead_pending_attachment', registration)).error, 'Registration retry failed');
    assert((await restricted.rpc('begin_lead_pending_attachment', registration)).error, 'Restricted registration accepted');

    const upload = await files.upload(path, new Blob([body], { type: 'text/plain' }), { upsert: false, cacheControl: '0', metadata: { actor_id: randomUUID(), owner_id: randomUUID() } });
    assert(!upload.error, 'Authorized upload failed');
    uploaded = true;
    const listing = await files.list(leadId);
    assert(!listing.error && listing.data.some(file => file.name === fileName), 'Lead attachment listing omitted uploaded file');
    await history('Uploaded');
    const objectOwner = await db.query('select owner_id = $3 as matches_actor from storage.objects where bucket_id = $1 and name = $2', [bucket, path, ownerId]);
    assert.equal(objectOwner.rows[0]?.matches_actor, true, 'Storage did not stamp the authenticated uploader');
    const claim = { p_submission_id: noteId, p_confirmed: true };
    assert((await owner.rpc('confirm_expired_lead_attachment_cleanup', claim)).error, 'Fresh upload was claimable');
    const invalid = await owner.from('lead_notes').insert({ id: noteId, lead_id: leadId, title: '' });
    assert(invalid.error, 'Invalid note passed validation');
    const forged = await owner.from('lead_notes').insert({
      id: noteId, lead_id: leadId, title: 'Synthetic note', created_by_id: randomUUID(),
    });
    assert(forged.error, 'Client supplied an audit actor');
    const note = { id: noteId, lead_id: leadId, title: 'Synthetic note', body: '**Synthetic**' };
    const submitted = await owner.from('lead_notes').insert(note).select('id,created_by_id').single();
    assert(!submitted.error && submitted.data.created_by_id === ownerId, 'Scoped note submission or actor attribution failed');
    await db.query("update public.lead_pending_attachments set created_at=now()-interval '25 hours' where submission_id=$1", [noteId]);
    assert((await owner.rpc('confirm_expired_lead_attachment_cleanup', claim)).error, 'Completed upload was claimable');
    const duplicate = await owner.from('lead_notes').insert(note);
    assert.equal(duplicate.error?.code, '23505', 'Repeated submission did not preserve one note');
    console.log('PASS: note validation, authenticated note actor, and duplicate submission denial');

    for (const client of [restricted, makeClient()]) {
      const storage = client.storage.from(bucket);
      assert((await storage.download(path)).error, 'Unauthorized download returned content');
      const denied = await storage.remove([path]);
      assert(denied.error || !denied.data?.length, 'Unauthorized removal succeeded');
    }
    const download = await files.download(path);
    assert(!download.error && await download.data.text() === body, 'Denied removals changed the stored file');
    const args = { p_lead_id: leadId, p_name: fileName };
    for (const client of [restricted, makeClient()]) {
      assert((await client.rpc('prepare_lead_attachment_removal', args)).error, 'Unauthorized removal intent accepted');
    }
    assert((await owner.rpc('prepare_lead_attachment_removal', { ...args, actor_id: randomUUID() })).error, 'Unexpected actor input accepted');
    const unprepared = await files.remove([path]);
    assert(unprepared.error || !unprepared.data?.length, 'Unprepared removal succeeded');
    const prepared = await owner.rpc('prepare_lead_attachment_removal', args);
    assert(!prepared.error, 'Authorized removal preparation failed');
    assert.equal((await files.exists(path)).data, true, 'Preparation alone deleted the file');
    assert(!(await owner.rpc('prepare_lead_attachment_removal', args)).error, 'Removal preparation retry failed');
    const archived = await owner.rpc('lead_archive_selected', { p_ids: [leadId] });
    assert(!archived.error, 'Synthetic Lead archive failed');
    try {
      assert((await owner.rpc('prepare_lead_attachment_removal', args)).error,
        'Remover could prepare deletion after losing Lead access');
      const inaccessible = await files.remove([path]);
      assert(inaccessible.error || !inaccessible.data?.length, 'Existing intent bypassed Lead scope');
      const state = await db.query(
        'select exists(select 1 from storage.objects where bucket_id=$1 and name=$2) as present, exists(select 1 from public.lead_history where lead_id=$3 and field_name=$4 and new_value=$5) as logged',
        [bucket, path, leadId, 'attachment', 'Removed']);
      assert.deepEqual(state.rows[0], { present: true, logged: false });
    } finally {
      const restored = await owner.rpc('lead_restore', { p_id: leadId });
      assert(!restored.error, 'Synthetic Lead restore failed');
    }
    assert(!(await owner.rpc('prepare_lead_attachment_removal', args)).error,
      'Original remover could not resume after Lead access was restored');
    console.log('PASS: access loss blocked prepared removal; restored access permitted retry');

    failureMode = 'before';
    assert((await files.remove([path])).error, 'Interrupted removal was reported successful');
    assert.equal((await files.exists(path)).data, true, 'Interrupted request changed the object');
    failureMode = 'after';
    const removals = await Promise.all([files.remove([path]), files.remove([path])]);
    assert(removals.some(result => result.error), 'Lost removal response did not surface an error');
    const repeated = await files.remove([path]);
    assert(!repeated.data?.length, 'Repeated removal reported another deleted object');
    uploaded = false;
    assert.equal((await files.exists(path)).data, false, 'Object metadata endpoint still sees the file');
    const after = await files.list(leadId);
    assert(!after.error && !after.data.some(file => file.name === fileName), 'Removed attachment remains listed');
    assert((await files.download(path, { cacheNonce: randomUUID() })).error, 'Removed file remains downloadable');
    const metadata = await db.query('select 1 from storage.objects where bucket_id=$1 and name=$2', [bucket, path]);
    assert.equal(metadata.rowCount, 0, 'Storage metadata association remains');
    await history('Removed');

    assert(!(await owner.rpc('begin_lead_pending_attachment', {
      p_submission_id: orphanId, p_lead_id: leadId, p_name: orphanName,
    })).error, 'Orphan registration failed');
    assert(!(await files.upload(orphanPath, new Blob([body]), { upsert: false, cacheControl: '0' })).error, 'Orphan upload failed');
    orphanUploaded = true;
    await db.query("update public.lead_pending_attachments set created_at=now()-interval '25 hours' where submission_id=$1", [orphanId]);
    for (const client of [restricted, makeClient()]) {
      assert((await client.rpc('confirm_expired_lead_attachment_cleanup', { p_submission_id: orphanId, p_confirmed: true })).error, 'Unauthorized orphan claim accepted');
    }
    assert((await owner.rpc('confirm_expired_lead_attachment_cleanup', {
      p_submission_id: orphanId, p_confirmed: false,
    })).error, 'Cleanup succeeded without confirmation');
    for (let attempt = 0; attempt < 2; attempt++) {
      assert(!(await owner.rpc('confirm_expired_lead_attachment_cleanup', { p_submission_id: orphanId, p_confirmed: true })).error, 'Orphan cleanup claim failed');
    }
    assert((await owner.from('lead_notes').insert({
      id: orphanId, lead_id: leadId, title: 'Synthetic late note',
    })).error, 'Claimed orphan was linked to a late note');
    await db.query(`alter table public.lead_pending_attachments add constraint ${faultConstraint}
      check (submission_id <> '${orphanId}'::uuid or removed_at is null) not valid`);
    associationFault = true;
    try {
      const failed = await files.remove([orphanPath]);
      assert(failed.error, 'Database association failure was reported successful');
      assert.equal((await files.exists(orphanPath)).data, true, 'Association disappeared despite rollback');
      const retained = await files.download(orphanPath, { cacheNonce: randomUUID() });
      assert(!retained.error && await retained.data.text() === body, 'Storage bytes were lost despite association rollback');
      const pending = await db.query('select removed_at from public.lead_pending_attachments where submission_id=$1', [orphanId]);
      assert.equal(pending.rows[0].removed_at, null, 'Failed removal recorded a successful outcome');
      await history('Removed');
      console.log('PASS: injected database association failure retained bytes and rolled back History');
    } finally {
      await clearAssociationFault();
    }
    assert(!(await files.remove([orphanPath])).error, 'Orphan removal failed');
    assert.equal((await files.exists(orphanPath)).data, false, 'Orphan remains available');
    orphanUploaded = false;
    const audit = await db.query('select cleanup_attempts, removed_at is not null as removed from public.lead_pending_attachments where submission_id=$1', [orphanId]);
    assert.deepEqual(audit.rows, [{ cleanup_attempts: 2, removed: true }]);
    console.log('PASS: expired unlinked upload cleanup, retry, late completion denial and durable outcome');

    console.log('PASS: private upload, listing, download, denied access, authorized removal and history event presence');
  } finally {
    try {
      if (uploaded) {
        await owner.rpc('prepare_lead_attachment_removal', { p_lead_id: leadId, p_name: fileName });
        const cleanup = await files.remove([path]);
        assert(!cleanup.error && cleanup.data?.length === 1, 'Synthetic attachment cleanup failed');
      }
      await clearAssociationFault();
      if (orphanUploaded) {
        await owner.rpc('prepare_lead_attachment_removal', { p_lead_id: leadId, p_name: orphanName });
        await files.remove([orphanPath]);
        assert.equal((await files.exists(orphanPath)).data, false, 'Orphan fixture cleanup failed');
      }
      if (seeded) await db.query('delete from public.leads where id=$1 and title=$2', [leadId, title]);
    } finally {
      await db.end();
    }
  }
}
verify().catch(error => {
  console.error('Lead attachment acceptance failed:', (error.name === 'AssertionError' || error.code === '42501') ? error.message : error.code || error.name);
  process.exitCode = 1;
});




