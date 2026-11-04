// Conditional questions recovered from the existing land schema and /apply farm branches.
export const BRANCH_FIELDS=[
  {
    "key": "property_style",
    "label": "Property style",
    "type": "select",
    "options": [
      "Converted",
      "Detached",
      "End Terraced",
      "Purpose Built",
      "Semi Detached",
      "Terraced",
      "Other",
      "Not sure"
    ],
    "group": "residential"
  },
  {
    "key": "includes_farmland",
    "label": "Does the security include farmland or farm buildings?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ],
    "group": "nonland"
  },
  {
    "key": "farm_operation",
    "label": "Is this a working farm?",
    "type": "select",
    "options": [
      "Working farm",
      "Non-working / former farm",
      "Not sure"
    ],
    "group": "farm"
  },
  {
    "key": "farm_business",
    "label": "Does any business operate at the property?",
    "type": "select",
    "options": [
      "Yes",
      "No",
      "Not sure"
    ],
    "group": "farm"
  },
  {
    "key": "farm_business_description",
    "label": "What business operates here?",
    "type": "textarea",
    "group": "farm",
    "when": "farm_business=Yes"
  },
  {
    "key": "farm_residential_share",
    "label": "Approximately how much of the buildings’ floor area is residential?",
    "type": "select",
    "options": [
      "Less than 40%",
      "40% or more",
      "Not sure"
    ],
    "group": "farm"
  },
  {
    "q": 2,
    "section": "A. The land",
    "key": "title_numbers",
    "label": "Title number(s) — list each parcel; Don't know is allowed",
    "type": "textarea",
    "group": "land"
  },
  {
    "q": 3,
    "section": "A. The land",
    "key": "tenure",
    "label": "Tenure",
    "type": "select",
    "options": [
      "Freehold",
      "Leasehold",
      "Mixed",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 4,
    "section": "A. The land",
    "key": "site_size",
    "label": "Size (approximate is fine)",
    "type": "text",
    "group": "land"
  },
  {
    "q": 4,
    "section": "A. The land",
    "key": "size_unit",
    "label": "Size unit",
    "type": "select",
    "options": [
      "Acres",
      "Hectares",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 5,
    "section": "A. The land",
    "key": "site_current_use",
    "label": "What is on the land today?",
    "type": "select",
    "options": [
      "Bare land",
      "Hardstanding or car park",
      "Agricultural",
      "Buildings to demolish",
      "Buildings to keep or convert",
      "Part-built scheme",
      "Habitable dwelling in use",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 5,
    "section": "A. The land",
    "key": "funding_build",
    "label": "Are you asking to fund the ground-up build itself?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 6,
    "section": "A. The land",
    "key": "income_present",
    "label": "Does the land produce any income now?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 6,
    "section": "A. The land",
    "key": "income_details",
    "label": "What income, how much a year, and contracted or informal?",
    "type": "textarea",
    "when": "income_present=Yes",
    "group": "land"
  },
  {
    "q": 7,
    "section": "A. The land",
    "key": "occupancy_present",
    "label": "Anyone occupying, or holding a lease, licence or option?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 7,
    "section": "A. The land",
    "key": "occupancy_details",
    "label": "Who, and on what terms?",
    "type": "textarea",
    "when": "occupancy_present=Yes",
    "group": "land"
  },
  {
    "q": 8,
    "section": "A. The land",
    "key": "road_access",
    "label": "Direct road access?",
    "type": "select",
    "options": [
      "Yes",
      "No",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 8,
    "section": "A. The land",
    "key": "services",
    "label": "Mains services",
    "type": "select",
    "options": [
      "On site",
      "At boundary",
      "Neither",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 9,
    "section": "B. Planning",
    "key": "planning_status",
    "label": "Planning status",
    "type": "select",
    "options": [
      "None",
      "Pre-application",
      "Application submitted",
      "Outline",
      "Full",
      "Reserved matters approved",
      "Permission in principle",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 10,
    "section": "B. Planning",
    "key": "planning_references",
    "label": "Planning reference(s)",
    "type": "text",
    "when": "consent",
    "group": "land"
  },
  {
    "q": 11,
    "section": "B. Planning",
    "key": "consented_scheme",
    "label": "What is consented — units, use, floor area?",
    "type": "textarea",
    "when": "consent",
    "group": "land"
  },
  {
    "q": 12,
    "section": "B. Planning",
    "key": "consent_implemented",
    "label": "Has consent been implemented (a lawful start on site)?",
    "type": "select",
    "options": [
      "Yes",
      "No",
      "Not sure"
    ],
    "when": "consent",
    "group": "land"
  },
  {
    "q": 13,
    "section": "B. Planning",
    "key": "planning_expiry",
    "label": "When does consent expire? Date (YYYY-MM-DD), or Not sure",
    "type": "text",
    "when": "expiry",
    "group": "land"
  },
  {
    "q": 14,
    "section": "B. Planning",
    "key": "planning_intent",
    "label": "Do you plan to:",
    "type": "select",
    "options": [
      "Build out the current consent",
      "Re-plan to a different scheme or use",
      "Sell with the current consent",
      "Hold",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 15,
    "section": "B. Planning",
    "key": "replan_details",
    "label": "Re-plan to what, expected timeline, and council discussions?",
    "type": "textarea",
    "when": "planning_intent=Re-plan to a different scheme or use",
    "group": "land"
  },
  {
    "q": 16,
    "section": "B. Planning",
    "key": "cil_s106",
    "label": "Any known CIL or Section 106 liability?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ],
    "group": "land"
  },
  {
    "q": 16,
    "section": "B. Planning",
    "key": "cil_s106_amount",
    "label": "CIL / Section 106 amount (£)",
    "type": "money",
    "when": "cil_s106=Yes",
    "group": "land"
  }
];
export const LAND_ASSETS=['Land with No Planning','Land with Planning','Agricultural Land','Farm'];
export const isLand=a=>LAND_ASSETS.includes(a.asset_type);
export function branchVisible(f,a){
  const land=isLand(a),farm=['Farm','Agricultural Land'].includes(a.asset_type)||a.includes_farmland==='Yes';
  if(f.group==='land'&&!land)return false;
  if(f.group==='residential'&&a.asset_type!=='Residential')return false;
  if(f.group==='nonland'&&(!a.asset_type||land))return false;
  if(f.group==='farm'&&!farm)return false;
  if(!f.when)return true;
  const consent=['Outline','Full','Reserved matters approved','Permission in principle'].includes(a.planning_status);
  if(f.when==='consent')return consent;
  if(f.when==='expiry')return consent&&['No','Not sure'].includes(a.consent_implemented);
  const [key,value]=f.when.split('=');return a[key]===value;
}
export function cleanBranches(a){
  const out={...a};
  if(out.asset_type!=='Residential')delete out.residential_type;
  // Evaluate against the original selector answers, then remove inactive fields.
  for(const f of BRANCH_FIELDS)if(!branchVisible(f,a))delete out[f.key];
  return out;
}
export function resolveRoute(a){
  // Recovered legacy routing, with incomplete land answers retained for review.
  if(isLand(a)){
    if(!a.site_current_use||!a.funding_build||a.site_current_use==='Not sure'||a.funding_build==='Not sure')return 'senior_desk';
    if(a.site_current_use==='Habitable dwelling in use')return 'main_loan';
    return a.funding_build==='Yes'?'development_finance':'pa_land';
  }
  const purpose=String(a.purpose||'').toLowerCase(),charge=String(a.charge_position||'').toLowerCase();
  if(purpose.includes('development exit'))return 'development_exit_finance';
  if(purpose.includes('development finance')||purpose.includes('build costs'))return 'development_finance';
  if(/purchase|auction|refurb|chain break/.test(purpose))return 'purchase_refurb';
  if(purpose.includes('acquisition'))return 'acquisition_finance';
  if(charge.includes('equitable'))return 'speed_loan';
  if(charge.includes('first')||charge.includes('second'))return 'main_loan';
  return 'senior_desk';
}
export const ROUTES={
 pa_land:['Land finance','Land funding: planning, existing use and security details will be reviewed.'],
 development_finance:['Development finance','Ground-up or staged build funding: scheme, planning and costs require review.'],
 development_exit_finance:['Development exit','Review refinancing of the completed or near-completed development.'],
 purchase_refurb:['Purchase / refurbishment finance','Review purchase, auction, chain-break or refurbishment requirements.'],
 acquisition_finance:['Acquisition finance','Specialist review of the acquisition and proposed security.'],
 speed_loan:['Speed-loan review','Review whether an equitable-charge route fits the security and urgency.'],
 main_loan:['Main bridging finance','Review the property and requested first- or second-charge borrowing.'],
 senior_desk:['Specialist review','We need to confirm the details before identifying the appropriate finance route.']
};
export function routeCard(a){const id=resolveRoute(a),[title,description]=ROUTES[id];return `<section class="route-card" data-route="${id}" style="padding:20px;border:2px solid #00B5B0;border-radius:16px;margin:18px 0;background:#f0fcfb"><small>YOUR INDICATIVE PRODUCT ROUTE</small><h3>${title}</h3><p>${description}</p><p><small>Based on your answers — not an eligibility decision or an offer. We keep your answers in this fact find; no need to start again.</small></p></section>`;}
