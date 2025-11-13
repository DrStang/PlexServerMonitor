let ws;
let currentUser = null;

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
            updateServerStatus(data.data);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        setTimeout(initWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Update server status UI
function updateServerStatus(status) {
    console.log('Updating status:', status);

    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const activeStreams = document.getElementById('active-streams');
    const totalMedia = document.getElementById('total-media');
    const responseTime = document.getElementById('response-time');
    const lastChecked = document.getElementById('last-checked');

    if (status.is_online) {
        statusIndicator.className = 'status-indicator status-online';
        statusText.textContent = 'Online';
    } else {
        statusIndicator.className = 'status-indicator status-offline';
        statusText.textContent = 'Offline';
    }

    activeStreams.textContent = status.active_streams || 0;
    totalMedia.textContent = (status.total_media || 0).toLocaleString();
    responseTime.textContent = status.response_time ? `${status.response_time}ms` : '-';

    if (status.checked_at) {
        const date = new Date(status.checked_at);
        const timeOptions = {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        const formattedTime = date.toLocaleTimeString(undefined, timeOptions);
        console.log('Time formatting:', { raw: status.checked_at, parsed: date, formatted: formattedTime });
        lastChecked.textContent = formattedTime;
    }
}

// Load current user info
async function loadUserInfo() {
    try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
            window.location.href = '/';
            return;
        }

        currentUser = await response.json();
        document.getElementById('username').textContent = currentUser.username;

        // Redirect admins to admin page
        if (currentUser.isAdmin) {
            window.location.href = '/admin';
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        window.location.href = '/';
    }
}

// Load initial server status
async function loadServerStatus() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            const status = await response.json();
            updateServerStatus(status);
        }
    } catch (error) {
        console.error('Error loading server status:', error);
    }
}

// Load tickets
async function loadTickets() {
    try {
        const response = await fetch('/api/tickets');
        if (response.ok) {
            const tickets = await response.json();
            displayTickets(tickets);
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

// Display tickets
function displayTickets(tickets) {
    const ticketList = document.getElementById('ticket-list');

    if (tickets.length === 0) {
        ticketList.innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                No tickets yet
            </p>
        `;
        return;
    }

    ticketList.innerHTML = tickets.map(ticket => `
        <div class="glass-card ticket-item priority-${ticket.priority}">
            <div class="ticket-info">
                <h4>${escapeHtml(ticket.title)}</h4>
                <div class="ticket-meta">
                    Opened ${new Date(ticket.created_at).toLocaleDateString()} at ${new Date(ticket.created_at).toLocaleTimeString()}
                    • Priority: <strong>${ticket.priority.toUpperCase()}</strong>
                </div>
                <div class="ticket-description">
                    ${escapeHtml(ticket.description)}
                </div>
            </div>
            <div>
                <span class="ticket-status status-${ticket.status.replace(' ', '-')}">
                    ${ticket.status.toUpperCase().replace('-', ' ')}
                </span>
            </div>
        </div>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open ticket modal
function openTicketModal() {
    document.getElementById('ticket-modal').classList.add('active');
}

// Close ticket modal
function closeTicketModal() {
    document.getElementById('ticket-modal').classList.remove('active');
    document.getElementById('ticket-form').reset();
}

// Submit ticket
document.getElementById('ticket-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('ticket-title').value;
    const description = document.getElementById('ticket-description').value;
    const priority = document.getElementById('ticket-priority').value;

    try {
        const response = await fetch('/api/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description, priority })
        });

        if (response.ok) {
            showToast('Ticket created successfully', 'success');
            closeTicketModal();
            loadTickets();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to create ticket', 'error');
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        showToast('An error occurred while creating the ticket', 'error');
    }
});

// Logout
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = '/';
    }
}

// Close modal when clicking outside
document.getElementById('ticket-modal').addEventListener('click', (e) => {
    if (e.target.id === 'ticket-modal') {
        closeTicketModal();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadServerStatus();
    loadTickets();
    initWebSocket();
});
