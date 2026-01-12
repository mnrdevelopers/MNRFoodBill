document.addEventListener('DOMContentLoaded', function() {
    // Check auth
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            updateGreeting();
            loadRestaurantAndUserInfo();
            loadDashboardStats();
            loadRecentOrders();
            // Initialize PWA Logic
            initPWA();
        }
    });

    // PWA Logic: Service Worker Registration & Install Prompt
    function initPWA() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js')
                    .then(reg => {
                        console.log('Service Worker registered with scope:', reg.scope);
                        
                        // Check for updates
                        reg.onupdatefound = () => {
                            const installingWorker = reg.installing;
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New content is available; notify user or auto-reload
                                    console.log('New content available, please refresh.');
                                }
                            };
                        };
                    })
                    .catch(err => console.error('Service Worker registration failed:', err));
            });
        }

        // Handle Install Prompt
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Optionally show a custom install button in the UI
            const installBtn = document.getElementById('pwaInstallBtn');
            if (installBtn) {
                installBtn.classList.remove('hidden');
                installBtn.addEventListener('click', () => {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('User accepted the PWA install');
                        }
                        deferredPrompt = null;
                        installBtn.classList.add('hidden');
                    });
                });
            }
        });

        // Detect if app is installed
        window.addEventListener('appinstalled', (evt) => {
            console.log('MNRFoodBill was installed');
        });
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
    function loadRestaurantAndUserInfo() {
        const user = auth.currentUser;
        if (!user) return;
        
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
                    } else {
                        // Fallback: check users collection
                        db.collection('users').doc(user.uid).get().then(uDoc => {
                            if (uDoc.exists && uDoc.data().name) {
                                updateGreeting(uDoc.data().name);
                            }
                        });
                    }
                }
            });
    }

    // Load dashboard stats
    function loadDashboardStats() {
        const user = auth.currentUser;
        if (!user) return;

        // Total revenue and orders (All time)
        db.collection('orders')
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
            });

        // Total products
        db.collection('products')
            .where('restaurantId', '==', user.uid)
            .get()
            .then(snapshot => {
                const prodEl = document.getElementById('totalProducts');
                if (prodEl) prodEl.textContent = snapshot.size;
            });
    }

    // Load recent orders
    function loadRecentOrders() {
        const user = auth.currentUser;
        const tbody = document.getElementById('recentOrders');
        if (!tbody) return;
        
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
            });
    }
});

// PWA Update Check Function
function checkForPWAUpdates() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CHECK_FOR_UPDATES' });
    
    // Listen for update messages
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data.type === 'UPDATE_AVAILABLE') {
        showUpdateNotification();
      }
    });
  }
}

function showUpdateNotification() {
  // Check if we're in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                      window.navigator.standalone === true;
  
  if (isStandalone) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <i class="fas fa-sync-alt animate-spin"></i>
          <div>
            <p class="font-bold">Update Available</p>
            <p class="text-sm">New version is ready to install</p>
          </div>
        </div>
        <button onclick="window.location.reload()" class="ml-4 bg-white text-blue-500 px-4 py-1 rounded font-bold hover:bg-gray-100">
          Update
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
}

// Call this when dashboard loads
checkForPWAUpdates();

// Update the loadDashboardData function
async function loadDashboardData(user) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    try {
        // Show loading state
        if (loadingOverlay) {
            loadingOverlay.classList.remove('fade-out');
        }
        
        // Load data in parallel
        await Promise.all([
            loadRestaurantAndUserInfo(user),
            loadDashboardStats(user),
            loadRecentOrders(user)
        ]);
        
        console.log('Dashboard data loaded successfully');
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Dashboard loaded with limited data', 'warning');
    } finally {
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => {
                if (loadingOverlay.parentNode) {
                    loadingOverlay.remove();
                }
            }, 300);
        }
    }
}

