/* The home page's visitor counter (app.js fetchVisits), kept first-party and inert.

   The counter lives at a third-party service. A plain proxy rule would hand whatever that
   service answers to the browser under this site's own address: it returns JavaScript for a
   ?callback= query, and any of its other paths would be served here too. A script served from
   our own address is exactly what the Content-Security-Policy in _headers trusts, so this
   function is the only way through. It accepts the two requests the app makes, never forwards
   a query string, and answers with a number it has checked. Everything else is 404. */

const UPSTREAM = 'https://abacus.jasoncameron.dev';
const COUNTER = 'cortexmedacademy/people';
const ACTIONS = { hit: 'hit', get: 'get' };
const TIMEOUT_MS = 5000;

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      // _headers does not reach function responses, so the type guard is set here.
      'X-Content-Type-Options': 'nosniff',
    },
  });

// '/cx-visits/hit/cortexmedacademy/people' -> 'hit'; any other path -> null.
export function action(pathname) {
  const match = /^\/cx-visits\/([a-z]+)\/(.+)$/.exec(pathname);
  if (!match || match[2] !== COUNTER || !Object.hasOwn(ACTIONS, match[1])) return null;
  return ACTIONS[match[1]];
}

// The service's answer is trusted for one thing only: a whole, non-negative number.
export function count(body) {
  const value = body && typeof body === 'object' ? body.value : undefined;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export default async request => {
  const wanted = action(new URL(request.url).pathname);
  if (!wanted) return reply(404, { error: 'Not found' });
  if (request.method !== 'GET') return reply(405, { error: 'Method not allowed' });
  try {
    const answer = await fetch(`${UPSTREAM}/${wanted}/${COUNTER}`, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const value = answer.ok ? count(await answer.json()) : null;
    return value === null ? reply(502, { error: 'Counter unavailable' }) : reply(200, { value });
  } catch {
    return reply(502, { error: 'Counter unavailable' });
  }
};

export const config = { path: '/cx-visits/*' };
