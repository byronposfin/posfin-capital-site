/**
 * Main Bridging Loan field map — derived from factfind-core.js normalise/calculate.
 *
 * Each field: { key, label, owner: 'borrower'|'broker', section, priority, type }
 * priority: lower number = asked first (stage priority per Stage Map v1.4)
 * owner: 'borrower' fields become questions; 'broker' fields are blockers.
 */

const fields = [
  // Section: Contact (priority 10)
  { key: 'first_name', label: 'First name', owner: 'borrower', section: 'contact', priority: 10, type: 'text' },
  { key: 'last_name', label: 'Last name', owner: 'borrower', section: 'contact', priority: 10, type: 'text' },
  { key: 'mobile', label: 'Mobile number', owner: 'borrower', section: 'contact', priority: 10, type: 'tel' },
  { key: 'email', label: 'Email address', owner: 'borrower', section: 'contact', priority: 10, type: 'email' },
  { key: 'date_of_birth', label: 'Date of birth', owner: 'borrower', section: 'contact', priority: 15, type: 'date' },
  { key: 'home_address', label: 'Home address', owner: 'borrower', section: 'contact', priority: 15, type: 'text' },
  { key: 'time_at_address', label: 'Time at current address (months)', owner: 'borrower', section: 'contact', priority: 20, type: 'number' },
  { key: 'contact_preference', label: 'Best time to contact you', owner: 'borrower', section: 'contact', priority: 20, type: 'choice', choices: ['any_time', 'business_hours', 'within_2_weeks', 'asap'] },

  // Section: Property (priority 20)
  { key: 'property_address', label: 'Security property address', owner: 'borrower', section: 'property', priority: 20, type: 'text' },
  { key: 'postcode', label: 'Property postcode', owner: 'borrower', section: 'property', priority: 20, type: 'text' },
  { key: 'property_value', label: 'Estimated property value', owner: 'borrower', section: 'property', priority: 20, type: 'currency' },
  { key: 'property_type', label: 'Property type', owner: 'borrower', section: 'property', priority: 25, type: 'choice', choices: ['Residential', 'Commercial', 'Semi-Commercial', 'Land', 'Farm', 'Agricultural Land'] },
  { key: 'residential_type', label: 'Residential type', owner: 'borrower', section: 'property', priority: 25, type: 'text' },
  { key: 'property_style', label: 'Property style', owner: 'borrower', section: 'property', priority: 25, type: 'text' },
  { key: 'tenure', label: 'Freehold or leasehold', owner: 'borrower', section: 'property', priority: 25, type: 'choice', choices: ['freehold', 'leasehold'] },
  { key: 'title_ownership', label: 'Who owns the property?', owner: 'borrower', section: 'property', priority: 25, type: 'choice', choices: ['personal_sole', 'personal_joint', 'company', 'trust'] },
  { key: 'home_equals_security', label: 'Is the security your home?', owner: 'borrower', section: 'property', priority: 25, type: 'boolean' },
  { key: 'restrictions_present', label: 'Any title restrictions?', owner: 'borrower', section: 'property', priority: 30, type: 'choice', choices: ['yes', 'no', 'not_sure'] },

  // Section: Existing borrowing (priority 30)
  { key: 'first_charge_lender', label: 'First-charge lender', owner: 'borrower', section: 'borrowing', priority: 30, type: 'text' },
  { key: 'first_charge_balance', label: 'Mortgage balance', owner: 'borrower', section: 'borrowing', priority: 30, type: 'currency' },
  { key: 'first_charge_status', label: 'Mortgage status', owner: 'borrower', section: 'borrowing', priority: 30, type: 'choice', choices: ['ongoing', 'term_ending', 'in_arrears'] },
  { key: 'first_charge_arrears_amount', label: 'Mortgage arrears amount', owner: 'borrower', section: 'borrowing', priority: 30, type: 'currency' },
  { key: 'arrears_included_in_balance', label: 'Is arrears included in the balance?', owner: 'borrower', section: 'borrowing', priority: 30, type: 'choice', choices: ['clean', 'included', 'not_sure'] },
  { key: 'second_charge_present', label: 'Any second charge?', owner: 'borrower', section: 'borrowing', priority: 35, type: 'choice', choices: ['yes', 'no'] },
  { key: 'second_charge_provider', label: 'Second-charge lender', owner: 'borrower', section: 'borrowing', priority: 35, type: 'text' },
  { key: 'second_charge_balance', label: 'Second-charge balance', owner: 'borrower', section: 'borrowing', priority: 35, type: 'currency' },

  // Section: The loan (priority 40)
  { key: 'loan_amount', label: 'Loan amount', owner: 'borrower', section: 'loan', priority: 40, type: 'currency' },
  { key: 'net_or_gross', label: 'Net or gross request', owner: 'borrower', section: 'loan', priority: 40, type: 'choice', choices: ['net', 'gross'] },
  { key: 'loan_purpose', label: 'Purpose of funds', owner: 'borrower', section: 'loan', priority: 40, type: 'text' },
  { key: 'exit_strategy', label: 'How will you repay?', owner: 'borrower', section: 'loan', priority: 40, type: 'text' },
  { key: 'funds_timescale', label: 'When do you need funds?', owner: 'borrower', section: 'loan', priority: 40, type: 'choice', choices: ['asap', 'within_2_weeks', 'within_month', 'flexible'] },
  { key: 'credit_profile', label: 'Credit profile', owner: 'borrower', section: 'loan', priority: 45, type: 'choice', choices: ['clean', 'minor_issues', 'poor_adverse', 'not_sure'] },
  { key: 'charge_request', label: 'Charge position requested', owner: 'borrower', section: 'loan', priority: 45, type: 'text' },
  { key: 'repayment_preference', label: 'Interest preference', owner: 'borrower', section: 'loan', priority: 45, type: 'choice', choices: ['retained', 'serviced', 'rolled_up'] },
  { key: 'legal_buffer', label: 'Legal costs allowance', owner: 'borrower', section: 'loan', priority: 50, type: 'currency' },
  { key: 'contingency_buffer', label: 'Contingency buffer', owner: 'borrower', section: 'loan', priority: 50, type: 'currency' },
  { key: 'panel_solicitor_opt_in', label: 'Use a panel solicitor?', owner: 'borrower', section: 'loan', priority: 50, type: 'choice', choices: ['yes', 'no', 'not_sure'] },

  // Section: Broker-only (never shown to borrower)
  { key: 'assigned_broker', label: 'Sales owner', owner: 'broker', section: 'broker', priority: 100, type: 'text' },
  { key: 'lender_route', label: 'Proposed lender route', owner: 'broker', section: 'broker', priority: 100, type: 'text' },
  { key: 'proc_fee', label: 'Proc fee', owner: 'broker', section: 'broker', priority: 100, type: 'currency' },
  { key: 'broker_notes', label: 'Internal notes', owner: 'broker', section: 'broker', priority: 100, type: 'text' },
];

export default fields;
export const SECTIONS = ['contact', 'property', 'borrowing', 'loan', 'broker'];
