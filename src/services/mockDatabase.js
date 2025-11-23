// Mock Service to simulate Database interactions for API Tokens and Usage
// This mimics the structure defined in database/setup_api_tokens.sql and database/setup_api_usage.sql

class MockDatabase {
  constructor() {
    // Load from localStorage or initialize
    this.tokens = this.loadFromStorage('api_tokens') || [
      {
        id: 'uuid-1',
        user_id: 'user-1',
        token: 'sk_live_892374982374982374',
        name: 'Main API Key',
        description: 'Primary key for dashboard',
        is_active: true,
        last_used_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      }
    ];

    this.usageLogs = this.loadFromStorage('api_usage_logs');
    
    if (!this.usageLogs || this.usageLogs.length === 0) {
      this.usageLogs = [];
      this.generateMockLogs();
    }

    this.images = this.loadFromStorage('api_images') || [];

    // Persist uptime start
    if (!localStorage.getItem('server_uptime_start')) {
       // Set uptime start to 14 days ago randomly
       const uptimeStart = new Date();
       uptimeStart.setDate(uptimeStart.getDate() - 14);
       uptimeStart.setHours(uptimeStart.getHours() - 2);
       uptimeStart.setMinutes(uptimeStart.getMinutes() - 15);
       localStorage.setItem('server_uptime_start', uptimeStart.toISOString());
    }
  }

  saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
  }

  loadFromStorage(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error("Failed to load from localStorage", e);
      return null;
    }
  }

  generateMockLogs() {
    const endpoints = ['/api/images/upload', '/api/gradient-role', '/api/tournament-application', '/api/auth'];
    const now = new Date();
    
    // Generate logs for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Random number of requests per day (50-200)
      const dailyRequests = Math.floor(Math.random() * 150) + 50;
      
      for (let j = 0; j < dailyRequests; j++) {
        // Simulate multi-user environment: 
        // 95% traffic from 'others', 5% from 'current user' (uuid-1)
        const isCurrentUser = Math.random() > 0.95;
        
        this.usageLogs.push({
          id: `log-${i}-${j}`,
          token_id: isCurrentUser ? 'uuid-1' : `user-${Math.floor(Math.random() * 100)}`,
          endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
          created_at: date.toISOString()
        });
      }
    }
    this.saveToStorage('api_usage_logs', this.usageLogs);
  }

  // API Methods mirroring potential backend endpoints

  async getApiToken() {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.tokens[0];
  }

  async regenerateToken() {
    await new Promise(resolve => setTimeout(resolve, 800));
    const newToken = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    this.tokens[0].token = newToken;
    this.saveToStorage('api_tokens', this.tokens);
    return newToken;
  }

  async getUsageStats(days = 30, tokenId = null) {
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const stats = [];
    const now = new Date();
    
    // Filter logs by token if provided
    const relevantLogs = tokenId 
      ? this.usageLogs.filter(log => log.token_id === tokenId)
      : this.usageLogs;

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count logs for this date
      const count = relevantLogs.filter(log => log.created_at.startsWith(dateStr)).length;
      
      stats.unshift({
        name: `${date.getDate()}`, // Just day number for chart
        requests: count,
        fullDate: dateStr,
        value: count // Compatible with Dashboard chart
      });
    }
    
    return stats;
  }

  async getTotalRequests(tokenId = null) {
    if (tokenId) {
      return this.usageLogs.filter(log => log.token_id === tokenId).length;
    }
    return this.usageLogs.length;
  }
  
  async getEndpointStats() {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const endpointCounts = {};
    this.usageLogs.forEach(log => {
        endpointCounts[log.endpoint] = (endpointCounts[log.endpoint] || 0) + 1;
    });

    return Object.entries(endpointCounts).map(([name, count]) => ({
        name,
        requests: count
    })).sort((a, b) => b.requests - a.requests).slice(0, 5);
  }

  async getStatusDistribution() {
      // Mock consistent distribution based on logs count
      const total = this.usageLogs.length;
      return [
        { name: '200 OK', value: Math.round(total * 0.92), color: '#4ade80' }, 
        { name: '404 Not Found', value: Math.round(total * 0.05), color: '#facc15' },
        { name: '500 Error', value: Math.round(total * 0.01), color: '#f87171' },
        { name: '401 Auth', value: Math.round(total * 0.02), color: '#60a5fa' },
      ];
  }

  getUptimeStart() {
      return new Date(localStorage.getItem('server_uptime_start'));
  }

  // Image Gallery Methods
  async getImagesByToken(token) {
    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network

    try {
        // Try fetching from real backend API first if running in browser
        const apiUrl = '/api/images/list'; // Relative path works if proxied or same origin
        
        // Determine full URL if needed (dev environment)
        const fullUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
           ? 'http://localhost:3000/api/images/list'
           : apiUrl;

        const res = await fetch(`${fullUrl}?key=${token}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            // Transform data to match existing frontend format if server structure differs slightly
            // Server returns: { id, url, size (MB), name, uploaded_at } which matches well.
            // Ensure url is absolute if needed or use as is.
            
            // Map server URLs to be usable from frontend
            const mappedData = data.map(img => {
                let safeUrl = img.url;
                
                // If we are on HTTPS, we can't load HTTP resources directly
                // Replace the custom domain with the current origin if it matches our logic
                if (window.location.protocol === 'https:' && img.url.startsWith('http://')) {
                    if (img.url.includes('bublickrust')) {
                         // Option 1: Proxy through the current origin (assuming nginx/vite proxy is set up)
                         // If the image is 'http://bublickrust/123', we want '/123' relative to current site
                         // Or if running locally via vite proxy:
                         const id = img.url.split('/').pop();
                         
                         // If we are in production (bublickrust.ru), we can try to fetch relative to root if we have a route
                         // But server.js has route '/:id'.
                         // So 'https://bublickrust.ru/12345' should work if it hits the express server.
                         
                         // Construct a safe URL relative to the current window location
                         safeUrl = `${window.location.origin}/${id}`;
                    }
                }
                // else if (img.url.includes('bublickrust.ru')) {
                //    // REMOVED: Do not force localhost:3000 replacement, let the server domain stand
                //    // safeUrl = img.url.replace('https://bublickrust.ru', 'http://localhost:3000');
                // }

                return {
                    ...img,
                    url: safeUrl
                };
            });

            // Also sync these to local storage for backup/persistence
            // Filter out old entries for this token first to avoid duplicates
            this.images = this.images.filter(img => img.token !== token);
            // Add new ones from server
            const serverImages = mappedData.map(img => ({
                ...img,
                token: token
            }));
            this.images = [...this.images, ...serverImages];
            this.saveToStorage('api_images', this.images);

            return mappedData;
        }
    } catch (e) {
        console.warn("Failed to fetch from real API, falling back to mock", e);
    }

    const existing = this.images.filter(img => img.token === token);
    
    // ONLY generate demo images for the SPECIFIC test key
    // AND only if they haven't been generated yet
    const TEST_KEY = 'sk_live_892374982374982374';

    if (token === TEST_KEY && existing.length === 0) {
        const newImages = [
            { id: 1, url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500&q=80', size: 2.4, name: 'nebula_scan_01.png' },
            { id: 2, url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=500&q=80', size: 3.1, name: 'earth_orbit.jpg' },
            { id: 3, url: 'https://images.unsplash.com/photo-1541185933-710f50b90858?w=500&q=80', size: 1.8, name: 'mars_surface.png' },
            { id: 4, url: 'https://images.unsplash.com/photo-1614730341194-75c60740a0d3?w=500&q=80', size: 5.2, name: 'black_hole_sim.raw' },
            { id: 5, url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=500&q=80', size: 2.9, name: 'galaxy_cluster.jpg' },
            { id: 6, url: 'https://images.unsplash.com/photo-1532693322450-2cb5c511067d?w=500&q=80', size: 4.1, name: 'quantum_field.png' },
        ].map(img => ({ ...img, token, uploaded_at: new Date().toISOString() }));
        
        this.images = [...this.images, ...newImages];
        this.saveToStorage('api_images', this.images);
        return newImages;
    }

    // For any other key, return what's found (empty array if nothing)
    return existing;
  }
}

export const dbService = new MockDatabase();
