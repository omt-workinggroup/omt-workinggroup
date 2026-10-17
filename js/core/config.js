// Site-wide settings. Nothing secret belongs in this file — it is sent to every browser.
export const SITE = {
  name: 'OMT WORKING GROUP',
  tagline: "The engineer's bookshelf",
  // Endpoint for the AI assistant (the Vercel Function in api/ai.js).
  aiEndpoint: '/api/ai',
  catalogUrl: 'data/resources.json',
  pageSize: 12,
};
