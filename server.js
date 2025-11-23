import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import axios from 'axios';
import { fileURLToPath } from 'url';
import db, { setupDatabase } from './database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Use environment port or fallback to 3000
const PORT = process.env.PORT || 3000;
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
app.options(/.*/, cors({
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
    // Listen on all interfaces (default if no host specified, or use '0.0.0.0')
    app.listen(PORT, () => {
        const nets = os.networkInterfaces();
        const results = Object.create(null); 

        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    if (!results[name]) {
                        results[name] = [];
                    }
                    results[name].push(net.address);
                }
            }
        }

        console.log(`
🚀 Server running on port ${PORT}
🌐 Local: http://localhost:${PORT}
🌐 Network: http://${Object.values(results).flat()[0] || '0.0.0.0'}:${PORT}
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

// Discord Auth Configuration
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
// Default to port 3000 if not specified, but since PORT is defined above, we can use it?
// Variable PORT is defined in scope.
// However, we need to be careful if PORT is determined at runtime. 
// Let's assume localhost:3000 for development default or use the PORT variable.
// We need to construct the URI dynamically if not provided.
const getRedirectUri = () => process.env.DISCORD_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/auth/discord/callback`;

// API: Discord Login Redirect
app.get('/api/auth/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) {
        return res.status(500).send('Discord Client ID is missing on server.');
    }
    const redirectUri = getRedirectUri();
    const redirectUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email`;
    res.redirect(redirectUrl);
});

// API: Discord Callback
app.get('/api/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided.');

    try {
        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        const redirectUri = getRedirectUri();

        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const { id, username, discriminator, avatar, email } = userResponse.data;
        
        // Generate simple API token
        const apiToken = 'sk_live_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) {
                console.error('DB Error:', err);
                return res.status(500).send('Database error.');
            }
            
            const finalToken = row && row.api_token ? row.api_token : apiToken;
            
            if (row) {
                // Update user (preserve is_admin)
                db.run('UPDATE users SET username = ?, discriminator = ?, avatar = ?, email = ? WHERE id = ?', 
                    [username, discriminator, avatar, email, id]);
            } else {
                // Create user
                db.run('INSERT INTO users (id, username, discriminator, avatar, email, api_token, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
                    [id, username, discriminator, avatar, email, finalToken, new Date().toISOString()]);
            }
            
            // Redirect to frontend with token
            res.redirect(`/?token=${finalToken}`);
        });

    } catch (error) {
        console.error('Discord Auth Error:', error.response?.data || error.message);
        
        // Show user-friendly error page
        const errorMessage = error.response?.data?.error_description || error.message || 'Authentication failed';
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ошибка входа | CosmoSpace</title>
                <meta charset="UTF-8">
                <style>
                    body { background: #030014; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: rgba(255, 255, 255, 0.05); padding: 2rem; border-radius: 1rem; border: 1px solid rgba(255, 255, 255, 0.1); text-align: center; max-width: 400px; }
                    h1 { color: #FF4D4D; margin-top: 0; }
                    p { opacity: 0.8; margin-bottom: 1.5rem; }
                    a { background: #7042f88b; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; transition: 0.2s; }
                    a:hover { background: #7042f8; }
                    code { background: rgba(0,0,0,0.3); padding: 4px; border-radius: 4px; display: block; margin: 10px 0; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Ошибка входа</h1>
                    <p>Не удалось войти через Discord.</p>
                    <code>${errorMessage}</code>
                    <a href="/">Вернуться на главную</a>
                </div>
            </body>
            </html>
        `);
    }
});

// API: Get Current User Info (and Admin Status)
app.get('/api/user/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];

    db.get('SELECT id, username, email, avatar, is_admin FROM users WHERE api_token = ?', [token], (err, row) => {
        if (err) {
             console.error('DB Error:', err);
             return res.status(500).json({ success: false, error: 'Database Error' });
        }
        if (!row) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, user: row });
    });
});

// API: Promote to Admin (Secret Command)
app.post('/api/admin/claim', (req, res) => {
    const { code } = req.body;
    const authHeader = req.headers.authorization;
    
    if (code !== 'bublickAA') {
        return res.status(403).json({ success: false, error: 'Invalid command code' });
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];

    db.run('UPDATE users SET is_admin = 1 WHERE api_token = ?', [token], function(err) {
        if (err) {
            console.error('DB Error:', err);
            return res.status(500).json({ success: false, error: 'Database Error' });
        }
        res.json({ success: true, message: 'Access Granted. Welcome, Commander.' });
    });
});

// API: Get Stats (Real Data) - Admin Only
app.get('/api/stats', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];

    // Check if requester is admin
    db.get('SELECT is_admin FROM users WHERE api_token = ?', [token], (err, row) => {
        if (err || !row || !row.is_admin) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        // Count users
        db.get('SELECT COUNT(*) as count FROM users', (err, userRow) => {
            if (err) return res.status(500).json({ error: 'DB Error' });
            
            // Count uploads and size
            db.get('SELECT COUNT(*) as count, SUM(size) as total_size FROM uploads', (err, uploadRow) => {
                if (err) return res.status(500).json({ error: 'DB Error' });
                
                const stats = {
                    users: userRow.count,
                    uploads: uploadRow.count,
                    storage_bytes: uploadRow.total_size || 0,
                    requests: 0 // We don't track requests in DB yet
                };
                res.json(stats);
            });
        });
    });
});

// API: List All Users (Admin Only)
app.get('/api/admin/users', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];

    // Check if requester is admin
    db.get('SELECT is_admin FROM users WHERE api_token = ?', [token], (err, row) => {
        if (err || !row || !row.is_admin) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        // Fetch all users
        db.all('SELECT id, username, email, avatar, api_token, is_admin, created_at FROM users', (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'DB Error' });
            }
            res.json(rows);
        });
    });
});

// API: Ping (CORS test)
app.get('/api/ping', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Pong!', 
        origin: req.headers.origin || 'no-origin',
        cors_headers: res.getHeaders ? res.getHeaders() : 'unknown' 
    });
});

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
