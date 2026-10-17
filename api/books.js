// Vercel Function: /api/books?q=...  (Open Library + Google Books + Project Gutenberg)
import { createBooksHandler } from '../server/books.mjs';

const handler = createBooksHandler();

export default { fetch: (request) => handler(request) };
