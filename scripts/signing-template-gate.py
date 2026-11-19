"""Offline PDF preflight. No send/registration. Explicit approved annex required for EL."""
import argparse, hashlib, json, re
from pathlib import Path
import fitz
TAG=re.compile(r'\[(sig|date|initial)\|(req|noreq)\|signer(\d+)(?:\|[^\]]*)?\]')
def pixel_hash(page):
 p=page.get_pixmap(matrix=fitz.Matrix(2,2),colorspace=fitz.csRGB,alpha=False,annots=True)
 if len(set(p.samples))<=1: raise ValueError('Blank reference page')
 return hashlib.sha256(f'{p.width}:{p.height}:{p.n}:'.encode()+p.samples).hexdigest()
def check(pdf,kind,signers=1,annex=None):
 errors=[]
 try:
  with fitz.open(pdf) as doc:
   tags=[]
   for n,page in enumerate(doc):
    for b in page.get_text('dict')['blocks']:
     for line in b.get('lines',[]):
      for span in line['spans']:
       for m in TAG.finditer(span['text']):
        tags.append((m.group(1),int(m.group(3)),n,span['color']))
        if m.group(1) in ('sig','date') and m.group(2)!='req': errors.append('Execution field must be required')
    for raw in re.findall(r'\[[^\[\]\n]*[|│][^\[\]\n]*\]',page.get_text()):
     if not TAG.fullmatch(raw): errors.append('Unsupported or malformed tag')
   for signer in range(1,signers+1):
    for typ in ('sig','date'):
     if not any(t==typ and s==signer and n==len(doc)-1 for t,s,n,c in tags):errors.append(f'Missing final-page {typ} for signer{signer}')
   for t,s,n,c in tags:
    if s<1 or s>signers: errors.append('Signer index outside request')
    if c!=0xffffff: errors.append('Tag is not white text')
    if t in ('sig','date') and n!=len(doc)-1: errors.append('Execution tag outside final page')
    if t=='initial' and n==len(doc)-1: errors.append('Initial tag on final execution page')
   if kind=='EL':
    if not annex: errors.append('Approved annex required')
    else:
     with fitz.open(annex) as ref:
      if len(doc)<len(ref)+2: errors.append('Missing body, annex or final execution page')
      else:
       start=len(doc)-len(ref)-1
       reference_hashes=[pixel_hash(page) for page in ref]
       for page in list(doc)[:start]:
        try:
         if pixel_hash(page) in reference_hashes: errors.append('Duplicate annex page outside required annex position')
        except ValueError: pass
       for i in range(len(ref)):
        if pixel_hash(ref[i])!=pixel_hash(doc[start+i]): errors.append(f'Annex page {i+1} exact render mismatch')
   return {'status':'FAIL' if errors else 'PASS','errors':errors,'sha256':hashlib.sha256(Path(pdf).read_bytes()).hexdigest(),'pages':len(doc),'tags':len(tags),'renderer':fitz.VersionBind,'scope':'Offline structure only; not commercial approval, provider placement or send-path enforcement'}
 except Exception as e:return {'status':'FAIL','errors':[type(e).__name__+': '+str(e)]}
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('pdf');p.add_argument('--kind',choices=['EL','LOA','BUSINESS_PURPOSE'],required=True);p.add_argument('--signers',type=int,default=1);p.add_argument('--annex');a=p.parse_args();r=check(a.pdf,a.kind,a.signers,a.annex);print(json.dumps(r,indent=2));raise SystemExit(r['status']!='PASS')
