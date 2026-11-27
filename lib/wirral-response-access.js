import { createHash, timingSafeEqual } from 'node:crypto';
import { readCookie } from './case-http.js';

const MIN_KEY = 16;

function usable(value) {
  const text = String(value || '').trim();
  return text.length >= MIN_KEY ? text : '';
}

export function accessConfig(env = process.env) {
  const borrower = usable(env.WIRRAL_RESPONSE_KEY);
  const review = usable(env.WIRRAL_REVIEW_KEY);
  const configured = Boolean(borrower && review && borrower !== review);
  return { borrower, review, configured };
}

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function match(expected, given) {
  if (!expected || !given) return false;
  return timingSafeEqual(digest(expected), digest(given));
}

export function pageAccess(req, env = process.env) {
  const keys = accessConfig(env);
  const borrowerGiven = String(req.query?.k || '') || readCookie(req, 'pf_wirral');
  const reviewGiven = String(req.query?.rk || '') || readCookie(req, 'pf_wirral_review');
  const borrower = keys.configured && match(keys.borrower, borrowerGiven);
  const review = keys.configured && match(keys.review, reviewGiven);
  return {
    configured: keys.configured,
    borrower,
    review,
    ok: borrower || review,
  };
}

export function accessCookies(req, env = process.env) {
  const keys = accessConfig(env);
  const secure = req.headers?.['x-forwarded-proto'] === 'https' || !!env.VERCEL;
  const cookies = [];
  if (String(req.query?.k || '') && match(keys.borrower, req.query.k)) {
    cookies.push(cookie('pf_wirral', keys.borrower, secure));
  }
  if (String(req.query?.rk || '') && match(keys.review, req.query.rk)) {
    cookies.push(cookie('pf_wirral_review', keys.review, secure));
  }
  return cookies;
}

function cookie(name, value, secure) {
  const bits = [`${name}=${encodeURIComponent(value)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=2592000'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}
