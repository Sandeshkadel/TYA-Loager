// In-memory storage
let users = [];

export default function handler(req, res) {
    const { id } = req.query;

    // ─── GET: all users ──────────────────────────────────────────
    if (req.method === 'GET') {
        return res.status(200).json(users);
    }

    // ─── POST: upsert tracking data ─────────────────────────────
    if (req.method === 'POST') {
        const body = req.body;
        const existingIndex = users.findIndex(u => u.id === body.id);
        const newUser = {
            ...body,
            lastUpdate: new Date().toISOString(),
            // preserve existing customPath/favicon if not provided
            customPath: body.customPath || (existingIndex > -1 ? users[existingIndex].customPath : body.id),
            favicon: body.favicon || (existingIndex > -1 ? users[existingIndex].favicon : 'i'),
            // always update last location
            lastLat: body.lat,
            lastLng: body.lng,
        };
        if (existingIndex > -1) {
            users[existingIndex] = { ...users[existingIndex], ...newUser };
        } else {
            users.push(newUser);
        }
        return res.status(200).json({ success: true });
    }

    // ─── PUT: update user settings (customPath, favicon) ──────
    if (req.method === 'PUT') {
        if (!id) return res.status(400).json({ error: 'User ID required' });
        const index = users.findIndex(u => u.id === id);
        if (index === -1) return res.status(404).json({ error: 'User not found' });
        const body = req.body;
        if (body.customPath !== undefined) users[index].customPath = body.customPath;
        if (body.favicon !== undefined) users[index].favicon = body.favicon;
        users[index].lastUpdate = new Date().toISOString();
        return res.status(200).json({ success: true });
    }

    // ─── DELETE: specific user or all ──────────────────────────
    if (req.method === 'DELETE') {
        if (id) {
            const index = users.findIndex(u => u.id === id);
            if (index === -1) return res.status(404).json({ error: 'User not found' });
            users.splice(index, 1);
            return res.status(200).json({ success: true });
        } else {
            users = [];
            return res.status(200).json({ success: true });
        }
    }

    res.status(405).json({ error: 'Method not allowed' });
}
