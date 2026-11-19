import { createHash } from 'node:crypto';
export function accessibleDocument(document, caseId, clientId) {
  if (!document || document.case_id !== caseId || document.client_id !== clientId ||
      document.approved !== true || document.test_mode !== true) throw new Error('Document unavailable');
  return { id:document.id, kind:document.kind, status:document.status, downloadable:document.status === 'archived' };
}
export async function signedDocument({document,caseId,clientId,store}) {
  accessibleDocument(document,caseId,clientId);
  if (document.status !== 'archived' || !/^[a-f0-9]{64}$/.test(document.signed_sha256 || '') ||
      document.signed_path !== `${document.id}/${document.signed_sha256}.pdf`) throw new Error('Document not archived');
  const bytes = await store.download(document.signed_path);
  if (bytes.subarray(0,5).toString() !== '%PDF-' || createHash('sha256').update(bytes).digest('hex') !== document.signed_sha256) throw new Error('Archive integrity mismatch');
  return bytes;
}
