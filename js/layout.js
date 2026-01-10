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
        
        // FIX: Ensure user email is set even if header loads after auth check
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

function setUserEmail(email) {
    const attemptUpdate = () => {
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement) {
            userEmailElement.textContent = email;
        } else {
            // If header isn't injected yet, retry shortly
            setTimeout(attemptUpdate, 100);
        }
    };
    attemptUpdate();
}

function loadHeader() {
    fetch('components/header.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('header').innerHTML = html;
            attachHeaderEvents();
            
            // Re-trigger email check in case auth happened first
            const user = auth.currentUser;
            if (user && user.email) {
                const el = document.getElementById('userEmail');
                if (el) el.textContent = user.email;
            }
        })
        .catch(err => {
            console.error('Error loading header:', err);
        });
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
    // Desktop sidebar toggle
    document.addEventListener('click', function(e) {
        // Toggle from sidebar button
        if (e.target.closest('#sidebarToggleDesktop')) {
            toggleDesktopSidebar();
        }
        
        // Toggle from header button
        if (e.target.closest('#sidebarToggleDesktopHeader')) {
            toggleDesktopSidebar();
        }
        
        // Mobile sidebar toggle
        if (e.target.closest('#sidebarToggleMobile')) {
            document.getElementById('mobileSidebar').classList.remove('-translate-x-full');
            document.getElementById('mobileSidebarOverlay').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        // Close mobile sidebar
        if (e.target.closest('#closeSidebar') || e.target.closest('#mobileSidebarOverlay')) {
            const mobSidebar = document.getElementById('mobileSidebar');
            const mobOverlay = document.getElementById('mobileSidebarOverlay');
            if (mobSidebar) mobSidebar.classList.add('-translate-x-full');
            if (mobOverlay) mobOverlay.classList.add('hidden');
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
    const sidebarNav = document.querySelector('#sidebarNav');
    const sidebarStats = document.getElementById('sidebarStats');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    
    if (!sidebar || !sidebarNav || !sidebarStats || !toggleIcon) return;
    
    // Collapse sidebar container
    sidebar.classList.add('sidebar-collapsed');
    sidebar.classList.remove('lg:col-span-1');
    sidebar.classList.add('lg:col-span-1', 'lg:w-16');
    
    // Hide text in links
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    sidebarLinks.forEach(link => {
        link.classList.add('hidden');
    });
    
    // Hide stats section
    sidebarStats.classList.add('hidden');
    
    // Update toggle icon
    toggleIcon.classList.remove('fa-chevron-left');
    toggleIcon.classList.add('fa-chevron-right');
    
    // Expand main content area
    updateMainContentGrid(true);
}

function expandSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('#sidebarNav');
    const sidebarStats = document.getElementById('sidebarStats');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    
    if (!sidebar || !sidebarNav || !sidebarStats || !toggleIcon) return;
    
    // Expand sidebar container
    sidebar.classList.remove('sidebar-collapsed', 'lg:w-16');
    sidebar.classList.add('lg:col-span-1');
    
    // Show text in links
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    sidebarLinks.forEach(link => {
        link.classList.remove('hidden');
    });
    
    // Show stats section
    sidebarStats.classList.remove('hidden');
    
    // Update toggle icon
    toggleIcon.classList.remove('fa-chevron-right');
    toggleIcon.classList.add('fa-chevron-left');
    
    // Collapse main content area
    updateMainContentGrid(false);
}

function updateMainContentGrid(isCollapsed) {
    const mainContentSelectors = [
        '#mainContent',
        '.lg\\:col-span-3',
        '.lg\\:col-span-4',
        '.lg\\:col-span-5'
    ];
    
    mainContentSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            element.classList.remove('lg:col-span-3', 'lg:col-span-4', 'lg:col-span-5');
            
            if (isCollapsed) {
                if (selector === '.lg\\:col-span-5') {
                    element.classList.add('lg:col-span-5');
                } else {
                    element.classList.add('lg:col-span-4');
                }
            } else {
                if (selector === '.lg\\:col-span-5') {
                    element.classList.add('lg:col-span-5');
                } else {
                    element.classList.add('lg:col-span-3');
                }
            }
        });
    });
}

function attachHeaderEvents() {
    // Mobile sidebar events are handled in setupSidebarFunctionality
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
        link.classList.remove('bg-red-50', 'text-red-600');
        link.classList.add('text-gray-600', 'hover:bg-gray-50');
        
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage) {
            link.classList.remove('text-gray-600', 'hover:bg-gray-50');
            link.classList.add('bg-red-50', 'text-red-600');
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
        });
}

function updateStatsElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function loadQuickStatsForSidebar() {
    const user = auth.currentUser;
    if (user) {
        loadQuickStats(user.uid);
    }
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
