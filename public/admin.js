let ws;
let currentUser = null;
let allTickets = [];
let currentFilter = 'all';

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
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const activeStreams = document.getElementById('active-streams');
    const totalUsers = document.getElementById('total-users');
    const totalLibraries = document.getElementById('total-libraries');
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
    totalUsers.textContent = status.total_users || 0;
    totalLibraries.textContent = status.total_libraries || 0;
    totalMedia.textContent = (status.total_media || 0).toLocaleString();
    responseTime.textContent = status.response_time ? `${status.response_time}ms` : '-';

    if (status.checked_at) {
        const date = new Date(status.checked_at);
        lastChecked.textContent = date.toLocaleTimeString();
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

        // Redirect non-admins to regular dashboard
        if (!currentUser.isAdmin) {
            window.location.href = '/dashboard';
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

// Load media freshness
async function loadMediaFreshness() {
    try {
        const response = await fetch('/api/media/freshness');
        if (response.ok) {
            const freshness = await response.json();
            displayMediaFreshness(freshness);
        }
    } catch (error) {
        console.error('Error loading media freshness:', error);
    }
}

// Display media freshness
function displayMediaFreshness(freshness) {
    const freshnessList = document.getElementById('freshness-list');

    if (freshness.length === 0) {
        freshnessList.innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                No media data available
            </p>
        `;
        return;
    }

    freshnessList.innerHTML = freshness.map(item => {
        let freshnessClass = 'freshness-recent';
        let freshnessText = 'Recent';

        if (item.last_added_date) {
            const daysSince = Math.floor((Date.now() - new Date(item.last_added_date).getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince > 30) {
                freshnessClass = 'freshness-very-old';
                freshnessText = `${daysSince} days ago`;
            } else if (daysSince > 7) {
                freshnessClass = 'freshness-old';
                freshnessText = `${daysSince} days ago`;
            } else {
                freshnessText = daysSince === 0 ? 'Today' : `${daysSince} day${daysSince > 1 ? 's' : ''} ago`;
            }
        } else {
            freshnessClass = 'freshness-very-old';
            freshnessText = 'No recent additions';
        }

        return `
            <div class="freshness-item">
                <h4>${escapeHtml(item.library_name)} <small style="color: var(--text-secondary);">(${item.total_items} items)</small></h4>
                <div class="freshness-date ${freshnessClass}">
                    Last added: ${item.last_added_item || 'N/A'} - ${freshnessText}
                </div>
            </div>
        `;
    }).join('');
}

// Load all tickets
async function loadTickets() {
    try {
        const response = await fetch('/api/tickets/all');
        if (response.ok) {
            allTickets = await response.json();
            displayTickets();
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

// Filter tickets
function filterTickets(filter) {
    currentFilter = filter;

    // Update button states
    ['all', 'open', 'in-progress', 'closed'].forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (f === filter) {
            btn.style.background = 'var(--plex-orange)';
            btn.style.color = 'white';
        } else {
            btn.style.background = '';
            btn.style.color = '';
        }
    });

    displayTickets();
}

// Display tickets
function displayTickets() {
    const ticketList = document.getElementById('ticket-list');

    let filteredTickets = allTickets;
    if (currentFilter !== 'all') {
        filteredTickets = allTickets.filter(t => t.status === currentFilter);
    }

    if (filteredTickets.length === 0) {
        ticketList.innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                No ${currentFilter !== 'all' ? currentFilter : ''} tickets
            </p>
        `;
        return;
    }

    ticketList.innerHTML = filteredTickets.map(ticket => `
        <div class="glass-card ticket-item priority-${ticket.priority}">
            <div class="ticket-info">
                <h4>${escapeHtml(ticket.title)}</h4>
                <div class="ticket-meta">
                    User: <strong>${escapeHtml(ticket.username)}</strong> (${escapeHtml(ticket.email)})
                    • Opened ${new Date(ticket.created_at).toLocaleDateString()} at ${new Date(ticket.created_at).toLocaleTimeString()}
                    • Priority: <strong>${ticket.priority.toUpperCase()}</strong>
                </div>
                <div class="ticket-description">
                    ${escapeHtml(ticket.description)}
                </div>
            </div>
            <div>
                <span class="ticket-status status-${ticket.status.replace(' ', '-')}" style="cursor: pointer;" onclick="openUpdateTicketModal(${ticket.id}, '${escapeHtml(ticket.title)}', '${escapeHtml(ticket.description)}', '${ticket.status}')">
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

// Open email modal
function openEmailModal() {
    document.getElementById('email-modal').classList.add('active');
}

// Close email modal
function closeEmailModal() {
    document.getElementById('email-modal').classList.remove('active');
    document.getElementById('email-form').reset();
}

// Open update ticket modal
function openUpdateTicketModal(ticketId, title, description, currentStatus) {
    document.getElementById('update-ticket-id').value = ticketId;
    document.getElementById('ticket-title-display').textContent = title;
    document.getElementById('ticket-description-display').textContent = description;
    document.getElementById('update-ticket-status').value = currentStatus;
    document.getElementById('update-ticket-modal').classList.add('active');
}

// Close update ticket modal
function closeUpdateTicketModal() {
    document.getElementById('update-ticket-modal').classList.remove('active');
    document.getElementById('update-ticket-form').reset();
}

// Send mass email
document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = document.getElementById('email-subject').value;
    const message = document.getElementById('email-message').value;

    if (!confirm('Are you sure you want to send this email to all users?')) {
        return;
    }

    try {
        const response = await fetch('/api/admin/email/mass', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ subject, message })
        });

        const data = await response.json();

        if (response.ok) {
            showToast(`Email sent to ${data.sent} users`, 'success');
            if (data.failed > 0) {
                showToast(`Failed to send to ${data.failed} users`, 'error');
            }
            closeEmailModal();
        } else {
            showToast(data.error || 'Failed to send email', 'error');
        }
    } catch (error) {
        console.error('Error sending mass email:', error);
        showToast('An error occurred while sending the email', 'error');
    }
});

// Update ticket status
document.getElementById('update-ticket-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const ticketId = document.getElementById('update-ticket-id').value;
    const status = document.getElementById('update-ticket-status').value;

    try {
        const response = await fetch(`/api/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showToast('Ticket status updated', 'success');
            closeUpdateTicketModal();
            loadTickets();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to update ticket', 'error');
        }
    } catch (error) {
        console.error('Error updating ticket:', error);
        showToast('An error occurred while updating the ticket', 'error');
    }
});

// Refresh all data
async function refreshData() {
    showToast('Refreshing data...', 'info');
    await Promise.all([
        loadServerStatus(),
        loadMediaFreshness(),
        loadTickets()
    ]);
    showToast('Data refreshed', 'success');
}

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

// Close modals when clicking outside
document.getElementById('email-modal').addEventListener('click', (e) => {
    if (e.target.id === 'email-modal') {
        closeEmailModal();
    }
});

document.getElementById('update-ticket-modal').addEventListener('click', (e) => {
    if (e.target.id === 'update-ticket-modal') {
        closeUpdateTicketModal();
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadUserInfo();
    loadServerStatus();
    loadMediaFreshness();
    loadTickets();
    initWebSocket();

    // Set initial filter
    document.getElementById('filter-all').style.background = 'var(--plex-orange)';
    document.getElementById('filter-all').style.color = 'white';
});
