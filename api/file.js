// Vercel Function: /api/file
import { createFileHandler } from '../server/catalog.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createFileHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
