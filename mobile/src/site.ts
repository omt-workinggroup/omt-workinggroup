// Where the app's pages come from. The app shows the resource section of the website.
// Override for local testing with EXPO_PUBLIC_SITE_URL, e.g. http://192.168.1.20:8080
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://omt-workinggroup.com').replace(/\/$/, '');
export const START_URL = `${SITE_URL}/resources.html?app=1`;

// The website reads this from the user agent and hides links back to the company site.
export const APP_USER_AGENT = 'OMTApp/1.0';

const SITE_HOSTS = new Set([new URL(SITE_URL).host, 'www.omt-workinggroup.com', 'omt-working-group.vercel.app']);
const DOWNLOAD = /\.(pdf|docx?|xlsx?|pptx?|zip|epub)(\?|$)/i;

export type Route = { kind: 'load' } | { kind: 'start' } | { kind: 'external' };

// Decide what to do with a link the reader taps.
export function routeFor(url: string): Route {
  let u: URL;
  try { u = new URL(url); } catch { return { kind: 'load' }; }
  if (u.protocol === 'about:' || u.protocol === 'data:' || u.protocol === 'blob:') return { kind: 'load' };
  if (!/^https?:$/.test(u.protocol)) return { kind: 'external' }; // mailto:, tel:, intents
  if (!SITE_HOSTS.has(u.host)) return { kind: 'external' }; // publishers, Open Library, Microsoft…
  if (DOWNLOAD.test(u.pathname)) return { kind: 'external' }; // let the phone download and open files
  // The company homepage is not part of the app: send it to the resources front page instead.
  if (u.pathname === '/' || u.pathname === '/index.html') return { kind: 'start' };
  return { kind: 'load' };
}
