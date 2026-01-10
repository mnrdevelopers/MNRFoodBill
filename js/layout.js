// js/layout.js - FIXED VERSION
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar state - true = open (expanded), false = collapsed
    let sidebarOpen = true;
    
    // Check authentication
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Load restaurant name
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    updateRestaurantName(data.name);
                }
            });
        
        // Load quick stats
        loadQuickStats(user.uid);
        
        // Ensure user email is set
        setUserEmail(user.email);
    });
    
    // Load header and sidebar
    loadHeader();
    loadSidebar();
    
    // Setup sidebar functionality
    setupSidebarFunctionality();
    
    // Setup logout button
    setupLogout();
});

/**
 * Sets the user email in the header.
 * Uses a small retry logic to handle the race condition of async header loading.
 */
function setUserEmail(email) {
    if (!email) return;

    const updateUI = () => {
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = email;
            console.log("Email set in header:", email);
        } else {
            // If header isn't injected yet, retry shortly
            setTimeout(updateUI, 200);
        }
    };
    updateUI();
}

function loadHeader() {
    fetch('components/header.html')
        .then(response => {
            if (!response.ok) throw new Error('Header fetch failed');
            return response.text();
        })
        .then(html => {
            const headerContainer = document.getElementById('header');
            if (headerContainer) {
                headerContainer.innerHTML = html;
                attachHeaderEvents();
                
                // Immediately check if we already have a user to set the email
                const user = auth.currentUser;
                if (user && user.email) {
                    const el = document.getElementById('userEmail');
                    if (el) el.textContent = user.email;
                }
            }
        })
        .catch(err => {
            console.error('Error loading header:', err);
        });
}

function loadSidebar() {
    fetch('components/sidebar.html')
        .then(response => {
            if (!response.ok) throw new Error('Sidebar fetch failed');
            return response.text();
        })
        .then(html => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = html;
                
                // Restore sidebar state
                const savedState = localStorage.getItem('sidebarOpen');
                if (savedState !== null) {
                    sidebarOpen = savedState === 'true';
                    // Apply the state after a small delay to ensure DOM is ready
                    setTimeout(() => {
                        if (!sidebarOpen) {
                            collapseSidebar();
                        } else {
                            expandSidebar();
                        }
                    }, 100);
                }
                
                updateActiveLink();
                loadQuickStatsForSidebar();
            }
        })
        .catch(err => {
            console.error('Error loading sidebar:', err);
        });
}

function setupSidebarFunctionality() {
    // Event delegation for sidebar buttons
    document.addEventListener('click', function(e) {
        // Desktop sidebar toggle
        if (e.target.closest('#sidebarToggleDesktop') || e.target.closest('#sidebarToggleDesktopHeader')) {
            toggleDesktopSidebar();
        }
        
        // Mobile sidebar toggle
        if (e.target.closest('#sidebarToggleMobile')) {
            const mobileSidebar = document.getElementById('mobileSidebar');
            const overlay = document.getElementById('mobileSidebarOverlay');
            if (mobileSidebar) mobileSidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        // Close mobile sidebar
        if (e.target.closest('#closeSidebar') || e.target.closest('#mobileSidebarOverlay')) {
            const mobileSidebar = document.getElementById('mobileSidebar');
            const overlay = document.getElementById('mobileSidebarOverlay');
            if (mobileSidebar) mobileSidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
}

function toggleDesktopSidebar() {
    if (sidebarOpen) {
        collapseSidebar();
    } else {
        expandSidebar();
    }
    sidebarOpen = !sidebarOpen;
    localStorage.setItem('sidebarOpen', sidebarOpen);
}

function collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarStats = document.getElementById('sidebarStats');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    
    if (!sidebar) return;
    
    sidebar.classList.add('sidebar-collapsed');
    sidebar.classList.remove('lg:col-span-1');
    sidebar.classList.add('lg:w-16');
    
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    sidebarLinks.forEach(link => link.classList.add('hidden'));
    
    if (sidebarStats) sidebarStats.classList.add('hidden');
    if (toggleIcon) {
        toggleIcon.classList.remove('fa-chevron-left');
        toggleIcon.classList.add('fa-chevron-right');
    }
    
    updateMainContentGrid(true);
}

function expandSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarStats = document.getElementById('sidebarStats');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    
    if (!sidebar) return;
    
    sidebar.classList.remove('sidebar-collapsed', 'lg:w-16');
    sidebar.classList.add('lg:col-span-1');
    
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    sidebarLinks.forEach(link => link.classList.remove('hidden'));
    
    if (sidebarStats) sidebarStats.classList.remove('hidden');
    if (toggleIcon) {
        toggleIcon.classList.remove('fa-chevron-right');
        toggleIcon.classList.add('fa-chevron-left');
    }
    
    updateMainContentGrid(false);
}

function updateMainContentGrid(isCollapsed) {
    const mainContentSelectors = ['#mainContent', '.lg\\:col-span-3', '.lg\\:col-span-4'];
    
    mainContentSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.classList.remove('lg:col-span-3', 'lg:col-span-4');
            element.classList.add(isCollapsed ? 'lg:col-span-4' : 'lg:col-span-3');
        });
    });
}

function attachHeaderEvents() {
    // Placeholder for any specific header initialization logic
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
    const sidebarLinks = document.querySelectorAll('#sidebar a, #mobileSidebar a');
    
    sidebarLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage) {
            link.classList.remove('text-gray-600', 'hover:bg-gray-50');
            link.classList.add('bg-red-50', 'text-red-600');
        } else {
            link.classList.add('text-gray-600', 'hover:bg-gray-50');
            link.classList.remove('bg-red-50', 'text-red-600');
        }
    });
}

function loadQuickStats(userId = null) {
    if (!userId) {
        const user = auth.currentUser;
        if (!user) return;
        userId = user.uid;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    db.collection('orders')
        .where('restaurantId', '==', userId)
        .where('createdAt', '>=', today)
        .where('createdAt', '<', tomorrow)
        .where('status', '==', 'completed')
        .get()
        .then(snapshot => {
            let todaySales = 0;
            let todayOrders = 0;
            
            snapshot.forEach(doc => {
                const order = doc.data();
                todaySales += order.total || 0;
                todayOrders++;
            });
            
            updateStatsElement('todaySales', `₹${todaySales.toFixed(2)}`);
            updateStatsElement('todayOrders', todayOrders);
            updateStatsElement('mobileTodaySales', `₹${todaySales.toFixed(2)}`);
            updateStatsElement('mobileTodayOrders', todayOrders);
        })
        .catch(err => console.error("Error loading stats:", err));
}

function updateStatsElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function loadQuickStatsForSidebar() {
    const user = auth.currentUser;
    if (user) loadQuickStats(user.uid);
}

function updateRestaurantName(name) {
    if (!name) return;
    
    const restaurantNameElements = document.querySelectorAll('#restaurantName');
    restaurantNameElements.forEach(el => {
        if (el) el.textContent = name;
    });
    
    const mobileRestaurantName = document.querySelector('#mobileSidebar .text-xl');
    if (mobileRestaurantName) mobileRestaurantName.textContent = name;
}
