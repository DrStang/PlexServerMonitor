// Tab switching
function showTab(tabName) {
    // Remove active class from all tabs and forms
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    // Add active class to selected tab
    event.target.classList.add('active');

    // Show corresponding form
    if (tabName === 'standard') {
        document.getElementById('standard-login').classList.add('active');
    } else if (tabName === 'plex') {
        document.getElementById('plex-login').classList.add('active');
    } else if (tabName === 'register') {
        document.getElementById('register-form').classList.add('active');
    }
}

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

// Standard login
document.getElementById('standard-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember-me').checked;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, remember })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Login successful!', 'success');
            setTimeout(() => {
                if (data.user.isAdmin) {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/dashboard';
                }
            }, 500);
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('An error occurred during login', 'error');
    }
});

// Plex login
document.getElementById('plex-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('plex-username').value;
    const password = document.getElementById('plex-password').value;
    const remember = document.getElementById('plex-remember-me').checked;

    try {
        const response = await fetch('/api/auth/plex', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, remember })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Plex login successful!', 'success');
            setTimeout(() => {
                if (data.user.isAdmin) {
                    window.location.href = '/admin';
                } else {
                    window.location.href = '/dashboard';
                }
            }, 500);
        } else {
            showToast(data.error || 'Plex login failed', 'error');
        }
    } catch (error) {
        console.error('Plex login error:', error);
        showToast('An error occurred during Plex login', 'error');
    }
});

// Register
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    if (password !== passwordConfirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Registration successful! Please login.', 'success');
            setTimeout(() => {
                showTab('standard');
                document.getElementById('username').value = username;
            }, 1000);
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('An error occurred during registration', 'error');
    }
});
