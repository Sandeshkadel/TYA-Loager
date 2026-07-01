// In-memory storage (resets on function cold start)
let users = [];

export default function handler(req, res) {
    // GET: return all users
    if (req.method === 'GET') {
        return res.status(200).json(users);
    }

    // POST: upsert user data
    if (req.method === 'POST') {
        const body = req.body;
        const existingIndex = users.findIndex(u => u.id === body.id);
        const newUser = { ...body, lastUpdate: new Date().toISOString() };
        if (existingIndex > -1) {
            users[existingIndex] = { ...users[existingIndex], ...newUser };
        } else {
            users.push(newUser);
        }
        return res.status(200).json({ success: true });
    }

    // DELETE: clear all data
    if (req.method === 'DELETE') {
        users = [];
        return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
}
