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
