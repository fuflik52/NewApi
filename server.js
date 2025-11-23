// API: Test Login (Secret Backdoor)
app.post('/api/auth/test-login', (req, res) => {
    const { code } = req.body;
    if (code !== 'entrance') {
        return res.status(403).json({ error: 'Invalid code' });
    }

    const testId = 'test-user-id';
    const testToken = 'sk_test_user_token_' + Math.random().toString(36).substring(2);
    const testIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    db.get('SELECT * FROM users WHERE id = ?', [testId], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB Error' });

        if (!row) {
            // Create test user
            const now = new Date().toISOString();
            db.run('INSERT INTO users (id, username, discriminator, avatar, email, api_token, is_admin, created_at, ip_address) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
                [testId, 'Test User', '0000', null, 'test@bublickrust.ru', testToken, now, testIp], (err) => {
                    if (err) return res.status(500).json({ error: 'Failed to create test user' });
                    
                    // Create initial api_token entry
                    const tokenId = uuidv4();
                    db.run('INSERT INTO api_tokens (id, user_id, token, name, created_at) VALUES (?, ?, ?, ?, ?)',
                        [tokenId, testId, testToken, 'Test Key', now], (err) => {
                            if (err) return res.status(500).json({ error: 'Failed to create test token' });
                            return res.json({ success: true, token: testToken });
                        });
                });
        } else {
            // Return existing token (or update it)
            // For simplicity, let's just return the primary api_token from users table
            res.json({ success: true, token: row.api_token });
        }
    });
});
