// Intentionally empty. Without a local config, Vite's upward search finds the
// repo root's Next.js postcss.config.mjs (@tailwindcss/postcss) and crashes —
// mcp-app is a standalone package and uses no Tailwind. Do not delete.
export default {
  plugins: {},
};
