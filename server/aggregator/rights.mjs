// Rights verification: turns a source's licence statement into what OMT may and may not do with a book.
// Never treat an unknown licence as permission. Only APPROVED and CONDITIONAL items can be hosted or
// downloaded through OMT; REVIEW_REQUIRED items with a known licence stay discoverable as external links.

export const STATES = ['APPROVED', 'CONDITIONAL', 'REVIEW_REQUIRED', 'REJECTED'];

// code -> display name, canonical URL and permissions (redistribute, modify, commercial).
export const LICENCES = {
  'pd': { name: 'Public domain', url: 'https://creativecommons.org/publicdomain/mark/1.0/', redistribute: true, modify: true, commercial: true, attribution: false },
  'cc0': { name: 'CC0 1.0 (public domain dedication)', url: 'https://creativecommons.org/publicdomain/zero/1.0/', redistribute: true, modify: true, commercial: true, attribution: false },
  'cc-by': { name: 'CC BY', url: 'https://creativecommons.org/licenses/by/4.0/', redistribute: true, modify: true, commercial: true, attribution: true },
  'cc-by-sa': { name: 'CC BY-SA', url: 'https://creativecommons.org/licenses/by-sa/4.0/', redistribute: true, modify: true, commercial: true, attribution: true, shareAlike: true },
  'cc-by-nd': { name: 'CC BY-ND', url: 'https://creativecommons.org/licenses/by-nd/4.0/', redistribute: true, modify: false, commercial: true, attribution: true },
  'cc-by-nc': { name: 'CC BY-NC', url: 'https://creativecommons.org/licenses/by-nc/4.0/', redistribute: true, modify: true, commercial: false, attribution: true },
  'cc-by-nc-sa': { name: 'CC BY-NC-SA', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/', redistribute: true, modify: true, commercial: false, attribution: true, shareAlike: true },
  'cc-by-nc-nd': { name: 'CC BY-NC-ND', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/', redistribute: true, modify: false, commercial: false, attribution: true },
  'gfdl': { name: 'GNU Free Documentation License', url: 'https://www.gnu.org/licenses/fdl-1.3.html', redistribute: true, modify: true, commercial: true, attribution: true, shareAlike: true },
  'arr': { name: 'All rights reserved', url: null, redistribute: false, modify: false, commercial: false, attribution: true },
  'unknown': { name: 'Unknown licence', url: null, redistribute: false, modify: false, commercial: false, attribution: true },
};

/** Map any licence text or URL a source gives us to one of the codes above. */
export function parseLicence(raw) {
  const s = String(raw ?? '').toLowerCase().trim();
  if (!s) return 'unknown';
  if (/all rights reserved|^arr$|^copyright(ed)?$/.test(s)) return 'arr';
  if (/publicdomain\/zero|\bcc0\b|cc ?zero/.test(s)) return 'cc0';
  if (/public ?domain|publicdomain\/mark|^pd$/.test(s)) return 'pd';
  if (/gfdl|gnu free documentation/.test(s)) return 'gfdl';
  let parts;
  const fromUrl = s.match(/creativecommons\.org\/licenses\/([a-z-]+)/)?.[1];
  if (fromUrl) parts = fromUrl.split('-');
  else if (/^(cc-?)?by(-?(nc|nd|sa))*(-?[\d.]+)?$/.test(s.replace(/[\s_]/g, ''))) {
    // Compact codes such as "ccbyncsa", "CC-BY-NC-SA-4.0", "by-sa"
    parts = s.replace(/[\s_]/g, '').replace(/^cc-?/, '').match(/by|nc|nd|sa/g);
  } else if (/creative ?commons|\bcc\b/.test(s) && /attribution|\bby\b/.test(s)) {
    const words = s.replace(/attribution/g, ' by ').replace(/non-?commercial/g, ' nc ').replace(/share-?alike/g, ' sa ').replace(/no-?deriv\w*/g, ' nd ');
    parts = words.split(/[^a-z]+/).filter(Boolean);
  } else return 'unknown';
  if (!parts.includes('by')) return 'unknown';
  const nc = parts.includes('nc'), nd = parts.includes('nd'), sa = parts.includes('sa');
  if (nc && nd) return 'cc-by-nc-nd';
  if (nc && sa) return 'cc-by-nc-sa';
  if (nc) return 'cc-by-nc';
  if (nd) return 'cc-by-nd';
  if (sa) return 'cc-by-sa';
  return 'cc-by';
}

/**
 * Decide the rights record for one item.
 * @param {object} input
 * @param {string} input.licence      licence text or URL from the source
 * @param {string} [input.licenceUrl] the source's own licence link, kept as evidence
 * @param {string} input.evidence     where the licence statement came from (e.g. "OpenStax CMS API: license_name")
 * @param {boolean} [input.selfDeclared] licence was set by an uploader, not a publisher (e.g. Internet Archive)
 * @param {string} [input.jurisdictionNote] e.g. public domain in the USA only
 * @param {string} [input.attribution] who to credit
 */
export function verifyRights({ licence, licenceUrl, evidence, selfDeclared = false, jurisdictionNote = '', attribution = '' }) {
  const code = parseLicence(licence || licenceUrl);
  const lic = LICENCES[code];
  const notes = [];
  let state;
  if (code === 'arr') state = 'REJECTED';
  else if (code === 'unknown') { state = 'REVIEW_REQUIRED'; notes.push('No licence found: not published until an administrator checks it.'); }
  else if (selfDeclared) { state = 'REVIEW_REQUIRED'; notes.push('Licence was declared by the uploader, not the publisher: check before hosting.'); }
  else if (!lic.commercial) { state = 'REVIEW_REQUIRED'; notes.push('NonCommercial licence: confirm OMT’s use is noncommercial before hosting or offering downloads.'); }
  else if (!lic.modify || jurisdictionNote) state = 'CONDITIONAL';
  else state = 'APPROVED';
  if (!lic.modify && code !== 'arr' && code !== 'unknown') notes.push('No derivatives: share only the unchanged original.');
  if (lic.shareAlike) notes.push('ShareAlike: adaptations must use the same licence.');
  if (jurisdictionNote) notes.push(jurisdictionNote);
  const hostable = state === 'APPROVED' || state === 'CONDITIONAL';
  return {
    licence_code: code,
    licence_name: lic.name,
    licence_url: licenceUrl || lic.url,
    rights_state: state,
    rights_evidence: evidence,
    attribution: lic.attribution ? (attribution || 'See the original source for author credits.') : '',
    can_redistribute: hostable && lic.redistribute,
    can_download: hostable && lic.redistribute,
    can_read_on_omt: hostable && lic.redistribute,
    can_modify: hostable && lic.modify,
    can_commercial: lic.commercial,
    // Discoverable as a link to the official page when the licence is known and came from the publisher
    // (NonCommercial included). Unknown and uploader-declared licences stay hidden until reviewed.
    listable: state !== 'REJECTED' && code !== 'unknown' && !selfDeclared,
    rights_notes: notes.join(' '),
  };
}
