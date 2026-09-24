// Guards every /api/admin/* route: authentication + same-origin check for writes.
import { authenticateAdmin } from '../../_lib/auth.js';
import { error, isSameOrigin } from '../../_lib/http.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function onRequest(context) {
  const { request, env } = context;

  const auth = await authenticateAdmin(request, env);
  if (!auth.ok) return error(auth.status, auth.reason);

  // CSRF defence: the Access session is a cookie, so writes must come from our own pages.
  if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return error(403, 'Cross-origin request rejected');
  }

  context.data.admin = { email: auth.email, via: auth.via };
  const response = await context.next();
  const res = new Response(response.body, response);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
}
