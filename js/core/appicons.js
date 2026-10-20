// Microsoft 365 app icons. Each <img> loads Microsoft's own icon from its Fluent UI CDN
// (always the latest design). If that fails, layout.js swaps in the local copy from
// assets/icons/apps/ (via the data-fallback attribute).
export const APP_ICON_CDN = 'https://res.cdn.office.net/files/fabric-cdn-prod_20260917.001/assets/brand-icons/product/svg/';
export const APPS = ['word', 'excel', 'powerpoint', 'access', 'outlook'];
const NAMES = { word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint', access: 'Access', outlook: 'Outlook' };

export function appIconHTML(app, size = 48, cls = '') {
  if (!APPS.includes(app)) return '';
  return `<img class="${cls}" src="${APP_ICON_CDN}${app}_48x1.svg" data-fallback="assets/icons/apps/${app}.svg" alt="" width="${size}" height="${size}" decoding="async" title="Microsoft ${NAMES[app]}">`;
}
