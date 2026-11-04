// Vercel Function: /api/sync
import { createSyncHandler } from '../server/catalog.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createSyncHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
