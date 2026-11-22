export function elLorEnabled(env = process.env) {
  const value = String(env.FEATURE_EL_LOR_DESK ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}
