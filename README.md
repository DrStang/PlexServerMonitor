# Plex Server Monitor

A comprehensive web application for monitoring Plex server status with user authentication, ticket management, and admin controls.

## Features

### User Authentication
- **Standard Login**: Username/password authentication
- **Plex OAuth Integration**: Login using Plex credentials
- **User Registration**: Self-service account creation
- **Session Management**: Secure session handling with Express sessions

### Server Status Monitoring
- **Real-time Monitoring**: Server status checked every 30 seconds
- **Live Updates**: WebSocket connections for instant status updates
- **Server Metrics**:
  - Server online/offline status
  - Active streams count
  - Total users
  - Library count
  - Total media items
  - Response time tracking
- **Status History**: Historical tracking of server metrics (admin only)

### Ticket System
- **User Ticket Submission**: Users can report issues with priority levels (low, medium, high)
- **Ticket Tracking**: View all submitted tickets with status
- **Status Management**: Admin can update ticket status (open, in-progress, closed)
- **Priority Indicators**: Visual indicators for ticket priority

### Admin Features
- **Media Freshness Tracking**: Monitor when new content was last added to each library
- **Mass Email System**: Send emails to all registered users
- **Advanced Ticket Management**: View and manage all user tickets
- **Enhanced Dashboard**: Additional metrics and controls

### Modern UI
- **Glassmorphic Design**: Beautiful frosted glass effects with Plex-inspired colors
- **Responsive Layout**: Works on desktop, tablet, and mobile
- **Smooth Animations**: Polished transitions and background animations
- **Toast Notifications**: User-friendly feedback system

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Plex Media Server with API access

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PlexServerMonitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your settings:
   ```env
   # Server Configuration
   PORT=3000
   SESSION_SECRET=your-super-secret-session-key-change-this

   # Plex Server Configuration
   PLEX_SERVER_URL=http://your-plex-server:32400
   PLEX_TOKEN=your-plex-token-here

   # Plex OAuth Configuration (optional)
   PLEX_CLIENT_ID=your-plex-client-id
   PLEX_CLIENT_SECRET=your-plex-client-secret
   PLEX_REDIRECT_URI=http://localhost:3000/auth/plex/callback

   # Email Configuration (for mass emails)
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-email-password
   EMAIL_FROM=Plex Server Monitor <your-email@gmail.com>

   # Admin Configuration
   DEFAULT_ADMIN_USERNAME=admin
   DEFAULT_ADMIN_PASSWORD=changeme
   ```

4. **Get your Plex Token**

   To find your Plex token:
   - Open Plex Web App
   - Play any media item
   - Click the "..." menu and select "Get Info"
   - Click "View XML"
   - Look for `X-Plex-Token` in the URL

5. **Start the server**
   ```bash
   npm start
   ```

   For development with auto-reload:
   ```bash
   npm run dev
   ```

6. **Access the application**

   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Default Admin Account

On first run, a default admin account is created:
- **Username**: admin (or as set in `.env`)
- **Password**: changeme (or as set in `.env`)

**IMPORTANT**: Change the default admin password immediately after first login!

## Usage

### For Users

1. **Register an Account**
   - Click "Register" tab on login page
   - Fill in username, email, and password
   - Submit to create account

2. **Login Options**
   - **Standard Login**: Use your username and password
   - **Plex Login**: Use your Plex account credentials (automatically creates an account)

3. **View Server Status**
   - Dashboard shows real-time server status
   - Updates automatically every 30 seconds
   - View active streams and media count

4. **Submit Tickets**
   - Click "Open New Ticket"
   - Fill in title, description, and priority
   - Track ticket status

### For Admins

1. **Login as Admin**
   - Use admin credentials
   - Automatically redirected to admin dashboard

2. **Monitor Media Freshness**
   - View when new content was last added to each library
   - Color-coded indicators:
     - Green: Recent (within 7 days)
     - Orange: Older (7-30 days)
     - Red: Very old (30+ days)

3. **Manage Tickets**
   - View all user tickets
   - Filter by status (open, in-progress, closed)
   - Click ticket status to update

4. **Send Mass Emails**
   - Click "Send Mass Email"
   - Compose subject and message (HTML supported)
   - Email sent to all registered users

## Email Configuration

To enable mass email functionality:

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings
   - Security > 2-Step Verification > App Passwords
   - Generate password for "Mail"
3. Use the app password in `.env`:
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   ```

### Other Email Services

Supported services: Gmail, Yahoo, Outlook, etc.

Change `EMAIL_SERVICE` in `.env` to your provider.

## Database

The application uses SQLite for data storage. The database file (`plex_monitor.db`) is created automatically on first run.

### Database Tables

- **users**: User accounts and authentication
- **tickets**: Support tickets
- **server_status**: Historical server status data
- **media_freshness**: Media library update tracking

## API Endpoints

### Authentication
- `POST /api/auth/login` - Standard login
- `POST /api/auth/plex` - Plex OAuth login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Server Status
- `GET /api/status` - Current server status
- `GET /api/status/history` - Status history (admin)
- `GET /api/media/freshness` - Media freshness (admin)

### Tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets` - User's tickets
- `GET /api/tickets/all` - All tickets (admin)
- `PUT /api/tickets/:id/status` - Update ticket status (admin)

### Admin
- `GET /api/admin/users` - Get all users
- `POST /api/admin/email/mass` - Send mass email

## WebSocket Events

- **Connection**: Established on dashboard load
- **Status Updates**: Real-time server status pushed to clients
- **Auto-reconnect**: Reconnects if connection drops

## Security

- Passwords hashed with bcryptjs
- Session-based authentication
- CSRF protection (session secrets)
- Input sanitization to prevent XSS
- SQL injection protection (parameterized queries)

## Troubleshooting

### Server won't start
- Check Node.js version (v14+)
- Verify all dependencies installed
- Check port 3000 is available

### Can't connect to Plex server
- Verify Plex server URL in `.env`
- Confirm Plex token is correct
- Check network connectivity
- Ensure Plex server is running

### Email not sending
- Verify email credentials in `.env`
- Check email service provider settings
- For Gmail, ensure App Password is used

### Database errors
- Delete `plex_monitor.db` and restart (will recreate)
- Check file permissions

## Development

### File Structure
```
PlexServerMonitor/
├── public/              # Frontend files
│   ├── login.html       # Login page
│   ├── login.js         # Login logic
│   ├── dashboard.html   # User dashboard
│   ├── dashboard.js     # User dashboard logic
│   ├── admin.html       # Admin dashboard
│   ├── admin.js         # Admin dashboard logic
│   └── styles.css       # Shared styles
├── server.js            # Express server & API
├── database.js          # Database operations
├── plexService.js       # Plex API integration
├── emailService.js      # Email functionality
├── package.json         # Dependencies
├── .env                 # Configuration
└── README.md            # This file
```

### Adding Features

To add new features:
1. Update database schema in `database.js`
2. Add API endpoints in `server.js`
3. Update frontend HTML/JS as needed
4. Update README with new features

## License

MIT License - Feel free to use and modify as needed.

## Support

For issues or questions:
1. Check this README
2. Review server logs
3. Check browser console for errors
4. Verify environment configuration

## Roadmap

Future enhancements:
- Email notifications for server downtime
- Custom alert thresholds
- Multi-server support
- Advanced analytics and reporting
- Mobile app
- Telegram/Discord notifications

---

**Enjoy monitoring your Plex server!**
