// js/layout.js - UPDATED TO FETCH EMAIL FROM FIRESTORE
document.addEventListener('DOMContentLoaded', function() {
    let sidebarOpen = true;
    
    // Check authentication
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Load restaurant name and email from Firestore
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    updateRestaurantName(data.name);
                    
                    // Priority: Use email from Firestore, fallback to Auth email
                    const emailToDisplay = data.email || user.email;
                    if (emailToDisplay) {
                        setUserEmail(emailToDisplay);
                    }
                } else if (user.email) {
                    // Fallback if doc doesn't exist yet
                    setUserEmail(user.email);
                }
            })
            .catch(err => {
                console.error("Error fetching user data:", err);
                if (user.email) setUserEmail(user.email);
            });
        
        // Load quick stats
        loadQuickStats(user.uid);
    });
    
    // Load components
    loadHeader();
    loadSidebar();
    setupSidebarFunctionality();
    setupLogout();
});

/**
 * Sets the user email in the header UI
 */
function setUserEmail(email) {
    if (!email) return;
    
    // Attempt multiple times to account for header.html loading delay
    const maxRetries = 10;
    let retries = 0;
    
    const trySet = () => {
        const el = document.getElementById('userEmail');
        if (el) {
            el.textContent = email;
            console.log("Email displayed:", email);
        } else if (retries < maxRetries) {
            retries++;
            setTimeout(trySet, 200);
        }
    };
    
    trySet();
}

function loadHeader() {
    fetch('components/header.html')
        .then(response => response.text())
        .then(html => {
            const headerContainer = document.getElementById('header');
            if (headerContainer) {
                headerContainer.innerHTML = html;
            }
        })
        .catch(err => console.error('Error loading header:', err));
}

function loadSidebar() {
    fetch('components/sidebar.html')
        .then(response => response.text())
        .then(html => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = html;
                
                // Restore sidebar state
                const savedState = localStorage.getItem('sidebarOpen');
                if (savedState !== null) {
                    sidebarOpen = savedState === 'true';
                    setTimeout(() => {
                        if (!sidebarOpen) collapseSidebar();
                        else expandSidebar();
                    }, 100);
                }
                
                updateActiveLink();
                loadQuickStats();
            }
        })
        .catch(err => console.error('Error loading sidebar:', err));
}

function setupSidebarFunctionality() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('#sidebarToggleDesktop') || e.target.closest('#sidebarToggleDesktopHeader')) {
            toggleDesktopSidebar();
        }
        
        if (e.target.closest('#sidebarToggleMobile')) {
            document.getElementById('mobileSidebar')?.classList.remove('-translate-x-full');
            document.getElementById('mobileSidebarOverlay')?.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        if (e.target.closest('#closeSidebar') || e.target.closest('#mobileSidebarOverlay')) {
            document.getElementById('mobileSidebar')?.classList.add('-translate-x-full');
            document.getElementById('mobileSidebarOverlay')?.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
}

function toggleDesktopSidebar() {
    if (sidebarOpen) collapseSidebar();
    else expandSidebar();
    sidebarOpen = !sidebarOpen;
    localStorage.setItem('sidebarOpen', sidebarOpen);
}

function collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.add('sidebar-collapsed');
    sidebar.classList.remove('lg:col-span-1');
    sidebar.classList.add('lg:w-16');
    document.querySelectorAll('.sidebar-link span').forEach(el => el.classList.add('hidden'));
    document.getElementById('sidebarStats')?.classList.add('hidden');
    updateMainContentGrid(true);
}

function expandSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.remove('sidebar-collapsed', 'lg:w-16');
    sidebar.classList.add('lg:col-span-1');
    document.querySelectorAll('.sidebar-link span').forEach(el => el.classList.remove('hidden'));
    document.getElementById('sidebarStats')?.classList.remove('hidden');
    updateMainContentGrid(false);
}

function updateMainContentGrid(isCollapsed) {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.classList.remove('lg:col-span-3', 'lg:col-span-4');
        mainContent.classList.add(isCollapsed ? 'lg:col-span-4' : 'lg:col-span-3');
    }
}

function setupLogout() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('#logoutBtn')) {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        }
    });
}

function updateActiveLink() {
    const currentPage = window.location.pathname.split('/').pop();
    document.querySelectorAll('#sidebar a, #mobileSidebar a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('bg-red-50', 'text-red-600');
        }
    });
}

function loadQuickStats(userId = null) {
    const user = userId || (auth.currentUser ? auth.currentUser.uid : null);
    if (!user) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    db.collection('orders')
        .where('restaurantId', '==', user)
        .where('createdAt', '>=', today)
        .where('status', '==', 'completed')
        .get()
        .then(snapshot => {
            let sales = 0;
            snapshot.forEach(doc => sales += doc.data().total || 0);
            const todaySalesEl = document.getElementById('todaySales');
            const todayOrdersEl = document.getElementById('todayOrders');
            if (todaySalesEl) todaySalesEl.textContent = `₹${sales.toFixed(2)}`;
            if (todayOrdersEl) todayOrdersEl.textContent = snapshot.size;
        });
}

function updateRestaurantName(name) {
    if (!name) return;
    document.querySelectorAll('#restaurantName').forEach(el => el.textContent = name);
}
