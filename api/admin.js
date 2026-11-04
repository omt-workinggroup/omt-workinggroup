// Vercel Function: /api/admin
import { createAdminHandler } from '../server/catalog.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createAdminHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
