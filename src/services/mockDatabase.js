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
    // Return empty or fetch from real API if needed
    return this.tokens[0] || null;
  }

  async regenerateToken() {
    // This should probably call backend in real app
    return null; 
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
