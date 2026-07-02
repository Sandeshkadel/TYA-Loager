/* ──────────────────────────────────────────────
   TYA Loager – Shared In-Memory Store v4
   Global state shared across all serverless functions
   ────────────────────────────────────────────── */
if (!global.__tyaStore) {
  global.__tyaStore = {
    users: [],
    images: [],   // { name, buffer, type }
    favicons: {}  // key → { buffer, type }
  };
}
module.exports = global.__tyaStore;
