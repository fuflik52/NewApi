// Mock Service to simulate Database interactions for API Tokens and Usage
// This mimics the structure defined in database/setup_api_tokens.sql and database/setup_api_usage.sql

class MockDatabase {
  constructor() {
    // Load from localStorage or initialize
    this.tokens = this.loadFromStorage('api_tokens') || [];
    this.usageLogs = this.loadFromStorage('api_usage_logs') || [];
    this.images = this.loadFromStorage('api_images') || [];
    
    // No mock data generation
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

  // API Methods mirroring potential backend endpoints

  async getApiToken() {
    // DEPRECATED: Use getApiTokens() instead
    // Kept for compatibility during migration
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) return null;
        
        const tokens = await this.getApiTokens();
        if (tokens && tokens.length > 0) {
            return { token: tokens[0].token, id: 'legacy' };
        }

        return { token: 'No Token Found' };
    } catch (e) {
        return { token: 'Error' };
    }
  }

  async getApiTokens() {
      try {
          const token = localStorage.getItem('auth_token');
          if (!token) return [];

          const res = await fetch('/api/tokens', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              return await res.json();
          }
      } catch (e) {
          console.error("Failed to fetch tokens", e);
      }
      return [];
  }

  async createToken(name = "New Key") {
      try {
          const token = localStorage.getItem('auth_token');
          const res = await fetch('/api/tokens', {
              method: 'POST',
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ name })
          });
          
          const data = await res.json();
          if (res.ok && data.success) {
              return data.token;
          } else {
              throw new Error(data.error || 'Failed to create');
          }
      } catch (e) {
          throw e;
      }
  }

  async deleteToken(id) {
      try {
          const token = localStorage.getItem('auth_token');
          const res = await fetch(`/api/tokens/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          return res.ok;
      } catch (e) {
          return false;
      }
  }

  async regenerateToken() {
    // Legacy support wrapper
    try {
        return await this.createToken("Regenerated Key");
    } catch (e) {
        return null;
    }
  }

  async getUsageStats(days = 30, tokenId = null) {
    // Return empty stats
    return [];
  }

  async getTotalRequests(tokenId = null) {
    return 0;
  }
  
  async getEndpointStats() {
    return [];
  }

  async getStatusDistribution() {
      return [];
  }

  getUptimeStart() {
      // Return current time as start if not set, or just now
      return new Date();
  }

  // Image Gallery Methods
  async getImagesByToken(token) {
    // Only use real API
    try {
        const apiUrl = '/api/images/list';
        
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
            const mappedData = data.map(img => {
                let safeUrl = img.url;
                if (window.location.protocol === 'https:' && img.url.startsWith('http://')) {
                    if (img.url.includes('bublickrust')) {
                         const id = img.url.split('/').pop();
                         safeUrl = `${window.location.origin}/img/${id}`;
                    }
                }
                return {
                    ...img,
                    url: safeUrl
                };
            });

            return mappedData;
        }
    } catch (e) {
        console.warn("Failed to fetch from real API", e);
    }

    return [];
  }
}

export const dbService = new MockDatabase();
