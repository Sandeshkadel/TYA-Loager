import multer from 'multer';

// In-memory storage for the image (as a Buffer)
let uploadedImage = null; // will store { buffer, mimeType }

// Configure multer for memory storage (no disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Disable body parser for this route (we need raw multipart)
export const config = {
    api: {
        bodyParser: false,
    },
};

export default function handler(req, res) {
    // GET: serve the image
    if (req.method === 'GET') {
        if (uploadedImage) {
            res.setHeader('Content-Type', uploadedImage.mimeType);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(uploadedImage.buffer);
        } else {
            // Return a default image (we can redirect to a placeholder)
            // For simplicity, we return a 204 No Content, but we can also serve a default.
            // Better: serve a fallback image from a URL.
            // We'll send a 404 with a message; frontend will use fallback.
            return res.status(404).json({ error: 'No image uploaded yet' });
        }
    }

    // POST: upload a new image
    if (req.method === 'POST') {
        // Use multer to parse the multipart form
        upload.single('image')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ error: 'No image file provided' });
            }
            // Store the image in memory
            uploadedImage = {
                buffer: req.file.buffer,
                mimeType: req.file.mimetype,
            };
            return res.status(200).json({ success: true });
        });
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
