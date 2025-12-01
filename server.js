require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const rateLimit = require('express-rate-limit');

const database = require('./database');
const PlexService = require('./plexService');
const emailService = require('./emailService');
const logger = require('./logger');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Initialize Plex service
const plexService = new PlexService(
  process.env.PLEX_SERVER_URL,
  process.env.PLEX_TOKEN
);

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await database.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;

    // Extend session if "remember me" is checked
    if (remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1
      }
    });
  } catch (error) {
    logger.error('Login error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Plex OAuth login
app.post('/api/auth/plex', authLimiter, async (req, res) => {
  try {
    const { username, password, remember } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Plex username and password required' });
    }

    const plexAuth = await plexService.authenticateWithPlex(username, password);

    if (!plexAuth.success) {
      return res.status(401).json({ error: plexAuth.error });
    }

    // Check if user exists
    let user = await database.getUserByUsername(plexAuth.username);

    if (!user) {
      // Create new user
      const userId = await database.createUser(
        plexAuth.username,
        plexAuth.email,
        Math.random().toString(36).slice(-8), // Random password
        false
      );
      user = await database.getUserById(userId);
    }

    // Update Plex info
    await database.updateUserPlexInfo(user.id, plexAuth.username, plexAuth.token);

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin === 1;

    // Extend session if "remember me" is checked
    if (remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.is_admin === 1
      }
    });
  } catch (error) {
    logger.error('Plex login error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const userId = await database.createUser(username, email, password, false);
    res.json({ success: true, userId });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    logger.error('Registration error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await database.getUserById(req.session.userId);
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.is_admin === 1
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== SERVER STATUS ROUTES ====================

// Get current server status
app.get('/api/status', requireAuth, async (req, res) => {
  try {
    const latestStatus = await database.getLatestServerStatus();
    res.json(latestStatus || {
      is_online: 0,
      active_streams: 0,
      total_users: 0,
      total_libraries: 0,
      total_media: 0,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get status history (admin only)
app.get('/api/status/history', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const history = await database.getServerStatusHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('Get status history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get media freshness (admin only)
app.get('/api/media/freshness', requireAdmin, async (req, res) => {
  try {
    const freshness = await database.getMediaFreshness();
    res.json(freshness);
  } catch (error) {
    console.error('Get media freshness error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== TICKET ROUTES ====================

// Create ticket
app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { title, description, priority } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description required' });
    }

    const ticketId = await database.createTicket(
      req.session.userId,
      title,
      description,
      priority || 'medium'
    );

    // Send email notification to admin
    try {
      const user = await database.getUserById(req.session.userId);
      const adminEmail = process.env.ADMIN_EMAIL;
      if (emailService.isConfigured() && adminEmail) {
        await emailService.sendNewTicketNotification(
          adminEmail,
          ticketId,
          {
            title,
            description,
            priority: priority || 'medium',
            username: user.username,
            email: user.email
          }
        );
        logger.info(`Email notification sent for ticket #${ticketId} to ${adminEmail}`);
      } else if (!adminEmail) {
        logger.warn('ADMIN_EMAIL not configured, skipping ticket notification');
      }
    } catch (emailError) {
      // Don't fail the ticket creation if email fails
      logger.error('Failed to send ticket notification email:', { error: emailError.message });
    }

    res.json({ success: true, ticketId });
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's tickets
app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const tickets = await database.getTicketsByUser(req.session.userId);
    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tickets (admin only)
app.get('/api/tickets/all', requireAdmin, async (req, res) => {
  try {
    const tickets = await database.getAllTickets();
    res.json(tickets);
  } catch (error) {
    console.error('Get all tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ticket status (admin only)
app.put('/api/tickets/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'in-progress', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await database.updateTicketStatus(id, status);
    res.json({ success: true });
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get ticket comments
app.get('/api/tickets/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await database.getTicketComments(id);
    res.json(comments);
  } catch (error) {
    logger.error('Get ticket comments error:', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to ticket
app.post('/api/tickets/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment required' });
    }

    const isAdminReply = req.session.isAdmin === true;
    const commentId = await database.createTicketComment(
      id,
      req.session.userId,
      comment,
      isAdminReply
    );

    res.json({ success: true, commentId });
  } catch (error) {
    logger.error('Add ticket comment error:', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await database.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Plex users enriched with database emails (admin only)
app.get('/api/admin/plex-users', requireAdmin, async (req, res) => {
  try {
    // Get users from Plex
    const plexUsers = await plexService.getPlexUsers();

    // Get users from database (which may have imported emails)
    const dbUsers = await database.getAllUsers();

    // Create a map of database users by username
    const dbUserMap = new Map();
    const plexUsernameSet = new Set();

    dbUsers.forEach(user => {
      dbUserMap.set(user.username.toLowerCase(), user);
    });

    // Merge: Plex users with database emails
    const mergedUsers = plexUsers.map(plexUser => {
      plexUsernameSet.add(plexUser.username.toLowerCase());
      const dbUser = dbUserMap.get(plexUser.username.toLowerCase());
      return {
        id: plexUser.id,
        username: plexUser.username,
        email: dbUser?.email || plexUser.email, // Prefer database email
        isOwner: plexUser.isOwner,
        source: 'plex'
      };
    });

    // Add database-only users (imported emails that don't match Plex usernames)
    dbUsers.forEach(dbUser => {
      if (!plexUsernameSet.has(dbUser.username.toLowerCase()) && dbUser.email) {
        mergedUsers.push({
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          isOwner: false,
          source: 'database'
        });
      }
    });

    const usersWithEmails = mergedUsers.filter(u => u.email && u.email !== 'admin@plexmonitor.local');
    console.log(`Merged ${mergedUsers.length} users: ${usersWithEmails.length} with emails (${plexUsers.length} from Plex, ${mergedUsers.length - plexUsers.length} from database only)`);

    res.json(mergedUsers);
  } catch (error) {
    console.error('Get Plex users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import user emails in bulk (admin only)
app.post('/api/admin/import-emails', requireAdmin, async (req, res) => {
  try {
    const { users } = req.body; // Array of { username, email }

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Users array required' });
    }

    const results = {
      created: [],
      updated: [],
      errors: []
    };

    for (const user of users) {
      if (!user.username) {
        results.errors.push({ user, error: 'Username required' });
        continue;
      }

      try {
        const result = await database.upsertPlexUser(user.username, user.email);
        if (result.created) {
          results.created.push(user.username);
        } else if (result.updated) {
          results.updated.push(user.username);
        }
      } catch (error) {
        results.errors.push({ user: user.username, error: error.message });
      }
    }

    res.json({
      success: true,
      created: results.created.length,
      updated: results.updated.length,
      errors: results.errors.length,
      details: results
    });
  } catch (error) {
    console.error('Import emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send mass email (admin only)
app.post('/api/admin/email/mass', requireAdmin, async (req, res) => {
  try {
    const { subject, message, recipients } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message required' });
    }

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient must be selected' });
    }

    if (!emailService.isConfigured()) {
      return res.status(500).json({ error: 'Email service not configured' });
    }

    // Recipients should be objects with { email, username } properties
    // Filter out any without email addresses
    const validRecipients = recipients.filter(r => r.email);

    if (validRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses found' });
    }

    const results = await emailService.sendMassEmail(validRecipients, subject, message);

    res.json({
      success: true,
      sent: results.success.length,
      failed: results.failed.length,
      results
    });
  } catch (error) {
    console.error('Mass email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== WEBSOCKET ====================

let statusCheckInterval;

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected');

  // Send initial status
  database.getLatestServerStatus().then(status => {
    if (status) {
      ws.send(JSON.stringify({ type: 'status', data: status }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket client disconnected');
  });
});

function broadcastStatus(status) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'status', data: status }));
    }
  });
}

// ==================== BACKGROUND TASKS ====================

async function checkServerStatus() {
  try {
    const status = await plexService.checkServerStatus();

    console.log(`Status check: Online=${status.isOnline}, Media=${status.totalMedia}, Libs=${status.totalLibraries}, Users=${status.totalUsers}`);

    await database.addServerStatus(
      status.isOnline,
      status.activeStreams,
      status.totalUsers,
      status.totalLibraries,
      status.totalMedia,
      status.responseTime
    );

    const latestStatus = await database.getLatestServerStatus();
    console.log(`DB status: Media=${latestStatus.total_media}, Libs=${latestStatus.total_libraries}`);
    broadcastStatus(latestStatus);
  } catch (error) {
    console.error('Error in status check:', error);
  }
}

async function updateMediaFreshness() {
  try {
    const freshnessData = await plexService.getMediaFreshness();

    for (const data of freshnessData) {
      await database.updateMediaFreshness(
        data.libraryName,
        data.lastAddedItem,
        data.lastAddedDate,
        data.totalItems
      );
    }
  } catch (error) {
    console.error('Error updating media freshness:', error);
  }
}

// Database cleanup job
async function cleanupOldData() {
  try {
    await database.cleanupOldRecords(90); // Keep 90 days of data
  } catch (error) {
    console.error('Error during database cleanup:', error);
  }
}

// Start background tasks
statusCheckInterval = setInterval(checkServerStatus, 30000); // Every 30 seconds
setInterval(updateMediaFreshness, 5 * 60 * 1000); // Every 5 minutes
setInterval(cleanupOldData, 24 * 60 * 60 * 1000); // Every 24 hours

// Initial checks
checkServerStatus();
updateMediaFreshness();
cleanupOldData(); // Run cleanup on startup

// ==================== SERVE FRONTEND ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ==================== START SERVER ====================

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Access the application at http://localhost:${PORT}`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  clearInterval(statusCheckInterval);
  database.close();
  process.exit();
});
