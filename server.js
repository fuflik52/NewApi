import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, { setupDatabase } from './database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const CUSTOM_DOMAIN = 'https://bublickrust.ru/img';

// Middleware
// Configure CORS specifically for Figma plugins (origin: 'null') and web clients
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or Figma "null" origin)
        if (!origin || origin === 'null') return callback(null, true);
        // Allow any other origin
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true
}));

// Explicit OPTIONS handler for preflight with the same config
app.options('*', cors({
    origin: function (origin, callback) {
        if (!origin || origin === 'null') return callback(null, true);
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());

// Static files from React build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
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
        const id = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const ext = path.extname(file.originalname);
        cb(null, id + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Initialize Database and Start Server
setupDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`
🚀 Server running on http://0.0.0.0:${PORT}
📂 Serving static files from ${distPath}
📂 Uploads directory: ${uploadsDir}
🔗 Custom Domain Base: ${CUSTOM_DOMAIN}
        `);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
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

    const fileId = req.file.filename.split('.')[0];
    const directUrl = `${CUSTOM_DOMAIN}/${fileId}`;
    const now = new Date().toISOString();

    const stmt = db.prepare('INSERT INTO uploads (id, filename, originalname, size, mimetype, url, token, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
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
        if (req.query.key && req.query.key.startsWith('sk_live_')) {
             // proceed
        } else {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
    }
    
    const token = authHeader ? authHeader.split(' ')[1] : req.query.key;
    
    db.all('SELECT * FROM uploads WHERE token = ? ORDER BY uploaded_at DESC', [token], (err, rows) => {
        if (err) {
            console.error('[DB ERROR] Fetch images failed', err);
            return res.status(500).json({ success: false, error: 'Database Error' });
        }

        const responseImages = rows.map(img => ({
            id: img.id,
            url: img.url,
            size: parseFloat((img.size / (1024 * 1024)).toFixed(2)), 
            name: img.originalname,
            uploaded_at: img.uploaded_at
        }));

        res.json(responseImages);
    });
});

// Route: Serve image by 10-digit ID
app.get('/img/:id', (req, res, next) => {
    const { id } = req.params;
    if (!/^\d{10}$/.test(id)) {
        return next();
    }

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
            next();
        }
    });
});

// Error Handler for Multer and others
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Upload Error: ${err.message}` });
    } else if (err) {
        console.error('[SERVER ERROR]', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
    next();
});

// Catch-all: Serve index.html for React Router (SPA)
app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/img')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});
