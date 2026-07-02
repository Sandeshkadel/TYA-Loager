import multer from 'multer';

const favicons = {};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

export const config = {
    api: {
        bodyParser: false,
    },
};

export default function handler(req, res) {
    let name = req.query.name;
    if (!name) {
        const parts = req.url.split('/');
        const last = parts[parts.length - 1];
        if (['i', 'f', 'w', 'g'].includes(last)) {
            name = last;
        }
    }

    if (req.method === 'GET') {
        if (!name || !['i', 'f', 'w', 'g'].includes(name)) {
            return res.status(400).json({ error: 'Invalid favicon name. Use i, f, w, or g' });
        }
        const fav = favicons[name];
        if (fav) {
            res.setHeader('Content-Type', fav.mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(fav.buffer);
        }
        const colors = { i: '#8b5cf6', f: '#f59e0b', w: '#10b981', g: '#ef4444' };
        const color = colors[name] || '#6366f1';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="12" fill="${color}" />
            <text x="32" y="42" font-size="28" font-weight="bold" text-anchor="middle" fill="white">${name.toUpperCase()}</text>
        </svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.status(200).send(svg);
    }

    if (req.method === 'POST') {
        if (!name || !['i', 'f', 'w', 'g'].includes(name)) {
            return res.status(400).json({ error: 'Invalid favicon name. Use i, f, w, or g' });
        }

        upload.single('image')(req, res, (err) => {
            if (err) {
                console.error('Multer error:', err);
                return res.status(400).json({ error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No image file provided' });
            }
            favicons[name] = {
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
            };
            return res.status(200).json({ success: true, name });
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
