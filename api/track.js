// In-memory storage for Vercel Serverless Function
let users = [];

export default function handler(req, res) {
    
    // GET: Retrieve all users
    if (req.method === 'GET') {
        return res.status(200).json(users);
    }

    // POST: Receive new location data
    if (req.method === 'POST') {
        const body = req.body;
        
        // Check if user already exists, update them. If not, add new.
        const existingIndex = users.findIndex(u => u.id === body.id);
        
        if (existingIndex > -1) {
            users[ExistingIndex] = { ...users[existingIndex], ...body, lastUpdate: new Date() };
        } else {
            users.push({ ...body, lastUpdate: new Date() });
        }

        return res.status(200).json({ success: true });
    }

    // DELETE: Clear all data
    if (req.method === 'DELETE') {
        users = [];
        return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
}
