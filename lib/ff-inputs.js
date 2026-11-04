export function formatLiveMoney(raw, caret=raw.length) {
  // Only format a single non-negative numeric amount; keep TBC, ranges and negatives unchanged.
  if (!/^£?[\d,]+(?:\.\d{0,2})?$/.test(raw)) return {value:raw,caret};
  const plain=raw.replace(/[£,]/g,'');
  const [whole,fraction]=plain.split('.');
  const value='£'+whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
  const count=raw.slice(0,caret).replace(/[£,]/g,'').length;
  let pos=1,seen=0;
  while(pos<value.length && seen<count){if(value[pos]!==',')seen++;pos++;}
  return {value,caret:pos};
}
export function bindMoneyInput(input) {
  input.maxLength=24;
  input.value=formatLiveMoney(input.value).value;
  input.addEventListener('beforeinput', e=>{
    if(input.selectionStart!==input.selectionEnd)return;
    const p=input.selectionStart,v=input.value;
    if(e.inputType==='deleteContentBackward' && v[p-1]===',')input.setSelectionRange(Math.max(1,p-2),p);
    if(e.inputType==='deleteContentForward' && v[p]===',')input.setSelectionRange(p,p+2);
  });
  input.addEventListener('input',e=>{
    if(e.isComposing)return;
    if(e.inputType==='insertFromPaste' && input.value.includes(',') && !/^£?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(input.value))return;
    if(input.value==='£'){input.value='';return;}
    const result=formatLiveMoney(input.value,input.selectionStart);
    input.value=result.value;input.setSelectionRange(result.caret,result.caret);
  });
}
export function bindPostcode(input) {
  input.autocapitalize='characters';input.spellcheck=false;
  input.addEventListener('input',()=>{const p=input.selectionStart;input.value=input.value.toUpperCase();input.setSelectionRange(p,p);});
  input.addEventListener('blur',()=>{const v=input.value.toUpperCase().replace(/\s/g,'');if(/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(v))input.value=v.slice(0,-3)+' '+v.slice(-3);});
}
