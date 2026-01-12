// auth.js - Authentication with Role-Based Redirection and State Persistence
const AUTH_STORAGE_KEY = 'mnrfoodbill_auth_state';

// Function to store auth state in localStorage for immediate detection
function storeAuthState(user) {
    if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
            uid: user.uid,
            email: user.email,
            timestamp: Date.now()
        }));
    } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }
}

// Function to get stored auth state
function getStoredAuthState() {
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            // Check if stored data is less than 1 hour old to ensure fresh state
            if (Date.now() - data.timestamp < 3600000) {
                return data;
            }
        }
    } catch (e) {
        console.error('Error reading auth state:', e);
    }
    return null;
}

document.addEventListener('DOMContentLoaded', function() {
    // IMMEDIATE REDIRECT CHECK
    const storedAuth = getStoredAuthState();
    const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/MNRFoodBill/');
    
    if (storedAuth && isIndexPage) {
        // Hide forms immediately if we expect a logged-in user
        const loginFormEl = document.getElementById('loginForm');
        const registerFormEl = document.getElementById('registerForm');
        if (loginFormEl) loginFormEl.classList.add('hidden');
        if (registerFormEl) registerFormEl.classList.add('hidden');
        
        const loginCard = document.querySelector('.login-card');
        if (loginCard) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'authLoadingIndicator';
            loadingDiv.className = 'text-center py-8';
            loadingDiv.innerHTML = `
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-4"></div>
                <h3 class="text-lg font-bold text-gray-800">Checking login status...</h3>
                <p class="text-gray-600 mt-2">Redirecting to your workspace</p>
            `;
            loginCard.appendChild(loadingDiv);
        }
    }

    // FIREBASE AUTH LISTENER
    auth.onAuthStateChanged(async user => {
        storeAuthState(user); // Cache state for next visit
        
        if (user) {
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // ROLE-BASED REDIRECTION LOGIC
                    if (userData.role === 'staff') {
                        const permissions = userData.permissions || [];
                        if (permissions.includes('billing')) {
                            if (isIndexPage) window.location.href = 'billing.html';
                        } else if (permissions.includes('orders')) {
                            if (isIndexPage) window.location.href = 'orders.html';
                        } else {
                            if (isIndexPage) window.location.href = 'dashboard.html';
                        }
                    } else if (userData.role === 'owner') {
                        const restaurantDoc = await db.collection('restaurants')
                            .doc(userData.restaurantId || user.uid).get();
                        
                        if (!restaurantDoc.exists || !restaurantDoc.data().name) {
                            if (isIndexPage) window.location.href = 'settings.html?setup=true';
                        } else {
                            if (isIndexPage) window.location.href = 'dashboard.html';
                        }
                    } else {
                        if (isIndexPage) window.location.href = 'dashboard.html';
                    }
                }
            } catch (error) {
                console.error("Auto-redirect error:", error);
                if (isIndexPage) window.location.href = 'dashboard.html';
            }
        } else {
            // Not logged in
            if (!isIndexPage) {
                window.location.href = 'index.html';
            } else {
                // Remove loading indicator if auth fails
                const loadingInd = document.getElementById('authLoadingIndicator');
                if (loadingInd) loadingInd.remove();
                if (document.getElementById('loginForm')) document.getElementById('loginForm').classList.remove('hidden');
            }
        }
    });

    // Toggle password visibility
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const password = document.getElementById('password');
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
            password.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }

    // Toggle between Login and Registration
    const registerBtn = document.getElementById('registerBtn');
    const backToLogin = document.getElementById('backToLogin');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            const title = document.getElementById('loginTypeTitle');
            if (title) title.textContent = 'Register as Owner';
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', () => {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            const title = document.getElementById('loginTypeTitle');
            if (title) title.textContent = 'Owner Login';
        });
    }

    // Login Form Submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Signing in...';
            showMessage('Signing in...', 'info');

            try {
                await auth.signInWithEmailAndPassword(email, password);
                // The onAuthStateChanged listener handles redirection
            } catch (error) {
                console.error("Login error:", error);
                showMessage(error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Sign In';
            }
        });
    }

    // Owner Registration Logic
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const resName = document.getElementById('restaurantName').value.trim();
            const ownerName = document.getElementById('regOwnerName').value.trim();
            const ownerPhone = document.getElementById('regOwnerPhone').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            showMessage('Creating account...', 'info');
            const joinCode = generateJoinCode();
            
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                await Promise.all([
                    db.collection('restaurants').doc(user.uid).set({
                        name: resName,
                        ownerName: ownerName,
                        phone: ownerPhone,
                        email: email,
                        ownerId: user.uid,
                        joinCode: joinCode,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        settings: {
                            gstRate: 18,
                            serviceCharge: 5,
                            currency: '₹'
                        }
                    }),
                    db.collection('users').doc(user.uid).set({
                        email: email,
                        name: ownerName,
                        phone: ownerPhone,
                        role: 'owner',
                        restaurantId: user.uid,
                        joinCode: joinCode,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                ]);
                
                showMessage(`Account created! Staff code: ${joinCode}`, 'success');
                setTimeout(() => window.location.href = 'settings.html?setup=true', 2000);
            } catch (error) {
                showMessage(error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Register';
            }
        });
    }

    function generateJoinCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        if (!messageDiv) return;
        messageDiv.textContent = text;
        messageDiv.className = `mt-4 p-3 rounded-lg text-sm font-medium ${
            type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 
            type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 
            'bg-blue-100 text-blue-700 border border-blue-200'
        }`;
        messageDiv.classList.remove('hidden');
        setTimeout(() => messageDiv.classList.add('hidden'), 5000);
    }
});

// Offline/Online Detection
window.addEventListener('online', () => {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) indicator.classList.add('hidden');
    showNotification('Back online', 'success');
});

window.addEventListener('offline', () => {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) indicator.classList.remove('hidden');
    showNotification('You are offline', 'warning');
});

if (!navigator.onLine) {
    const indicator = document.getElementById('offlineIndicator');
    if (indicator) indicator.classList.remove('hidden');
}

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white ${type === 'success' ? 'bg-green-500' : 'bg-yellow-500'}`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}
