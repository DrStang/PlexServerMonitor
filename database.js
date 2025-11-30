const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'plex_monitor.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.initTables();
      }
    });
  }

  initTables() {
    // Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        plex_username TEXT,
        plex_token TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tickets table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Server status history table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS server_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        is_online INTEGER NOT NULL,
        active_streams INTEGER DEFAULT 0,
        total_users INTEGER DEFAULT 0,
        total_libraries INTEGER DEFAULT 0,
        total_media INTEGER DEFAULT 0,
        response_time INTEGER,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Media freshness tracking table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS media_freshness (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_name TEXT NOT NULL,
        last_added_item TEXT,
        last_added_date DATETIME,
        total_items INTEGER DEFAULT 0,
        checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ticket comments table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS ticket_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        comment TEXT NOT NULL,
        is_admin_reply INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create indexes for performance
    this.db.run('CREATE INDEX IF NOT EXISTS idx_server_status_checked_at ON server_status(checked_at DESC)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_media_freshness_checked_at ON media_freshness(checked_at DESC)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_media_freshness_library ON media_freshness(library_name)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id)');

    // Create default admin user if not exists
    this.createDefaultAdmin();
  }

  createDefaultAdmin() {
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'changeme';
    const defaultEmail = 'admin@plexmonitor.local';

    this.db.get('SELECT id FROM users WHERE username = ?', [defaultUsername], (err, row) => {
      if (!row) {
        bcrypt.hash(defaultPassword, 10, (err, hash) => {
          if (err) {
            console.error('Error hashing password:', err);
            return;
          }
          this.db.run(
            'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, 1)',
            [defaultUsername, defaultEmail, hash],
            (err) => {
              if (err) {
                console.error('Error creating default admin:', err);
              } else {
                console.log(`Default admin user created: ${defaultUsername}`);
              }
            }
          );
        });
      }
    });
  }

  // User methods
  createUser(username, email, password, isAdmin = false) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) return reject(err);

        this.db.run(
          'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)',
          [username, email, hash, isAdmin ? 1 : 0],
          function(err) {
            if (err) return reject(err);
            resolve(this.lastID);
          }
        );
      });
    });
  }

  getUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  getUserById(id) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  getAllUsers() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT id, username, email, is_admin, created_at FROM users', (err, rows) => {
        if (err) return reject(err);
        // Fix timestamps for all rows
        if (rows) {
          rows.forEach(row => {
            if (row.created_at) {
              row.created_at = row.created_at.replace(' ', 'T') + 'Z';
            }
          });
        }
        resolve(rows);
      });
    });
  }

  updateUserPlexInfo(userId, plexUsername, plexToken) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET plex_username = ?, plex_token = ? WHERE id = ?',
        [plexUsername, plexToken, userId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  updateUserEmail(username, email) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET email = ? WHERE username = ?',
        [email, username],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  upsertPlexUser(username, email) {
    return new Promise((resolve, reject) => {
      // First check if user exists
      this.db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return reject(err);

        if (row) {
          // Update existing user
          this.db.run(
            'UPDATE users SET email = ? WHERE username = ?',
            [email, username],
            (err) => {
              if (err) return reject(err);
              resolve({ id: row.id, updated: true });
            }
          );
        } else {
          // Create new user with random password
          const randomPassword = Math.random().toString(36).slice(-12);
          this.createUser(username, email || `${username}@noemail.local`, randomPassword, false)
            .then(id => resolve({ id, created: true }))
            .catch(reject);
        }
      });
    });
  }

  // Ticket methods
  createTicket(userId, title, description, priority = 'medium') {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO tickets (user_id, title, description, priority) VALUES (?, ?, ?, ?)',
        [userId, title, description, priority],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  getTicketsByUser(userId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          // Fix timestamps for all rows
          if (rows) {
            rows.forEach(row => {
              if (row.created_at) {
                row.created_at = row.created_at.replace(' ', 'T') + 'Z';
              }
              if (row.updated_at) {
                row.updated_at = row.updated_at.replace(' ', 'T') + 'Z';
              }
            });
          }
          resolve(rows);
        }
      );
    });
  }

  getAllTickets() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT t.*, u.username, u.email
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         ORDER BY t.created_at DESC`,
        (err, rows) => {
          if (err) return reject(err);
          // Fix timestamps for all rows
          if (rows) {
            rows.forEach(row => {
              if (row.created_at) {
                row.created_at = row.created_at.replace(' ', 'T') + 'Z';
              }
              if (row.updated_at) {
                row.updated_at = row.updated_at.replace(' ', 'T') + 'Z';
              }
            });
          }
          resolve(rows);
        }
      );
    });
  }

  updateTicketStatus(ticketId, status) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, ticketId],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  // Server status methods
  addServerStatus(isOnline, activeStreams = 0, totalUsers = 0, totalLibraries = 0, totalMedia = 0, responseTime = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO server_status
         (is_online, active_streams, total_users, total_libraries, total_media, response_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [isOnline ? 1 : 0, activeStreams, totalUsers, totalLibraries, totalMedia, responseTime],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });
  }

  getLatestServerStatus() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM server_status ORDER BY checked_at DESC LIMIT 1',
        (err, row) => {
          if (err) return reject(err);
          // SQLite returns timestamps without timezone info, so we need to append 'Z' to indicate UTC
          if (row && row.checked_at) {
            row.checked_at = row.checked_at.replace(' ', 'T') + 'Z';
          }
          resolve(row);
        }
      );
    });
  }

  getServerStatusHistory(limit = 100) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM server_status ORDER BY checked_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          // Fix timestamps for all rows
          if (rows) {
            rows.forEach(row => {
              if (row.checked_at) {
                row.checked_at = row.checked_at.replace(' ', 'T') + 'Z';
              }
            });
          }
          resolve(rows);
        }
      );
    });
  }

  // Media freshness methods
  updateMediaFreshness(libraryName, lastAddedItem, lastAddedDate, totalItems) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO media_freshness
         (id, library_name, last_added_item, last_added_date, total_items, checked_at)
         VALUES (
           (SELECT id FROM media_freshness WHERE library_name = ?),
           ?, ?, ?, ?, CURRENT_TIMESTAMP
         )`,
        [libraryName, libraryName, lastAddedItem, lastAddedDate, totalItems],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  getMediaFreshness() {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM media_freshness ORDER BY checked_at DESC',
        (err, rows) => {
          if (err) return reject(err);
          // Fix timestamps for all rows
          if (rows) {
            rows.forEach(row => {
              if (row.checked_at) {
                // Only convert if not already in ISO format
                if (!row.checked_at.endsWith('Z')) {
                  row.checked_at = row.checked_at.replace(' ', 'T') + 'Z';
                }
              }
              if (row.last_added_date) {
                // Only convert if not already in ISO format
                if (!row.last_added_date.endsWith('Z')) {
                  row.last_added_date = row.last_added_date.replace(' ', 'T') + 'Z';
                }
              }
            });
          }
          resolve(rows);
        }
      );
    });
  }

  // Create ticket comment
  createTicketComment(ticketId, userId, comment, isAdminReply = false) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO ticket_comments (ticket_id, user_id, comment, is_admin_reply) VALUES (?, ?, ?, ?)',
        [ticketId, userId, comment, isAdminReply ? 1 : 0],
        function(err) {
          if (err) return reject(err);
          // Update ticket's updated_at timestamp
          this.db.run(
            'UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [ticketId]
          );
          resolve(this.lastID);
        }.bind(this)
      );
    });
  }

  // Get comments for a ticket
  getTicketComments(ticketId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT tc.*, u.username, u.is_admin
         FROM ticket_comments tc
         JOIN users u ON tc.user_id = u.id
         WHERE tc.ticket_id = ?
         ORDER BY tc.created_at ASC`,
        [ticketId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  // Clean up old records (keep last 90 days)
  cleanupOldRecords(daysToKeep = 90) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

      // Clean up old server status records
      this.db.run(
        'DELETE FROM server_status WHERE checked_at < ?',
        [cutoffDateStr],
        (err) => {
          if (err) {
            console.error('Error cleaning up server_status:', err);
            return reject(err);
          }

          // Clean up old media freshness records
          this.db.run(
            'DELETE FROM media_freshness WHERE checked_at < ?',
            [cutoffDateStr],
            function(err) {
              if (err) {
                console.error('Error cleaning up media_freshness:', err);
                return reject(err);
              }

              const totalDeleted = this.changes;
              console.log(`Cleanup complete: removed records older than ${daysToKeep} days (${totalDeleted} records)`);
              resolve(totalDeleted);
            }
          );
        }
      );
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = new Database();
