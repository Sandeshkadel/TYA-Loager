/* ──────────────────────────────────────────────
   TYA Loager – Image API v4
   Multi-image store · Named images · List
   ────────────────────────────────────────────── */
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const store = require('./_store');

/* Default OG image (gradient with camera) */
const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" style="stop-color:#1e1b4b"/><stop offset="50%" style="stop-color:#312e81"/>
<stop offset="100%" style="stop-color:#1e1b4b"/></linearGradient></defs>
<rect fill="url(#g)" width="1200" height="630" rx="0"/>
<text x="600" y="280" text-anchor="middle" fill="#818cf8" font-size="72" font-family="Arial">📷</text>
<text x="600" y="360" text-anchor="middle" fill="#c7d2fe" font-size="36" font-family="Arial" font-weight="bold">Photo shared with you</text>
<text x="600" y="410" text-anchor="middle" fill="#6366f1" font-size="22" font-family="Arial">Tap to view</text>
</svg>`;

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  /* GET ?list=true → return list of image names */
  if (req.method === 'GET' && req.query.list === 'true') {
    return res.json(store.images.map(i => ({ name: i.name, type: i.type, size: i.buffer.length })));
  }

  /* GET ?name=xxx → return specific image, or GET → default / first */
  if (req.method === 'GET') {
    const name = req.query.name;
    let img = null;
    if (name) img = store.images.find(i => i.name === name);
    if (!img && store.images.length) img = store.images[0];

    if (img) {
      res.setHeader('Content-Type', img.type);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(img.buffer);
    }
    // Default SVG
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.send(DEFAULT_SVG);
  }

  /* POST — upload named image */
  if (req.method === 'POST') {
    return upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file) return res.status(400).json({ error: 'no file' });

      const name = (req.body && req.body.name) || ('img_' + Date.now());
      // Replace if same name exists
      const idx = store.images.findIndex(i => i.name === name);
      const entry = { name, buffer: req.file.buffer, type: req.file.mimetype };
      if (idx !== -1) store.images[idx] = entry;
      else store.images.push(entry);

      res.json({ ok: true, name });
    });
  }

  res.status(405).json({ error: 'method not allowed' });
};
