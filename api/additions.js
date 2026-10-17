// Vercel Function: /api/additions  (external books added to the OMT library)
import { createAdditionsHandler } from '../server/additions.mjs';

const handler = createAdditionsHandler();

export default { fetch: (request) => handler(request) };
