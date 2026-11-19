export function signingStore(db) {
  async function result(query) { const {data,error} = await query; if(error) throw error; return data; }
  return {
    findSignerGrant: hash => result(db.from('case_signer_grants').select('*').eq('token_hash',hash).maybeSingle()),
    findRequest: id => result(db.from('case_signing_documents').select('*').eq('request_id', id).maybeSingle()),
    findDocument: id => result(db.from('case_signing_documents').select('*').eq('id', id).maybeSingle()),
    enqueue: event => result(db.from('case_signing_events').upsert(event, {onConflict:'event_key', ignoreDuplicates:true})),
    claim: () => result(db.rpc('claim_signing_event')),
    finish: (job, patch) => result(db.rpc('finish_signing_event', {p_key:job.event_key,p_lease:job.lease,p_patch:patch})),
    retry: (job, error) => result(db.rpc('retry_signing_event', {p_key:job.event_key,p_lease:job.lease,p_error:String(error).slice(0,200)})),
    download: async path => {
      const {data,error}=await db.storage.from('signing-test-private').download(path);
      if(error) throw error;
      return Buffer.from(await data.arrayBuffer());
    },
    archive: async (path, bytes) => {
      const {error} = await db.storage.from('signing-test-private').upload(path,bytes,{contentType:'application/pdf',upsert:false});
      if (error) {
        // A crash after upload may replay. Only accept an existing identical object.
        const {data,error:readError} = await db.storage.from('signing-test-private').download(path);
        if (readError || !Buffer.from(await data.arrayBuffer()).equals(bytes)) throw error;
      }
    }
  };
}
