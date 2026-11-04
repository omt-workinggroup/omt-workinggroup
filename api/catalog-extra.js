// Vercel Function: /api/catalog-extra
import { createCatalogExtraHandler } from '../server/catalog.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createCatalogExtraHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
