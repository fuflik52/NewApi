import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Static files from React build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Uploads directory
const uploadsDir = path.join(__dirname, 'dist', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Use original name or timestamp + name to avoid collisions, 
        // but for this use case, keeping original name is often preferred for the plugin logic
        // providing it doesn't overwrite unintentionally.
        // Let's prepend a unique suffix.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// API Routes

// API: Upload Image
app.post('/api/images/upload', upload.single('image'), (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const directUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    console.log(`[UPLOAD] File saved: ${req.file.filename} (${req.file.size} bytes)`);

    res.json({
        success: true,
        directUrl: directUrl,
        file: {
            name: req.file.originalname,
            size: req.file.size,
            mime: req.file.mimetype
        }
    });
});

// Error Handler for Multer and others
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        return res.status(400).json({ success: false, error: `Upload Error: ${err.message}` });
    } else if (err) {
        // An unknown error occurred when uploading.
        console.error('[SERVER ERROR]', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
    next();
});

// API: Generic mock for other endpoints
// Removing wildcard route temporarily to fix path-to-regexp issues in Express 5 environment
// app.post('/api/:path*', (req, res) => { ... });

// Catch-all: Serve index.html for React Router (SPA)
// Note: Using RegExp for compatibility with newer Express/path-to-regexp where strings are strict
app.get(/.*/, (req, res) => {
    // Don't intercept API calls or static assets if they fall through
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Server running on http://0.0.0.0:${PORT}
📂 Serving static files from ${distPath}
📂 Uploads directory: ${uploadsDir}
    `);
});

