// Stable case payload for BROKA. Built from the fact-find answers. Nulls stay so a missing EPC is visible.
function text(value) {
  const s = String(value ?? '').trim();
  return s || null;
}
function amount(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
export function buildBrokaSpine(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  const applicants = [{ role: 'applicant', date_of_birth: text(a.applicant_dob) }];
  if (a.ownership === 'Joint with spouse or partner') {
    applicants.push({ role: 'joint_applicant', date_of_birth: text(a.applicant_2_dob) });
  }
  const letOut = a.rental_status === 'Let';
  return {
    version: 'broka-spine-v1',
    applicants,
    property_experience: text(a.property_experience),
    bedrooms: text(a.bedrooms),
    rental: { status: text(a.rental_status), monthly_income: letOut ? amount(a.rental_income_monthly) : null },
    epc: {
      rating: text(a.epc_rating),
      certificate_number: text(a.epc_certificate_number),
      registration_date: text(a.epc_registration_date),
      floor_area_m2: amount(a.epc_floor_area_m2),
      habitable_rooms: amount(a.epc_habitable_rooms),
      lookup_status: text(a.epc_lookup_status),
    },
  };
}
