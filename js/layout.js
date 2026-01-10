// js/layout.js - FIXED VERSION
let sidebarOpen = true; // Declare globally at the top

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        console.log("Auth state changed - User email:", user.email);
        
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
        
        // Set user email
        setUserEmailWithRetry(user.email);
        
        setTimeout(() => {
            const emailEl = document.getElementById('userEmail');
            if (emailEl && user.email) {
                emailEl.textContent = user.email;
                console.log("Email set via direct approach");
            }
        }, 1000);
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
 * Sets the user email in the header with retry logic.
 */
function setUserEmailWithRetry(email) {
    if (!email) {
        console.log("No email to set");
        return;
    }
    
    const maxRetries = 15;
    let retryCount = 0;
    const retryInterval = 200;
    
    const trySetEmail = () => {
        const userEmailElement = document.getElementById('userEmail');
        
        if (userEmailElement) {
            userEmailElement.textContent = email;
            console.log("Email successfully set in header:", email);
            return true;
        } 
        
        retryCount++;
        if (retryCount < maxRetries) {
            console.log(`Retry ${retryCount}/${maxRetries} - waiting for userEmail element...`);
            setTimeout(trySetEmail, retryInterval);
        } else {
            console.error("Failed to find userEmail element after", maxRetries, "retries");
            return false;
        }
    };
    
    setTimeout(trySetEmail, 100);
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
                
                const user = auth.currentUser;
                if (user && user.email) {
                    const emailEl = document.getElementById('userEmail');
                    if (emailEl) {
                        emailEl.textContent = user.email;
                        console.log("Email set during header load");
                    }
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
    
    // Update grid classes
    sidebar.classList.remove('lg:col-span-1');
    sidebar.classList.add('lg:w-16');
    
    // Hide text elements
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    sidebarLinks.forEach(link => link.classList.add('hidden'));
    
    // Hide stats and update toggle icon
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
    
    // Show text elements
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    sidebarLinks.forEach(link => link.classList.remove('hidden'));
    
    // Show stats and update toggle icon
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
    console.log("Header events attached");
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

// Add CSS for sidebar collapsed state
const sidebarStyles = document.createElement('style');
sidebarStyles.textContent = `
    .sidebar-collapsed .sidebar-text {
        display: none !important;
    }
    .sidebar-collapsed .sidebar-stats-box {
        display: none !important;
    }
    .sidebar-collapsed .sidebar-link {
        justify-content: center;
    }
    .sidebar-collapsed .sidebar-link i {
        margin-right: 0;
    }
`;
document.head.appendChild(sidebarStyles);

// Backup function to ensure email is always set
window.setUserEmailDirectly = function(email) {
    if (!email) return;
    
    const attempts = [
        { delay: 100, log: "Attempt 1" },
        { delay: 500, log: "Attempt 2" },
        { delay: 1000, log: "Attempt 3" },
        { delay: 2000, log: "Attempt 4" }
    ];
    
    attempts.forEach((attempt, index) => {
        setTimeout(() => {
            const el = document.getElementById('userEmail');
            if (el) {
                el.textContent = email;
                console.log(`${attempt.log}: Email set directly`);
            } else if (index === attempts.length - 1) {
                console.error("userEmail element not found after all attempts");
            }
        }, attempt.delay);
    });
};

// Call this from auth state change
function setUserEmail(email) {
    setUserEmailWithRetry(email);
    window.setUserEmailDirectly(email);
}
