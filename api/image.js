import multer from 'multer';

let ogImage = null;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only images'), false);
    }
});

export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
    if (req.method === 'GET') {
        if (ogImage) {
            res.setHeader('Content-Type', ogImage.mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(ogImage.buffer);
        }
        // Return a placeholder so crawlers see something
        const placeholder = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
                <rect width="1200" height="630" fill="#0f172a"/>
                <text x="600" y="315" font-size="60" fill="#6366f1" text-anchor="middle" font-family="sans-serif">TYA Loager</text>
                <text x="600" y="380" font-size="30" fill="#94a3b8" text-anchor="middle">Shared Image</text>
            </svg>`
        );
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(placeholder);
    }
    if (req.method === 'POST') {
        upload.single('image')(req, res, (err) => {
            if (err) return res.status(400).json({ error: err.message });
            if (!req.file) return res.status(400).json({ error: 'No file' });
            ogImage = { buffer: req.file.buffer, mimeType: req.file.mimetype };
            return res.status(200).json({ success: true });
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
