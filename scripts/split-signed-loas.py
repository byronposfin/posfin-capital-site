"""Offline operator split. Requires verified page map; never sends chargeholder documents."""
import argparse, hashlib, json
from pathlib import Path
import fitz

def split(source, entries, output, audit_pages):
 if not entries or any(e.get('kind')!='LOA' or not isinstance(e.get('pages'),int) or e['pages']<1 for e in entries):raise ValueError('LOA page map required')
 refs=[e.get('chargeholder_ref') for e in entries]
 if any(not r for r in refs) or len(set(refs))!=len(refs):raise ValueError('Unique chargeholder mapping required')
 if not isinstance(audit_pages,int) or audit_pages<0:raise ValueError('Explicit audit page count required')
 with fitz.open(source) as src:
  if len(src)!=sum(e['pages'] for e in entries)+audit_pages:raise ValueError('Unexpected signed page count; inspect provider output')
  out=Path(output)
  if out.exists():raise ValueError('Output must be new to avoid mixing packets')
  out.mkdir(parents=True,mode=0o700)
  offset=0;results=[]
  for i,e in enumerate(entries):
   part=fitz.open();part.insert_pdf(src,from_page=offset,to_page=offset+e['pages']-1)
   path=out/f'loa-{i+1}.pdf';part.save(path);part.close()
   results.append({'chargeholder_ref':e['chargeholder_ref'],'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':e['pages']})
   offset+=e['pages']
  # Keep the original and audit private. Never append an envelope-wide audit to a chargeholder copy.
  report={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'documents':results,'audit_pages_excluded':audit_pages,'release':'HELD: verify provider page mapping and chargeholder release checklist before dispatch'}
  (out/'split-manifest.json').write_text(json.dumps(report,indent=2))
  return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('pdf');p.add_argument('manifest');p.add_argument('output');p.add_argument('--audit-pages',type=int,required=True);a=p.parse_args();print(json.dumps(split(a.pdf,json.loads(Path(a.manifest).read_text()),a.output,a.audit_pages),indent=2))
