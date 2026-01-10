// js/layout.js - Enhanced with RBAC
document.addEventListener('DOMContentLoaded', function() {
    let sidebarOpen = true;
    let currentUserData = null;
    
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Load User Profile and check role/permissions
        db.collection('users').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    currentUserData = doc.data();
                    
                    // RBAC: Check access for current page
                    checkPageAccess(currentUserData);
                    
                    // RBAC: Adjust sidebar visibility
                    adjustSidebarModules(currentUserData);
                    
                    // Load Restaurant Info
                    return db.collection('restaurants').doc(currentUserData.restaurantId).get();
                }
            })
            .then(doc => {
                if (doc && doc.exists) {
                    const data = doc.data();
                    const restaurantName = document.getElementById('restaurantName');
                    if (restaurantName) restaurantName.textContent = data.name;
                    
                    const mobileRestaurantName = document.querySelector('#mobileSidebar .text-xl');
                    if (mobileRestaurantName) mobileRestaurantName.textContent = data.name;
                }
            });
        
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = user.email;
        
        loadQuickStats(user.uid);
    });
    
    loadHeader();
    loadSidebar();
    setupMobileSidebar();
    setupDesktopSidebarToggle();
    setupLogout();
});

function checkPageAccess(userData) {
    const page = window.location.pathname.split('/').pop();
    const role = userData.role;
    const permissions = userData.permissions || [];

    // Owner has full access
    if (role === 'owner') return;

    // Mapping pages to permission keys
    const pagePermissionMap = {
        'billing.html': 'billing',
        'products.html': 'products',
        'orders.html': 'orders',
        'settings.html': 'settings',
        'staff.html': 'staff-admin' // Only owner can access staff page
    };

    const requiredPermission = pagePermissionMap[page];
    
    // Redirect staff away from management pages if not permitted
    if (requiredPermission && !permissions.includes(requiredPermission)) {
        if (requiredPermission === 'staff-admin') {
            window.location.href = 'dashboard.html';
        } else {
            // Check if they have ANY module access, otherwise default to dashboard
            const defaultPage = permissions.includes('billing') ? 'billing.html' : 'dashboard.html';
            window.location.href = defaultPage;
        }
    }
}

function adjustSidebarModules(userData) {
    // Wait for sidebar to be injected
    const observer = new MutationObserver(() => {
        const sidebarNav = document.getElementById('sidebarNav');
        const mobileNav = document.querySelector('#mobileSidebar nav');
        
        if (sidebarNav || mobileNav) {
            const role = userData.role;
            const permissions = userData.permissions || [];
            
            // List of restricted links and their permission requirement
            const restrictedLinks = [
                { href: 'billing.html', key: 'billing' },
                { href: 'products.html', key: 'products' },
                { href: 'orders.html', key: 'orders' },
                { href: 'settings.html', key: 'settings' },
                { href: 'staff.html', key: 'staff-admin' }
            ];

            const handleNav = (nav) => {
                if (!nav) return;
                const links = nav.querySelectorAll('a');
                links.forEach(link => {
                    const href = link.getAttribute('href');
                    const config = restrictedLinks.find(l => l.href === href);
                    
                    if (config) {
                        // Only hide if it's staff AND they lack the specific permission
                        if (role === 'staff' && !permissions.includes(config.key)) {
                            link.style.display = 'none';
                        }
                        // Hide staff management from staff entirely
                        if (role === 'staff' && config.key === 'staff-admin') {
                            link.style.display = 'none';
                        }
                    }
                });
            };

            handleNav(sidebarNav);
            handleNav(mobileNav);
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function loadHeader() {
    fetch('components/header.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('header').innerHTML = html;
            attachHeaderEvents();
        })
        .catch(err => {
            console.error('Error loading header:', err);
            document.getElementById('header').innerHTML = '<p>Error loading header</p>';
        });
}

function loadSidebar() {
    fetch('components/sidebar.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('sidebar').innerHTML = html;
            updateActiveLink();
            loadQuickStatsForSidebar();
            
            // Restore sidebar state from localStorage
            const savedState = localStorage.getItem('sidebarOpen');
            if (savedState !== null) {
                sidebarOpen = savedState === 'true';
                if (!sidebarOpen) {
                    collapseSidebar();
                }
            }
        })
        .catch(err => {
            console.error('Error loading sidebar:', err);
            document.getElementById('sidebar').innerHTML = '<p>Error loading sidebar</p>';
        });
}

function updateMainContentGrid() {
    const mainContent = document.querySelector('#mainContent, .lg\\:col-span-3, .lg\\:col-span-4');
    if (!mainContent) return;
    
    if (sidebarOpen) {
        mainContent.classList.remove('lg:col-span-4', 'lg:col-span-5');
        mainContent.classList.add('lg:col-span-3');
    } else {
        mainContent.classList.remove('lg:col-span-3', 'lg:col-span-4');
        mainContent.classList.add('lg:col-span-4');
    }
}

function setupDesktopSidebarToggle() {
    // Desktop toggle in sidebar
    document.addEventListener('click', function(e) {
        if (e.target.closest('#sidebarToggleDesktop') || 
            e.target.closest('#sidebarToggleDesktopHeader')) {
            toggleDesktopSidebar();
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
    
    // Save state to localStorage
    localStorage.setItem('sidebarOpen', sidebarOpen);
}

function collapseSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('#sidebarNav');
    const sidebarStats = document.getElementById('sidebarStats');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    const mainContent = document.querySelector('.lg\\:col-span-3');
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    
    if (sidebar && sidebarNav && sidebarStats && toggleIcon && mainContent) {
        // Collapse sidebar
        sidebar.classList.add('lg:col-span-1', 'lg:max-w-16');
        sidebar.classList.remove('lg:col-span-1');
        
        // Hide text in links
        sidebarLinks.forEach(link => {
            link.style.opacity = '0';
            link.style.width = '0';
            link.style.overflow = 'hidden';
            link.style.transition = 'all 0.3s ease';
        });
        
        // Hide stats section
        sidebarStats.style.opacity = '0';
        sidebarStats.style.height = '0';
        sidebarStats.style.overflow = 'hidden';
        sidebarStats.style.marginTop = '0';
        
        // Adjust toggle icon
        toggleIcon.classList.remove('fa-chevron-left');
        toggleIcon.classList.add('fa-chevron-right');
        
        // Expand main content
        if (mainContent) {
            mainContent.classList.remove('lg:col-span-3');
            mainContent.classList.add('lg:col-span-4');
        }

        // Update main content grid
        updateMainContentGrid();
        
        // Add collapsed class for styling
        sidebar.classList.add('sidebar-collapsed');
    }
}

function expandSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('#sidebarNav');
    const sidebarStats = document.getElementById('sidebarStats');
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    const mainContent = document.querySelector('.lg\\:col-span-4, .lg\\:col-span-3');
    const sidebarLinks = document.querySelectorAll('.sidebar-link span');
    
    if (sidebar && sidebarNav && sidebarStats && toggleIcon && mainContent) {
        // Expand sidebar
        sidebar.classList.remove('lg:col-span-1', 'lg:max-w-16', 'sidebar-collapsed');
        sidebar.classList.add('lg:col-span-1');
        
        // Show text in links
        sidebarLinks.forEach(link => {
            link.style.opacity = '1';
            link.style.width = 'auto';
            link.style.overflow = 'visible';
        });
        
        // Show stats section
        sidebarStats.style.opacity = '1';
        sidebarStats.style.height = 'auto';
        sidebarStats.style.overflow = 'visible';
        sidebarStats.style.marginTop = '2rem';
        
        // Adjust toggle icon
        toggleIcon.classList.remove('fa-chevron-right');
        toggleIcon.classList.add('fa-chevron-left');

         // Update main content grid
         updateMainContentGrid();
        
        // Adjust main content
        mainContent.classList.remove('lg:col-span-4');
        mainContent.classList.add('lg:col-span-3');
    }
}

function attachHeaderEvents() {
    // This will be called after header is loaded
    // The actual events are attached in setupMobileSidebar() and setupDesktopSidebarToggle()
}

function setupMobileSidebar() {
    // Toggle mobile sidebar
    document.addEventListener('click', function(e) {
        if (e.target.closest('#sidebarToggleMobile')) {
            document.getElementById('mobileSidebar').classList.remove('-translate-x-full');
            document.getElementById('mobileSidebarOverlay').classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        if (e.target.closest('#closeSidebar') || e.target.closest('#mobileSidebarOverlay')) {
            document.getElementById('mobileSidebar').classList.add('-translate-x-full');
            document.getElementById('mobileSidebarOverlay').classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        const sidebar = document.getElementById('mobileSidebar');
        const overlay = document.getElementById('mobileSidebarOverlay');
        
        if (sidebar && !sidebar.classList.contains('-translate-x-full') && 
            !sidebar.contains(e.target) && 
            !e.target.closest('#sidebarToggleMobile') && 
            e.target !== overlay) {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
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
    const sidebarLinks = document.querySelectorAll('#sidebar a');
    const mobileLinks = document.querySelectorAll('#mobileSidebar a');
    
    // Update desktop sidebar links
    sidebarLinks.forEach(link => {
        link.classList.remove('bg-red-50', 'text-red-600');
        link.classList.add('text-gray-600', 'hover:bg-gray-50');
        
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage) {
            link.classList.remove('text-gray-600', 'hover:bg-gray-50');
            link.classList.add('bg-red-50', 'text-red-600');
        }
    });
    
    // Update mobile sidebar links
    mobileLinks.forEach(link => {
        link.classList.remove('bg-red-50', 'text-red-600');
        
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage) {
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
    
    // Today's sales and orders
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
            
            // Update desktop sidebar
            const todaySalesEl = document.getElementById('todaySales');
            const todayOrdersEl = document.getElementById('todayOrders');
            
            if (todaySalesEl) todaySalesEl.textContent = `₹${todaySales.toFixed(2)}`;
            if (todayOrdersEl) todayOrdersEl.textContent = todayOrders;
            
            // Update mobile sidebar
            const mobileTodaySales = document.getElementById('mobileTodaySales');
            const mobileTodayOrders = document.getElementById('mobileTodayOrders');
            
            if (mobileTodaySales) mobileTodaySales.textContent = `₹${todaySales.toFixed(2)}`;
            if (mobileTodayOrders) mobileTodayOrders.textContent = todayOrders;
        });
}

function loadQuickStatsForSidebar() {
    const user = auth.currentUser;
    if (user) {
        loadQuickStats(user.uid);
    }
}

// Initialize sidebar state on page load
window.addEventListener('load', function() {
    // Small delay to ensure DOM is fully loaded
    setTimeout(() => {
        const savedState = localStorage.getItem('sidebarOpen');
        if (savedState === 'false') {
            collapseSidebar();
        }
    }, 100);
});
