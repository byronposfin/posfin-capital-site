const ON = new Set(['1', 'true', 'on', 'yes']);
const OFF = new Set(['0', 'false', 'off', 'no']);

export function elLorEnabled(env = process.env) {
  const value = String(env.FEATURE_EL_LOR_DESK ?? '').trim().toLowerCase();
  if (ON.has(value)) return true;
  if (OFF.has(value)) return false;
  return String(env.VERCEL_ENV || '').trim().toLowerCase() === 'preview';
}
