// Vercel Function: /api/ai
import { createHandler } from '../server/ai.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
