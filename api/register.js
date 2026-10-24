// Vercel Function: /api/register
import { createRegisterHandler } from '../server/register.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createRegisterHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
