document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loading...');
    
    // Check auth with timeout
    let authTimeout = setTimeout(() => {
        console.warn('Auth check timeout, showing login');
        window.location.href = 'index.html';
    }, 5000);
    
    auth.onAuthStateChanged(user => {
        clearTimeout(authTimeout);
        
        if (!user) {
            console.log('No user, redirecting to login');
            window.location.href = 'index.html';
        } else {
            console.log('User authenticated:', user.email);
            loadDashboardData(user);
            initPWA(); // Initialize PWA after auth
            checkOnlineStatus(); // Check online status
            checkForUpdates(); // Check for PWA updates
        }
    });
});

// PWA Logic: Service Worker Registration & Install Prompt
function initPWA() {
    // Clear any stuck service workers first
    if ('serviceWorker' in navigator) {
        // Unregister any existing service workers
        navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
                registration.unregister();
                console.log('Unregistered old service worker');
            }
        });
        
        // Wait a bit then register new one
        setTimeout(() => {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(reg => {
                        console.log('Service Worker registered with scope:', reg.scope);
                        
                        // Check for controller
                        if (navigator.serviceWorker.controller) {
                            console.log('Service Worker is controlling the page');
                        }
                        
                        // Check for updates
                        reg.onupdatefound = () => {
                            const installingWorker = reg.installing;
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed') {
                                    if (navigator.serviceWorker.controller) {
                                        // New content available
                                        console.log('New content available, please refresh.');
                                        showUpdateNotification();
                                    } else {
                                        // Content is cached for offline use
                                        console.log('Content is cached for offline use.');
                                    }
                                }
                            };
                        };
                    })
                    .catch(err => {
                        console.error('Service Worker registration failed:', err);
                        // Fallback to normal mode
                        disablePWAFeatures();
                    });
            });
        }, 1000);
    }

    // Handle Install Prompt
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button after delay
        setTimeout(() => {
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn) {
                installBtn.classList.remove('hidden');
                installBtn.addEventListener('click', () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        deferredPrompt.userChoice.then((choiceResult) => {
                            if (choiceResult.outcome === 'accepted') {
                                console.log('User accepted the PWA install');
                                showNotification('App installed successfully!', 'success');
                            }
                            deferredPrompt = null;
                            installBtn.classList.add('hidden');
                        });
                    }
                });
            }
        }, 3000);
    });

    // Detect if app is installed
    window.addEventListener('appinstalled', (evt) => {
        console.log('MNRFoodBill was installed');
        showNotification('App installed successfully!', 'success');
    });
}

// Load dashboard data with error handling
async function loadDashboardData(user) {
    try {
        // Show loading state
        const greetingEl = document.getElementById('welcomeGreeting');
        if (greetingEl) greetingEl.textContent = 'Loading...';
        
        // Load data in parallel with timeout
        const loadPromises = [
            loadRestaurantAndUserInfo(user),
            loadDashboardStats(user),
            loadRecentOrders(user)
        ];
        
        // Set timeout for data loading
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Data loading timeout')), 10000);
        });
        
        await Promise.race([
            Promise.all(loadPromises),
            timeoutPromise
        ]);
        
        console.log('Dashboard data loaded successfully');
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Dashboard loaded with limited data', 'warning');
        
        // Try to load at least basic info
        loadRestaurantAndUserInfo(user).catch(() => {
            const greetingEl = document.getElementById('welcomeGreeting');
            if (greetingEl) greetingEl.textContent = 'Welcome!';
        });
    }
}

// Update greeting based on time and name
function updateGreeting(name = null) {
    const greetingEl = document.getElementById('welcomeGreeting');
    const dateTimeEl = document.getElementById('currentDateTime');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let greeting = "";
    
    if (hour < 12) greeting = "Good Morning";
    else if (hour < 17) greeting = "Good Afternoon";
    else greeting = "Good Evening";

    const displayName = name || "Admin";
    greetingEl.textContent = `${greeting}, ${displayName}!`;

    // Update date time
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (dateTimeEl) dateTimeEl.textContent = new Date().toLocaleDateString('en-IN', options);
}

// Load restaurant and user info
function loadRestaurantAndUserInfo(user) {
    return new Promise((resolve, reject) => {
        if (!user) {
            reject(new Error('No user'));
            return;
        }
        
        // Parallel fetch for restaurant and personal user data
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const nameEl = document.getElementById('dashboardRestaurantName');
                    if (nameEl) nameEl.textContent = data.name;
                    
                    // Priority: ownerName from restaurant doc
                    if (data.ownerName) {
                        updateGreeting(data.ownerName);
                        resolve();
                    } else {
                        // Fallback: check users collection
                        db.collection('users').doc(user.uid).get().then(uDoc => {
                            if (uDoc.exists && uDoc.data().name) {
                                updateGreeting(uDoc.data().name);
                            }
                            resolve();
                        }).catch(reject);
                    }
                } else {
                    resolve();
                }
            })
            .catch(reject);
    });
}

// Load dashboard stats with better error handling
function loadDashboardStats(user) {
    return new Promise((resolve, reject) => {
        if (!user) {
            reject(new Error('No user'));
            return;
        }

        // Total revenue and orders (All time)
        const revenuePromise = db.collection('orders')
            .where('restaurantId', '==', user.uid)
            .where('status', '==', 'completed')
            .get()
            .then(snapshot => {
                let totalRevenue = 0;
                let totalOrders = 0;
                
                snapshot.forEach(doc => {
                    const order = doc.data();
                    totalRevenue += order.total || 0;
                    totalOrders++;
                });

                const revEl = document.getElementById('totalRevenue');
                const ordEl = document.getElementById('totalOrders');
                if (revEl) revEl.textContent = `₹${totalRevenue.toFixed(2)}`;
                if (ordEl) ordEl.textContent = totalOrders;
            })
            .catch(err => {
                console.warn('Could not load revenue stats:', err);
            });

        // Total products
        const productsPromise = db.collection('products')
            .where('restaurantId', '==', user.uid)
            .get()
            .then(snapshot => {
                const prodEl = document.getElementById('totalProducts');
                if (prodEl) prodEl.textContent = snapshot.size;
            })
            .catch(err => {
                console.warn('Could not load product count:', err);
            });

        Promise.all([revenuePromise, productsPromise])
            .then(resolve)
            .catch(reject);
    });
}

// Load recent orders
function loadRecentOrders(user) {
    return new Promise((resolve, reject) => {
        if (!user) {
            reject(new Error('No user'));
            return;
        }
        
        const tbody = document.getElementById('recentOrders');
        if (!tbody) {
            resolve();
            return;
        }
        
        db.collection('orders')
            .where('restaurantId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get()
            .then(snapshot => {
                tbody.innerHTML = '';
                
                if (snapshot.empty) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="py-4 text-center text-gray-500">
                                No orders yet
                            </td>
                        </tr>
                    `;
                    resolve();
                    return;
                }
                
                snapshot.forEach(doc => {
                    const order = doc.data();
                    const orderDate = order.createdAt?.toDate() || new Date();
                    const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
                    
                    const row = document.createElement('tr');
                    row.className = 'border-b hover:bg-gray-50';
                    row.innerHTML = `
                        <td class="py-3 px-4">
                            <div class="font-mono text-sm">${order.orderId || doc.id.substring(0, 8)}</div>
                        </td>
                        <td class="py-3 px-4 text-sm text-gray-600">
                            ${orderDate.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}
                        </td>
                        <td class="py-3 px-4 text-sm">${itemCount} items</td>
                        <td class="py-3 px-4 font-bold text-gray-800">₹${order.total ? order.total.toFixed(2) : '0.00'}</td>
                        <td class="py-3 px-4">
                            <span class="px-2 py-1 text-xs font-medium rounded-full ${
                                order.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                'bg-yellow-100 text-yellow-700'
                            }">
                                ${order.status}
                            </span>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
                resolve();
            })
            .catch(err => {
                console.error('Error loading recent orders:', err);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="py-4 text-center text-gray-500">
                            Error loading orders
                        </td>
                    </tr>
                `;
                reject(err);
            });
    });
}

// Fallback function if PWA fails
function disablePWAFeatures() {
    console.log('PWA features disabled, using standard web app');
    // Remove any PWA-specific UI elements
    const installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) installBtn.remove();
}

// Add offline detection
function checkOnlineStatus() {
    if (!navigator.onLine) {
        showNotification('You are offline. Some features may be limited.', 'warning');
        document.body.classList.add('offline');
    }
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
        showNotification('You are back online!', 'success');
        document.body.classList.remove('offline');
    });
    
    window.addEventListener('offline', () => {
        showNotification('You are offline. Some features may be limited.', 'warning');
        document.body.classList.add('offline');
    });
}

// Add service worker update check
function checkForUpdates() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
        
        // Listen for update messages
        navigator.serviceWorker.addEventListener('message', event => {
            if (event.data.type === 'UPDATE_AVAILABLE') {
                showUpdateNotification();
            }
        });
    }
}

// Show update notification
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse';
    notification.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
                <i class="fas fa-sync-alt animate-spin"></i>
                <div>
                    <p class="font-bold">Update Available</p>
                    <p class="text-sm">New version ready. Refresh to update.</p>
                </div>
            </div>
            <button onclick="window.location.reload()" class="ml-4 bg-white text-blue-500 px-4 py-1 rounded font-bold hover:bg-gray-100">
                Refresh
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

// Helper function for notifications (you need to implement this based on your UI)
function showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    // Add your notification UI implementation here
    // Example: toast notification, alert, etc.
}

// Add a force refresh button for testing
function addDebugButtons() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const debugDiv = document.createElement('div');
        debugDiv.className = 'fixed bottom-4 left-4 z-50';
        debugDiv.innerHTML = `
            <button onclick="clearCacheAndReload()" class="bg-red-500 text-white px-4 py-2 rounded text-sm">
                Clear Cache
            </button>
            <button onclick="unregisterSW()" class="bg-yellow-500 text-white px-4 py-2 rounded text-sm ml-2">
                Unregister SW
            </button>
        `;
        document.body.appendChild(debugDiv);
    }
}

// Debug functions
function clearCacheAndReload() {
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
            });
        }).then(() => {
            window.location.reload();
        });
    }
}

function unregisterSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
                registration.unregister();
            });
        }).then(() => {
            window.location.reload();
        });
    }
}

// Initialize debug in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', addDebugButtons);
}
