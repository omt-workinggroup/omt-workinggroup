// Vercel Function: /api/community (student accounts, lounge, Q&A, projects, opportunities, events, challenges, moderation)
import { createCommunityHandler } from '../server/community.mjs';
import { clientIp } from '../server/http.mjs';

const handler = createCommunityHandler();

export default {
  fetch(request) {
    return handler(request, { ip: clientIp(request) });
  },
};
