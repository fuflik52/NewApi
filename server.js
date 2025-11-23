import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, { setupDatabase } from './database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
setupDatabase();

const app = express();
const PORT = 3000;
const CUSTOM_DOMAIN = 'https://bublickrust.ru';

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

// Metadata storage (Simple JSON file for demo purposes)
// Removed: Using SQLite instead (see database/db.js)

/*
const METADATA_FILE = path.join(__dirname, 'uploads_metadata.json');
let uploadsMetadata = [];

// Load metadata on start
if (fs.existsSync(METADATA_FILE)) {
    try {
        uploadsMetadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
    } catch (e) {
        console.error("Failed to load metadata", e);
        uploadsMetadata = [];
    }
}

function saveMetadata() {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(uploadsMetadata, null, 2));
}
*/

// Serve uploads statically (keep this for backward compatibility or debugging)
app.use('/uploads', express.static(uploadsDir));

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        // Generate 10-digit random number
        const id = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const ext = path.extname(file.originalname);
        // Save as 10digits.ext
        cb(null, id + ext);
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
    const token = authHeader.split(' ')[1];

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image file provided' });
    }

    // Extract ID from filename (filename is 1234567890.ext)
    const fileId = req.file.filename.split('.')[0];
    
    // Use custom domain as requested
    const directUrl = `${CUSTOM_DOMAIN}/${fileId}`;

    // Insert into SQLite
    const stmt = db.prepare('INSERT INTO uploads (id, filename, originalname, size, mimetype, url, token, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const now = new Date().toISOString();
    
    stmt.run(
        fileId,
        req.file.filename,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        directUrl,
        token,
        now,
        (err) => {
            if (err) {
                console.error('[DB ERROR] Failed to save upload metadata', err);
                // Don't fail request, but log it
            }
            stmt.finalize();
        }
    );

    console.log(`[UPLOAD] File saved: ${req.file.filename} -> ${directUrl} (${req.file.size} bytes)`);

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

// API: List Images by Token
app.get('/api/images/list', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        // If using query param for easier testing in browser
        if (req.query.key && req.query.key.startsWith('sk_live_')) {
             // proceed
        } else {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
    }
    
    const token = authHeader ? authHeader.split(' ')[1] : req.query.key;
    
    // Get images from SQLite
    db.all('SELECT * FROM uploads WHERE token = ? ORDER BY uploaded_at DESC', [token], (err, rows) => {
        if (err) {
            console.error('[DB ERROR] Fetch images failed', err);
            return res.status(500).json({ success: false, error: 'Database Error' });
        }

        // Map to frontend expected format
        const responseImages = rows.map(img => ({
            id: img.id,
            url: img.url,
            // Convert bytes to MB with 1 decimal
            size: parseFloat((img.size / (1024 * 1024)).toFixed(2)), 
            name: img.originalname,
            uploaded_at: img.uploaded_at
        }));

        res.json(responseImages);
    });
});


// Route: Serve image by 10-digit ID
app.get('/:id', (req, res, next) => {
    const { id } = req.params;
    
    // Check if ID is exactly 10 digits
    if (!/^\d{10}$/.test(id)) {
        return next();
    }

    // Find file starting with this ID in uploads directory
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            console.error('[READ DIR ERROR]', err);
            return next();
        }

        const file = files.find(f => f.startsWith(id + '.'));
        if (file) {
            const filePath = path.join(uploadsDir, file);
            res.sendFile(filePath);
        } else {
            // Not found in uploads, proceed to next route (maybe React route)
            next();
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
🔗 Custom Domain Base: ${CUSTOM_DOMAIN}
    `);
});
