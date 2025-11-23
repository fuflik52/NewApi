// API: List All Users (Admin Only)
app.get('/api/admin/users', verifyToken, (req, res) => {
    db.get('SELECT is_admin FROM users WHERE id = ?', [req.user.id], (err, row) => {
        if (err || !row || !row.is_admin) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        // Fetch all users with request counts (mock count for now as we don't log every request yet)
        // And IP address (we'll add this field to users table or fetch from logs later)
        // For now, we'll return mock IP and 0 requests if not tracked
        db.all('SELECT id, username, email, avatar, api_token, is_admin, created_at, ip_address FROM users', (err, rows) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'DB Error' });
            }
            
            // Enhance with request counts if we had a logs table
            const enhancedRows = rows.map(user => ({
                ...user,
                request_count: 0 // Placeholder until we implement request logging
            }));
            
            res.json(enhancedRows);
        });
    });
});
