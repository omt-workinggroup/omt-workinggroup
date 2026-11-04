// Wikibooks: the MediaWiki API, books in the computing and maths subject categories.
// Text is CC BY-SA 4.0 under the Wikimedia Terms of Use; books are read on Wikibooks itself.
import { http } from '../normalize.mjs';

const CATEGORIES = ['Category:Subject:Computing', 'Category:Subject:Computer science', 'Category:Subject:Computer programming', 'Category:Subject:Mathematics', 'Category:Subject:Engineering'];

export default {
  id: 'wikibooks',
  prefix: 'wb',
  async next(cursor, { fetchImpl }) {
    const i = cursor?.cat ?? 0;
    const params = new URLSearchParams({
      action: 'query', format: 'json', generator: 'categorymembers', gcmtitle: CATEGORIES[i], gcmtype: 'page', gcmnamespace: '0', gcmlimit: '50',
      prop: 'extracts|info', exintro: '1', explaintext: '1', exsentences: '3', exlimit: '50', inprop: 'url', maxlag: '5',
      ...(cursor?.cont ?? {}),
    });
    const data = await http(`https://en.wikibooks.org/w/api.php?${params}`, { fetchImpl });
    const pages = Object.values(data.query?.pages ?? {});
    const records = pages.filter((p) => p.ns === 0 && !p.title.includes('/')).map((p) => ({
      source_id: String(p.pageid),
      title: p.title,
      authors: 'Wikibooks contributors',
      publisher: 'Wikibooks',
      description: p.extract,
      source_url: p.fullurl,
      read_url: p.fullurl,
      licence: 'CC BY-SA 4.0',
      licence_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
      evidence: 'Wikibooks site licence (Wikimedia Terms of Use: CC BY-SA 4.0)',
      attribution: `Wikibooks contributors, “${p.title}”, ${p.fullurl}`,
      hint: CATEGORIES[i].replace('Category:Subject:', ''),
    }));
    let next;
    if (data.continue) next = { cat: i, cont: data.continue };
    else if (i + 1 < CATEGORIES.length) next = { cat: i + 1 };
    else next = { done: true, at: new Date().toISOString() };
    return { records, cursor: next };
  },
};
