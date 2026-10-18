// A click records an event only; this script never sends a borrower message.
document.addEventListener('click',function(event){
 const a=event.target.closest('[data-factfind-whatsapp]');if(!a)return;
 const source=a.dataset.scorecardUrl;if(!source)return;
 const u=new URL(source,location.origin);const token=u.searchParams.get('token'),ref=u.searchParams.get('ref');if(!token||!ref)return;
 fetch('/api/factfind-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref,token,event:'whatsapp_cta_clicked'}),keepalive:true}).catch(()=>{});
});
