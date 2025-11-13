const axios = require('axios');

class PlexService {
  constructor(serverUrl, token) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.lastStatus = null;
  }

  async checkServerStatus() {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${this.serverUrl}/status/sessions`, {
        headers: {
          'X-Plex-Token': this.token,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const responseTime = Date.now() - startTime;

      // Get active sessions
      const sessions = response.data.MediaContainer?.Metadata || [];
      const activeStreams = sessions.length;

      // Get server info
      const serverInfo = await this.getServerInfo();

      this.lastStatus = {
        isOnline: true,
        activeStreams,
        totalUsers: serverInfo.totalUsers || 0,
        totalLibraries: serverInfo.totalLibraries || 0,
        totalMedia: serverInfo.totalMedia || 0,
        responseTime,
        lastChecked: new Date()
      };

      return this.lastStatus;
    } catch (error) {
      console.error('Error checking Plex server status:', error.message);
      this.lastStatus = {
        isOnline: false,
        activeStreams: 0,
        totalUsers: 0,
        totalLibraries: 0,
        totalMedia: 0,
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message
      };
      return this.lastStatus;
    }
  }

  async getServerInfo() {
    try {
      // Get library sections
      const libResponse = await axios.get(`${this.serverUrl}/library/sections`, {
        headers: {
          'X-Plex-Token': this.token,
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      const libraries = libResponse.data.MediaContainer?.Directory || [];
      let totalMedia = 0;

      // Sum up all media across libraries
      libraries.forEach(lib => {
        totalMedia += parseInt(lib.count) || 0;
      });

      // Get accounts (users)
      let totalUsers = 0;
      try {
        const usersResponse = await axios.get(`${this.serverUrl}/accounts`, {
          headers: {
            'X-Plex-Token': this.token,
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        const accounts = usersResponse.data.MediaContainer?.Account || [];
        totalUsers = accounts.length;
      } catch (error) {
        // Users endpoint might not be available on all servers
        console.log('Could not fetch user count:', error.message);
      }

      return {
        totalLibraries: libraries.length,
        totalMedia,
        totalUsers,
        libraries
      };
    } catch (error) {
      console.error('Error getting server info:', error.message);
      return {
        totalLibraries: 0,
        totalMedia: 0,
        totalUsers: 0,
        libraries: []
      };
    }
  }

  async getMediaFreshness() {
    try {
      const serverInfo = await this.getServerInfo();
      const libraries = serverInfo.libraries;
      const freshnessData = [];

      for (const library of libraries) {
        try {
          // Get recently added items for this library
          const recentResponse = await axios.get(
            `${this.serverUrl}/library/sections/${library.key}/recentlyAdded`,
            {
              headers: {
                'X-Plex-Token': this.token,
                'Accept': 'application/json'
              },
              timeout: 10000
            }
          );

          const recentItems = recentResponse.data.MediaContainer?.Metadata || [];
          const mostRecent = recentItems[0];

          if (mostRecent) {
            freshnessData.push({
              libraryName: library.title,
              lastAddedItem: mostRecent.title || 'Unknown',
              lastAddedDate: mostRecent.addedAt
                ? new Date(parseInt(mostRecent.addedAt) * 1000).toISOString()
                : null,
              totalItems: parseInt(library.count) || 0
            });
          } else {
            freshnessData.push({
              libraryName: library.title,
              lastAddedItem: 'No items',
              lastAddedDate: null,
              totalItems: parseInt(library.count) || 0
            });
          }
        } catch (error) {
          console.error(`Error getting freshness for library ${library.title}:`, error.message);
        }
      }

      return freshnessData;
    } catch (error) {
      console.error('Error getting media freshness:', error.message);
      return [];
    }
  }

  async authenticateWithPlex(username, password) {
    try {
      const response = await axios.post(
        'https://plex.tv/users/sign_in.json',
        {
          user: {
            login: username,
            password: password
          }
        },
        {
          headers: {
            'X-Plex-Client-Identifier': 'plex-server-monitor',
            'X-Plex-Product': 'Plex Server Monitor',
            'X-Plex-Version': '1.0.0',
            'Accept': 'application/json'
          }
        }
      );

      if (response.data && response.data.user) {
        return {
          success: true,
          username: response.data.user.username,
          email: response.data.user.email,
          token: response.data.user.authToken
        };
      }

      return { success: false, error: 'Invalid response from Plex' };
    } catch (error) {
      console.error('Plex authentication error:', error.message);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  getLastStatus() {
    return this.lastStatus;
  }
}

module.exports = PlexService;
