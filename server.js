import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { supabase } from './database/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CUSTOM_DOMAIN = process.env.CUSTOM_DOMAIN || `https://bublickrust.ru/img`; 

// IMPORTANT: Set this to your Supabase Project URL
const SUPABASE_PROJECT_URL = process.env.SUPABASE_URL; 
// Bucket name we agreed on
const STORAGE_BUCKET = 'images'; 

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin === 'null') return callback(null, true);
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true
}));

app.options(/.*/, cors({
    origin: function (origin, callback) {
        if (!origin || origin === 'null') return callback(null, true);
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());

// Static files (React App)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Multer Config (Memory Storage - we don't save to disk anymore)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// --- AUTH MIDDLEWARE (Supabase Version) ---
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token format' });
    }
    const token = authHeader.split(' ')[1];

    try {
        // 1. Find token in api_keys
        const { data: keyData, error: keyError } = await supabase
            .from('api_keys')
            .select('user_id, requests_count')
            .eq('token', token)
            .single();

        if (keyError || !keyData) {
            return res.status(401).json({ success: false, error: 'Invalid Token' });
        }

        // 2. Update stats (async)
        supabase.from('api_keys')
            .update({ 
                last_used_at: new Date().toISOString(),
                requests_count: (keyData.requests_count || 0) + 1 
            })
            .eq('token', token)
            .then(({ error }) => {
                if (error) console.error('Failed to update token stats', error);
            });

        // 3. Get user info
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, is_admin')
            .eq('id', keyData.user_id)
            .single();

        if (userError || !userData) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        req.user = { 
            id: userData.id, 
            token: token, 
            is_admin: userData.is_admin 
        };
        return next();

    } catch (err) {
        console.error('Auth Middleware Error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

// --- API ROUTES ---

// Test Login
app.post('/api/auth/test-login', async (req, res) => {
    const { code } = req.body;
    if (code !== 'entrance') {
        return res.status(403).json({ error: 'Invalid code' });
    }

    const testId = 'test-user-id';
    const testEmail = 'test@bublickrust.ru';
    const testIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    try {
        const { error: userError } = await supabase
            .from('users')
            .upsert({
                id: testId,
                username: 'Test User',
                discriminator: '0000',
                email: testEmail,
                ip_address: testIp
            }, { onConflict: 'id' });

        if (userError) throw userError;

        const { data: existingKeys } = await supabase
            .from('api_keys')
            .select('token')
            .eq('user_id', testId)
            .limit(1);

        let token;
        if (existingKeys && existingKeys.length > 0) {
            token = existingKeys[0].token;
        } else {
            token = 'sk_live_test_' + Math.random().toString(36).substring(2);
            await supabase.from('api_keys').insert({
                user_id: testId,
                token: token,
                name: 'Test Key'
            });
        }

        res.json({ success: true, token });
    } catch (err) {
        console.error('Test Login Error:', err);
        res.status(500).json({ error: 'Database Error' });
    }
});

// Discord Auth Redirect
app.get('/api/auth/discord', (req, res) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/api/auth/discord/callback`;
    if (!clientId) return res.status(500).send('Missing Discord Client ID');
    const url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20email`;
    res.redirect(url);
});

// Discord Callback
app.get('/api/auth/discord/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code');

    try {
        const redirectUri = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/api/auth/discord/callback`;
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
        }));

        const accessToken = tokenResponse.data.access_token;
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const { id, username, discriminator, avatar, email } = userResponse.data;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        await supabase.from('users').upsert({
            id: id,
            username: username,
            discriminator: discriminator,
            avatar: avatar,
            email: email,
            ip_address: ip
        }, { onConflict: 'id' });

        const { data: keys } = await supabase
            .from('api_keys')
            .select('token')
            .eq('user_id', id)
            .limit(1);

        let finalToken;
        if (keys && keys.length > 0) {
            finalToken = keys[0].token;
        } else {
            finalToken = 'sk_live_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
            await supabase.from('api_keys').insert({
                user_id: id,
                token: finalToken,
                name: 'Default Key'
            });
        }

        res.redirect(`/?token=${finalToken}`);

    } catch (error) {
        console.error('Discord Auth Error:', error);
        res.status(500).send('Authentication Failed');
    }
});

// Get User
app.get('/api/user/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer sk_live_')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];

    try {
        const { data: keyData } = await supabase.from('api_keys').select('user_id').eq('token', token).single();
        if (!keyData) return res.status(404).json({ error: 'Token not found' });

        const { data: userData } = await supabase.from('users').select('*').eq('id', keyData.user_id).single();
        if (!userData) return res.status(404).json({ error: 'User not found' });
        
        userData.api_token = token; 
        res.json({ success: true, user: userData });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Token Management
app.get('/api/tokens', verifyToken, async (req, res) => {
    try {
        const { data: tokens, error } = await supabase
            .from('api_keys')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(tokens);
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.post('/api/tokens', verifyToken, async (req, res) => {
    try {
        const { count } = await supabase.from('api_keys').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id);
        if (count >= 3) return res.status(400).json({ success: false, error: 'Maximum of 3 tokens allowed.' });

        const newToken = 'sk_live_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        const name = req.body.name || `Key ${count + 1}`;

        const { data, error } = await supabase.from('api_keys').insert({ user_id: req.user.id, token: newToken, name }).select().single();
        if (error) throw error;
        res.json({ success: true, token: data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create token' });
    }
});

app.delete('/api/tokens/:id', verifyToken, async (req, res) => {
    try {
        const { error } = await supabase.from('api_keys').delete().eq('id', req.params.id).eq('user_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete token' });
    }
});

// Admin Claim
app.post('/api/admin/claim', async (req, res) => {
    const { code } = req.body;
    if (code !== 'bublickAA') return res.status(403).json({ error: 'Invalid code' });
    
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];

    try {
        const { data: keyData } = await supabase.from('api_keys').select('user_id').eq('token', token).single();
        if (!keyData) return res.status(401).json({ error: 'Invalid token' });

        await supabase.from('users').update({ is_admin: true }).eq('id', keyData.user_id);
        res.json({ success: true, message: 'Access Granted' });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Admin Stats
app.get('/api/stats', verifyToken, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const [usersRes, uploadsRes] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('uploads').select('*', { count: 'exact', head: true })
        ]);
        const { data: sizes } = await supabase.from('uploads').select('size');
        const totalSize = sizes ? sizes.reduce((acc, row) => acc + (row.size || 0), 0) : 0;

        res.json({ users: usersRes.count || 0, uploads: uploadsRes.count || 0, storage_bytes: totalSize, requests: 0 });
    } catch (err) {
        res.status(500).json({ error: 'Stats Error' });
    }
});

app.get('/api/admin/users', verifyToken, async (req, res) => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });
    try {
        const { data: users, error } = await supabase
            .from('users')
            .select(`*, api_keys (token, requests_count)`);
        if (error) throw error;
        const enhancedUsers = users.map(u => ({
            ...u,
            api_token: u.api_keys?.[0]?.token || 'No Token',
            request_count: u.api_keys?.reduce((acc, k) => acc + (k.requests_count || 0), 0) || 0
        }));
        res.json(enhancedUsers);
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// --- NEW: UPLOAD TO SUPABASE STORAGE ---
app.post('/api/images/upload', upload.single('image'), verifyToken, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });

    try {
        // 1. Prepare file info
        const fileId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const ext = path.extname(req.file.originalname);
        const filename = `${fileId}${ext}`;
        
        // 2. Upload to Supabase Storage Bucket
        const { data: storageData, error: storageError } = await supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(filename, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false
            });

        if (storageError) {
            console.error('Storage Upload Error:', storageError);
            return res.status(500).json({ error: 'Failed to upload file to storage' });
        }

        // 3. Get Public URL (We still need this to save in DB for internal reference)
        const { data: { publicUrl } } = supabase
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filename);

        // 4. Save metadata to DB
        // IMPORTANT: We now save the "My Domain" URL in the returned JSON response,
        // but we can store either the public URL or the internal ID in the DB.
        // Let's store the Supabase URL in DB so we always know where the file IS,
        // but return the CUSTOM URL to the user.
        
        const customUrl = `${CUSTOM_DOMAIN}/${fileId}`;
        
        const { error: dbError } = await supabase
            .from('uploads')
            .insert({
                id: fileId,
                filename: filename, 
                original_name: req.file.originalname,
                size: req.file.size,
                mime_type: req.file.mimetype,
                url: publicUrl, // Store REAL location in DB
                user_id: req.user.id,
                token_used: req.user.token
            });

        if (dbError) {
            console.error('DB Insert Error:', dbError);
        }

        res.json({
            success: true,
            directUrl: customUrl, // <--- HERE IS THE CHANGE: Return YOUR link
            file: {
                name: req.file.originalname,
                size: req.file.size,
                mime: req.file.mimetype
            }
        });

    } catch (err) {
        console.error('Upload Handler Error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// List Images
app.get('/api/images/list', async (req, res) => {
    let token = null;
    if (req.headers.authorization?.startsWith('Bearer ')) token = req.headers.authorization.split(' ')[1];
    else if (req.query.key) token = req.query.key;

    if (!token) return res.status(401).json({ error: 'No token' });

    try {
        const { data: keyData } = await supabase.from('api_keys').select('user_id').eq('token', token).single();
        if (!keyData) return res.status(401).json({ error: 'Invalid token' });

        const { data: images } = await supabase.from('uploads').select('*').eq('user_id', keyData.user_id).order('uploaded_at', { ascending: false });
        
        const responseImages = images.map(img => ({
            id: img.id,
            url: `${CUSTOM_DOMAIN}/${img.id}`, // Return custom URL in list too
            size: parseFloat((img.size / (1024 * 1024)).toFixed(2)),
            name: img.original_name,
            uploaded_at: img.uploaded_at
        }));
        res.json(responseImages);
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
});

// Delete Image
app.delete('/api/images/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    
    try {
        const { data: img } = await supabase.from('uploads').select('*').eq('id', id).single();
        if (!img) return res.status(404).json({ error: 'Not found' });
        if (img.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: 'Forbidden' });

        await supabase.storage.from(STORAGE_BUCKET).remove([img.filename]);
        await supabase.from('uploads').delete().eq('id', id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Ping
app.get('/api/ping', (req, res) => res.json({ success: true, message: 'Pong (Supabase Storage)' }));

// PROXY IMAGE REQUESTS (Show image from Supabase without redirecting URL)
app.get('/img/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // 1. Find file URL in Supabase
        const { data } = await supabase
            .from('uploads')
            .select('url, mime_type')
            .eq('id', id)
            .single();

        if (!data || !data.url) {
            return res.status(404).send('Image not found');
        }

        // 2. Fetch image from Supabase
        const response = await axios({
            url: data.url,
            method: 'GET',
            responseType: 'stream'
        });

        // 3. Set content type
        res.setHeader('Content-Type', data.mime_type || 'image/png');
        
        // 4. Pipe stream to client
        response.data.pipe(res);

    } catch (err) {
        console.error('Proxy Error:', err.message);
        res.status(404).send('Image not found or error fetching');
    }
});

// React Fallback
app.get(/.*/, (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/img')) {
        return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} (Cloud Storage + Proxy Edition)`);
});
