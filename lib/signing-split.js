import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Never infer provider output ordering. An operator must approve the returned packet's exact hash/map.
export async function splitSignedPacket({document,bytes}) {
 const plan=document.split_plan, entries=document.packet_manifest;
 if(!plan || plan.approved!==true || !plan.approval_reference || plan.source_sha256!==sha(bytes) || !Number.isInteger(plan.audit_pages) || plan.audit_pages<0)throw Error('Approved signed page mapping required');
 if(!entries?.length || entries.some(e=>e.kind!=='LOA' || !e.id || !e.chargeholder_ref || !Number.isInteger(e.pages) || e.pages<1) || new Set(entries.map(e=>e.id)).size!==entries.length || new Set(entries.map(e=>e.chargeholder_ref)).size!==entries.length)throw Error('Invalid LOA mapping');
 if(JSON.stringify(plan.documents)!==JSON.stringify(entries.map(e=>({id:e.id,pages:e.pages,chargeholder_ref:e.chargeholder_ref}))))throw Error('Approved map differs from packet');
 const source=await PDFDocument.load(bytes,{updateMetadata:false});
 if(source.getPageCount()!==entries.reduce((n,e)=>n+e.pages,0)+plan.audit_pages)throw Error('Unexpected signed page count');
 let offset=0;const results=[];
 for(const e of entries){
  const part=await PDFDocument.create({updateMetadata:false});
  const pages=await part.copyPages(source,Array.from({length:e.pages},(_,i)=>offset+i));
  pages.forEach(p=>part.addPage(p));offset+=e.pages;
  const pdf=Buffer.from(await part.save()),digest=sha(pdf);
  // Content-addressed paths contain no borrower or chargeholder names.
  results.push({document_id:e.id,chargeholder_ref:e.chargeholder_ref,pages:e.pages,sha256:digest,path:`${document.id}/parts/${digest}.pdf`,bytes:pdf,release:'held'});
 }
 return results;
}
export async function archivePacketParts({document,bytes,store}) {
 const parts=await splitSignedPacket({document,bytes});
 for(const p of parts)await store.archive(p.path,p.bytes);
 return parts.map(({bytes,...metadata})=>metadata);
}
