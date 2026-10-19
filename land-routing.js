(function(){
  // Silent redirect only — no visible additions to /apply.
  // If a land asset type is selected, carry the entered address and go to /land.
  const LAND = ['Land with No Planning','Land with Planning','Agricultural Land','Land / development site','Farm'];
  const asset = document.querySelector('#assetType');
  const form  = document.querySelector('form');
  if (!asset || !form) return;

  asset.addEventListener('change', function() {
    if (!LAND.includes(asset.value)) return;
    const d = Object.fromEntries(new FormData(form));
    sessionStorage.setItem('posfin_land_transfer', JSON.stringify({
      property_address: d.propertyAddress || '',
      property_value: d.propertyValue || '',
      loan_amount: d.loanAmount || '',
      mobile: d.phone || '',
      email: d.email || ''
    }));
    location.href = '/land';
  });

  // If redirected back from /land because the security is habitable property, not land.
  const transfer = JSON.parse(sessionStorage.getItem('posfin_land_transfer') || 'null');
  if (transfer && transfer.product === 'main_loan') {
    if (form.elements.propertyAddress) form.elements.propertyAddress.value = transfer.property_address || '';
    sessionStorage.removeItem('posfin_land_transfer');
  }
})();
