export const STAGE_CHECK = [
  'enquiry', 'factfind', 'packaging', 'nda', 'data_room', 'placement',
  'terms_received', 'terms_issued', 'application', 'valuation', 'legals',
  'offer', 'completion_pending', 'completed', 'post_completion', 'closed',
];

export const PRODUCTS = ['SOMO', 'MTF', 'SUB_LOAN'];

export const PROCESSING_TASK = 'Instruct valuation / solicitors: Byron approval needed';

export const NO_AI_TOOLTIP = 'No AI contact: Byron handles';

export function processingWrite(env = process.env) {
  const requested = String(env.EL_LOR_PROCESSING_STAGE || '').trim();
  const allowed = String(env.EL_LOR_STAGE_ALLOWS_PROCESSING || '').trim().toLowerCase() === 'yes';
  if (requested === 'processing' && allowed) {
    return { stage: 'processing', label: 'Processing', checkAllows: true };
  }
  return { stage: 'application', label: 'Processing', checkAllows: false };
}
