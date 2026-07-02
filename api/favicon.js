/* ──────────────────────────────────────────────
   TYA Loager – Favicon API (v3)
   4 slots: i, f, w, g (Instagram, Facebook, WhatsApp, Google)
   Uses shared store for cross-route access
   ────────────────────────────────────────────── */

const multer = require('multer');
const store  = require('./_store');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

const COLORS = { i: '#E1306C', f: '#1877F2', w: '#25D366', g: '#4285F4' };
const LABELS = { i: 'IG', f: 'FB', w: 'WA', g: 'G' };

function makeDefaultFavicon(key) {
  const c = COLORS[key] || '#6366f1';
  const l = LABELS[key] || key.toUpperCase();
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
    <rect width="64" height="64" rx="14" fill="${c}"/>
    <text x="32" y="42" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="700" fill="white">${l}</text>
  </svg>`);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const key = (req.query.key || 'f').toLowerCase();
    if (store.favicons[key]) {
      res.setHeader('Content-Type', store.favicons[key].mime);
      return res.send(store.favicons[key].buffer);
    }
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(makeDefaultFavicon(key));
  }

  if (req.method === 'POST') {
    upload.single('favicon')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'No file' });
      const key = (req.body && req.body.key) ? req.body.key.toLowerCase() : 'f';
      if (!['i','f','w','g'].includes(key)) return res.status(400).json({ error: 'Invalid key' });
      store.favicons[key] = { buffer: req.file.buffer, mime: req.file.mimetype };
      return res.json({ success: true, key });
    });
    return;
  }

  res.status(405).end();
};
