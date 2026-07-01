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
        return res.status(404).json({ error: 'No image' });
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
