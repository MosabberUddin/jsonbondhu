// Guards the static admin portal (/admin/*). The HTML holds no secrets, but we
// still refuse to serve it without a valid admin identity and add strict headers.
import { authenticateAdmin } from '../_lib/auth.js';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  // Campaign previews load advertiser images from any https host.
  "img-src 'self' https: data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export async function onRequest(context) {
  const auth = await authenticateAdmin(context.request, context.env);
  if (!auth.ok) {
    return new Response(`${auth.status} — প্রবেশাধিকার নেই`, {
      status: auth.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const response = await context.next();
  const res = new Response(response.body, response);
  // Site-wide headers (nosniff, X-Frame-Options, Referrer-Policy) come from /_headers;
  // only admin-specific ones are set here. frame-ancestors 'none' tightens framing.
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return res;
}
