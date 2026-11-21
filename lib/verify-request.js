import crypto from 'node:crypto';

export const SYNTHETIC = {
  full_name: 'Synthetic Verify',
  email: 'synthetic.verify@posfincapital.com',
  phone: '07700900000',
};

export function isVerifyRequest(req, env = process.env) {
  const expected = String(env.VERIFY_SECRET || '');
  const header = req && req.headers ? req.headers['x-posfin-verify'] || req.headers['X-Posfin-Verify'] : '';
  const actual = String(header || '');
  if (expected.length < 32 || Buffer.byteLength(actual) !== Buffer.byteLength(expected)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
