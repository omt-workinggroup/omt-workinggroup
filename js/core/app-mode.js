// Inside the OMT mobile app (its WebView adds "OMTApp/" to the user agent), or its browser preview
// (?app=1), hide links back to the company site: the app is only the resource section.
const KEY = 'omt:app';
let inApp = /\bOMTApp\//.test(navigator.userAgent);
try {
  if (new URLSearchParams(location.search).has('app')) sessionStorage.setItem(KEY, '1');
  inApp = inApp || sessionStorage.getItem(KEY) === '1';
} catch {
  // Storage blocked: the user agent check still works in the app.
}
if (inApp) document.documentElement.classList.add('in-app');

export const IN_APP = inApp;
