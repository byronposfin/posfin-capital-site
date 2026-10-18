<script id="posfin-scorecard-contrast-hotfix-20260923">
(function(){
  function text(el){return (el&&el.textContent||'').replace(/\s+/g,' ').trim();}
  function isScorecardRoot(el){
    var t=text(el);
    return /(Application received\.|You look like a strong fit\.)/.test(t) && /Your scorecard/i.test(t);
  }
  function findRoot(){
    var candidates=Array.prototype.slice.call(document.querySelectorAll('div'));
    for(var i=0;i<candidates.length;i++){
      if(isScorecardRoot(candidates[i])){
        var el=candidates[i];
        while(el.parentElement && isScorecardRoot(el.parentElement) && text(el.parentElement).length < 6000) el=el.parentElement;
        return el;
      }
    }
    return null;
  }
  function apply(){
    var root=findRoot();
    if(!root || root.dataset.posfinScorecardContrast==='1') return;
    root.dataset.posfinScorecardContrast='1';
    root.style.background='#FFFFFF';
    root.style.color='#1A1A2E';
    root.style.paddingBottom='8px';

    Array.prototype.slice.call(root.querySelectorAll('*')).forEach(function(el){
      var st=(el.getAttribute('style')||'');
      var t=text(el);
      if(st.indexOf('#D4A853')!==-1 || st.indexOf('212,168,83')!==-1 || st.indexOf('212, 168, 83')!==-1){
        st=st.replace(/#D4A853/gi,'#008F8A')
             .replace(/rgba\(212,\s*168,\s*83,\s*0\.0?5\)/gi,'#FFFFFF')
             .replace(/rgba\(212,\s*168,\s*83,\s*0\.08\)/gi,'#F7FEFD')
             .replace(/rgba\(212,\s*168,\s*83,\s*0\.12\)/gi,'#F7FEFD')
             .replace(/rgba\(212,\s*168,\s*83,\s*0\.2\)/gi,'#BFE9E7')
             .replace(/rgba\(212,\s*168,\s*83,\s*0\.3\)/gi,'#BFE9E7');
        el.setAttribute('style',st);
      }
      if(/^(Your Details|The Security Property|Your Loan|Additions to Loan)$/i.test(t)){
        el.style.color='#008F8A';
        el.style.fontFamily='DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        el.style.fontWeight='800';
        el.style.fontSize='11px';
        el.style.letterSpacing='0.16em';
      }
      if(/^Your scorecard$/i.test(t)){
        el.style.color='#1C184F';
        el.style.fontFamily='DM Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        el.style.fontWeight='800';
        el.style.fontSize='11px';
        el.style.letterSpacing='0.20em';
      }
      if(el.tagName==='SPAN' && st.indexOf('fontSize')!==-1){
        // Slightly stronger mobile readability for row labels/values.
        if(st.indexOf('0.82rem')!==-1 || st.indexOf('0.85rem')!==-1){
          el.style.fontSize = el.style.fontWeight && Number(el.style.fontWeight)>=600 ? '0.94rem' : '0.9rem';
          el.style.lineHeight='1.35';
        }
        if(el.style.color==='rgb(111, 107, 122)' || st.indexOf('#6F6B7A')!==-1) el.style.color='#425466';
      }
      if(st.indexOf('borderBottom:"1px solid rgba(28,24,79,0.07)"')!==-1 || st.indexOf('rgba(28,24,79,0.07)')!==-1){
        el.style.borderBottom='1px solid #E8EEF0';
        el.style.padding='0.62rem 0';
      }
      if(st.indexOf('#FAF8F3')!==-1) el.style.background='#FFFFFF';
    });
  }
  function schedule(){ apply(); setTimeout(apply,80); setTimeout(apply,250); setTimeout(apply,700); }
  document.addEventListener('click', function(){ setTimeout(schedule,80); }, true);
  document.addEventListener('submit', function(){ setTimeout(schedule,250); }, true);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', schedule); else schedule();
  try{ new MutationObserver(function(){ clearTimeout(window.__posfinScorecardContrastTimer); window.__posfinScorecardContrastTimer=setTimeout(schedule,60); }).observe(document.documentElement,{childList:true,subtree:true}); }catch(e){}
})();
</script>
