import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure database directory exists
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir);
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const setupDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create uploads table
            db.run(`CREATE TABLE IF NOT EXISTS uploads (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                originalname TEXT NOT NULL,
                size INTEGER NOT NULL,
                mimetype TEXT NOT NULL,
                url TEXT NOT NULL,
                token TEXT,
                uploaded_at TEXT NOT NULL
            )`);

            // Create users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                discriminator TEXT,
                avatar TEXT,
                email TEXT,
                api_token TEXT,
                is_admin INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )`);

            // Create api_tokens table (Multi-token support)
            db.run(`CREATE TABLE IF NOT EXISTS api_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT NOT NULL,
                name TEXT,
                created_at TEXT NOT NULL,
                last_used_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )`);

            // Migrations
            // 1. Add ip_address to users
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (!err && columns) {
                    const hasIp = columns.some(col => col.name === 'ip_address');
                    if (!hasIp) {
                        db.run("ALTER TABLE users ADD COLUMN ip_address TEXT", (err) => {
                            if (err) console.error("Migration Error: Failed to add ip_address column", err);
                            else console.log("Migration Success: Added ip_address column to users");
                        });
                    }
                }
            });

            // Check if we need to migrate data from JSON
            const jsonPath = path.join(__dirname, 'uploads_metadata.json');
            if (fs.existsSync(jsonPath)) {
                console.log('Found JSON metadata, migrating to SQLite...');
                try {
                    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
                    const stmt = db.prepare('INSERT OR IGNORE INTO uploads (id, filename, originalname, size, mimetype, url, token, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                    
                    let migratedCount = 0;
                    data.forEach(item => {
                        stmt.run(
                            item.id, 
                            item.filename, 
                            item.originalname, 
                            item.size, 
                            item.mimetype, 
                            item.url, 
                            item.token, 
                            item.uploaded_at
                        );
                        migratedCount++;
                    });
                    stmt.finalize();
                    console.log(`Migrated ${migratedCount} records from JSON.`);
                    
                    // Rename JSON file to backup
                    fs.renameSync(jsonPath, jsonPath + '.bak');
                } catch (e) {
                    console.error('Migration failed:', e);
                }
            }
            resolve();
        });
    });
};

export default db;
export { setupDatabase };
