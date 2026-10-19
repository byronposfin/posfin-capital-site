globalThis.PosfinLandFields = [
  {
    "q": 1,
    "section": "A. The land",
    "key": "property_address",
    "label": "Site address or location — postcode or what3words",
    "type": "text"
  },
  {
    "q": 2,
    "section": "A. The land",
    "key": "title_numbers",
    "label": "Title number(s) — list each parcel; Don't know is allowed",
    "type": "textarea"
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
      "Mixed"
    ]
  },
  {
    "q": 4,
    "section": "A. The land",
    "key": "site_size",
    "label": "Size (approximate is fine)",
    "type": "text"
  },
  {
    "q": 4,
    "section": "A. The land",
    "key": "size_unit",
    "label": "Size unit",
    "type": "select",
    "options": [
      "Acres",
      "Hectares"
    ]
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
      "Habitable dwelling in use"
    ]
  },
  {
    "q": 5,
    "section": "A. The land",
    "key": "funding_build",
    "label": "Are you asking to fund the ground-up build itself?",
    "type": "select",
    "options": [
      "No",
      "Yes"
    ]
  },
  {
    "q": 6,
    "section": "A. The land",
    "key": "income_present",
    "label": "Does the land produce any income now?",
    "type": "select",
    "options": [
      "No",
      "Yes"
    ]
  },
  {
    "q": 6,
    "section": "A. The land",
    "key": "income_details",
    "label": "What income, how much a year, and contracted or informal?",
    "type": "textarea",
    "when": "income_present=Yes"
  },
  {
    "q": 7,
    "section": "A. The land",
    "key": "occupancy_present",
    "label": "Anyone occupying, or holding a lease, licence or option?",
    "type": "select",
    "options": [
      "No",
      "Yes"
    ]
  },
  {
    "q": 7,
    "section": "A. The land",
    "key": "occupancy_details",
    "label": "Who, and on what terms?",
    "type": "textarea",
    "when": "occupancy_present=Yes"
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
    ]
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
    ]
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
      "Permission in principle"
    ]
  },
  {
    "q": 10,
    "section": "B. Planning",
    "key": "planning_references",
    "label": "Planning reference(s)",
    "type": "text",
    "when": "consent"
  },
  {
    "q": 11,
    "section": "B. Planning",
    "key": "consented_scheme",
    "label": "What is consented — units, use, floor area?",
    "type": "textarea",
    "when": "consent"
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
    "when": "consent"
  },
  {
    "q": 13,
    "section": "B. Planning",
    "key": "planning_expiry",
    "label": "When does consent expire? Date (YYYY-MM-DD), or Not sure",
    "type": "text",
    "when": "expiry"
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
      "Hold"
    ]
  },
  {
    "q": 15,
    "section": "B. Planning",
    "key": "replan_details",
    "label": "Re-plan to what, expected timeline, and council discussions?",
    "type": "textarea",
    "when": "planning_intent=Re-plan to a different scheme or use"
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
    ]
  },
  {
    "q": 16,
    "section": "B. Planning",
    "key": "cil_s106_amount",
    "label": "CIL / Section 106 amount (£)",
    "type": "number",
    "when": "cil_s106=Yes"
  },
  {
    "q": 17,
    "section": "C. Ownership and purchase",
    "key": "ownership_status",
    "label": "Where are you with the land?",
    "type": "select",
    "options": [
      "I own it",
      "Exchanged contracts",
      "Offer accepted",
      "Bidding or negotiating",
      "Auction with a completion date set"
    ]
  },
  {
    "q": 18,
    "section": "C. Ownership and purchase",
    "key": "purchase_date",
    "label": "When did you buy it?",
    "type": "month",
    "when": "owned"
  },
  {
    "q": 18,
    "section": "C. Ownership and purchase",
    "key": "price_paid",
    "label": "What did you pay? (£)",
    "type": "number",
    "when": "owned"
  },
  {
    "q": 19,
    "section": "C. Ownership and purchase",
    "key": "owner_type",
    "label": "Who owns it?",
    "type": "select",
    "options": [
      "Personal names",
      "Limited company",
      "SPV"
    ],
    "when": "owned"
  },
  {
    "q": 19,
    "section": "C. Ownership and purchase",
    "key": "owning_company_name",
    "label": "Company name",
    "type": "text",
    "when": "company"
  },
  {
    "q": 19,
    "section": "C. Ownership and purchase",
    "key": "company_number",
    "label": "Company number",
    "type": "text",
    "when": "company"
  },
  {
    "q": 20,
    "section": "C. Ownership and purchase",
    "key": "connected_purchase",
    "label": "Bought from a connected or group company?",
    "type": "select",
    "options": [
      "No",
      "Yes"
    ],
    "when": "owned"
  },
  {
    "q": 20,
    "section": "C. Ownership and purchase",
    "key": "connected_seller",
    "label": "From whom?",
    "type": "text",
    "when": "connected"
  },
  {
    "q": 21,
    "section": "C. Ownership and purchase",
    "key": "purchase_price",
    "label": "Purchase price (£)",
    "type": "number",
    "when": "buying"
  },
  {
    "q": 21,
    "section": "C. Ownership and purchase",
    "key": "deposit_available",
    "label": "Deposit available (£)",
    "type": "number",
    "when": "buying"
  },
  {
    "q": 21,
    "section": "C. Ownership and purchase",
    "key": "completion_date",
    "label": "Target completion date",
    "type": "date",
    "when": "buying"
  },
  {
    "q": 22,
    "section": "C. Ownership and purchase",
    "key": "auction_date",
    "label": "Auction date",
    "type": "date",
    "when": "auction"
  },
  {
    "q": 22,
    "section": "C. Ownership and purchase",
    "key": "auction_terms",
    "label": "Completion terms in the auction notice",
    "type": "textarea",
    "when": "auction"
  },
  {
    "q": 23,
    "section": "D. Borrowing secured on the land",
    "key": "secured_lending",
    "label": "Any lending secured on the land now?",
    "type": "select",
    "options": [
      "No, it’s unencumbered",
      "Yes"
    ]
  },
  {
    "q": 24,
    "section": "D. Borrowing secured on the land",
    "key": "charges",
    "label": "Existing loans — add every loan",
    "type": "charges",
    "when": "secured_lending=Yes"
  },
  {
    "q": 27,
    "section": "D. Borrowing secured on the land",
    "key": "other_encumbrances",
    "label": "Any OTHER charge, debenture, personal guarantee or option over the land or owning company?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ]
  },
  {
    "q": 27,
    "section": "D. Borrowing secured on the land",
    "key": "other_encumbrance_details",
    "label": "Give all details, including any second charge",
    "type": "textarea",
    "when": "other_encumbrances=Yes"
  },
  {
    "q": 28,
    "section": "E. The money",
    "key": "loan_amount",
    "label": "How much do you need net, in your hands? (£)",
    "type": "number"
  },
  {
    "q": 29,
    "section": "E. The money",
    "key": "loan_purpose",
    "label": "What is the money for?",
    "type": "select",
    "options": [
      "Complete the purchase",
      "Repay the existing lender",
      "Fund the re-plan and holding costs",
      "Release equity for another project",
      "A mix"
    ]
  },
  {
    "q": 30,
    "section": "E. The money",
    "key": "term_months",
    "label": "Term needed (months)",
    "type": "select",
    "options": [
      "6",
      "9",
      "12",
      "18",
      "24"
    ]
  },
  {
    "q": 31,
    "section": "E. The money",
    "key": "repayment_preference",
    "label": "Interest",
    "type": "select",
    "options": [
      "Rolled up (no monthly payments)",
      "Paid monthly"
    ]
  },
  {
    "q": 32,
    "section": "E. The money",
    "key": "charge_request",
    "label": "Charge position offered",
    "type": "select",
    "options": [
      "First charge",
      "Second charge"
    ]
  },
  {
    "q": 33,
    "section": "F. Value and exit",
    "key": "property_value",
    "label": "What do you believe the land is worth today? (£)",
    "type": "number"
  },
  {
    "q": 33,
    "section": "F. Value and exit",
    "key": "value_reason",
    "label": "Why this value? One line",
    "type": "text"
  },
  {
    "q": 34,
    "section": "F. Value and exit",
    "key": "valuation_present",
    "label": "Any valuation report in the last 3 years?",
    "type": "select",
    "options": [
      "No",
      "Yes"
    ]
  },
  {
    "q": 34,
    "section": "F. Value and exit",
    "key": "valuation_details",
    "label": "Valuer, date, figure and which lender it was prepared for",
    "type": "textarea",
    "when": "valuation_present=Yes"
  },
  {
    "q": 35,
    "section": "F. Value and exit",
    "key": "gdv",
    "label": "Expected GDV of the consented or planned scheme (£)",
    "type": "number",
    "when": "consent"
  },
  {
    "q": 36,
    "section": "F. Value and exit",
    "key": "exit_strategy",
    "label": "Exit",
    "type": "select",
    "options": [
      "Sell the land",
      "Sell once re-planned",
      "Refinance into development finance",
      "Build and sell",
      "Other"
    ]
  },
  {
    "q": 36,
    "section": "F. Value and exit",
    "key": "exit_details",
    "label": "Other exit — one line",
    "type": "text",
    "when": "exit_strategy=Other"
  },
  {
    "q": 37,
    "section": "F. Value and exit",
    "key": "timing_driver",
    "label": "What drives the timing? Deadline, auction, option or planning expiry, or nothing",
    "type": "textarea"
  },
  {
    "q": 38,
    "section": "G. You",
    "key": "borrower_type",
    "label": "Who will borrow?",
    "type": "select",
    "options": [
      "You personally",
      "An existing company",
      "A new SPV"
    ]
  },
  {
    "q": 39,
    "section": "G. You",
    "key": "developer_experience",
    "label": "Development or land experience — one line",
    "type": "text"
  },
  {
    "q": 40,
    "section": "G. You",
    "key": "credit_profile",
    "label": "Personal credit",
    "type": "select",
    "options": [
      "Clean",
      "Historic issues",
      "Current issues"
    ]
  },
  {
    "q": 40,
    "section": "G. You",
    "key": "credit_details",
    "label": "Personal credit issues — one line",
    "type": "text",
    "when": "credit"
  },
  {
    "q": 41,
    "section": "G. You",
    "key": "business_insolvency",
    "label": "Has any of your companies ever been through, or is any now in, insolvency, receivership, administration or a CVA?",
    "type": "select",
    "options": [
      "No",
      "Yes",
      "Not sure"
    ]
  },
  {
    "q": 41,
    "section": "G. You",
    "key": "business_insolvency_details",
    "label": "Company insolvency — one line",
    "type": "text",
    "when": "business_insolvency=Yes"
  },
  {
    "q": 42,
    "section": "G. You",
    "key": "first_name",
    "label": "First name",
    "type": "text"
  },
  {
    "q": 42,
    "section": "G. You",
    "key": "last_name",
    "label": "Surname",
    "type": "text"
  },
  {
    "q": 42,
    "section": "G. You",
    "key": "mobile",
    "label": "Mobile",
    "type": "tel"
  },
  {
    "q": 42,
    "section": "G. You",
    "key": "email",
    "label": "Email",
    "type": "email"
  },
  {
    "q": 42,
    "section": "G. You",
    "key": "source_channel",
    "label": "How did you hear about us?",
    "type": "text"
  }
];
