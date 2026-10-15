// Vercel Function: /api/contact
import { createContactHandler } from '../server/contact.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createContactHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
