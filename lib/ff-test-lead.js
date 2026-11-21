// A declared test is still saved. It must not count as a live lead or send a live alert.
export function looksLikeTestLead(answers) {
  if (!answers || typeof answers !== 'object') return false;
  const blob = [answers.full_name, answers.company_name, answers.notes].map((part) => String(part || '')).join('\n');
  return /(^|[^A-Za-z])TEST([^A-Za-z]|$)/i.test(blob);
}

export function referencePrefix(cfg, answers) {
  const backend = cfg && cfg.backend;
  if (!backend) return 'POSFIN-WEB-';
  if ((cfg.testRun || looksLikeTestLead(answers)) && backend.testRef) return backend.testRef;
  return backend.ref || 'POSFIN-WEB-';
}

export function responseTestMode(cfg, answers) {
  return !!((cfg && cfg.backend && cfg.backend.test) || (cfg && cfg.testRun) || looksLikeTestLead(answers));
}
