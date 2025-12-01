// Database migration script to add ticket_comments table
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'plex_monitor.db');

console.log('Starting database migration...');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('Connected to database');
});

// Add ticket_comments table
db.run(`
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
`, (err) => {
  if (err) {
    console.error('Error creating ticket_comments table:', err);
    process.exit(1);
  }
  console.log('✓ ticket_comments table created');

  // Add index for ticket_comments
  db.run('CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id)', (err) => {
    if (err) {
      console.error('Error creating index:', err);
      process.exit(1);
    }
    console.log('✓ ticket_comments index created');

    // Close database
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('\n✅ Migration completed successfully!');
      console.log('You can now restart your server.');
    });
  });
});
