// js/layout.js
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar state - true = open, false = collapsed
    let sidebarOpen = true;
    let userRole = '';
    let restaurantId = '';
    
    // Check authentication
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // Get user role
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            userRole = userData.role;
            restaurantId = userData.restaurantId || user.uid;
            
            // Load restaurant name
            db.collection('restaurants').doc(restaurantId).get()
                .then(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        const restaurantName = document.getElementById('restaurantName');
                        if (restaurantName) restaurantName.textContent = data.name;
                        
                        const mobileRestaurantName = document.querySelector('#mobileSidebar .text-xl');
                        if (mobileRestaurantName) mobileRestaurantName.textContent = data.name;
                    }
                });
            
            // Set user email with role badge
            const userEmail = document.getElementById('userEmail');
            if (userEmail) {
                userEmail.innerHTML = `
                    <span>${user.email}</span>
                    <span class="ml-2 px-2 py-1 text-xs rounded-full ${userRole === 'owner' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                        ${userRole === 'owner' ? 'Owner' : 'Staff'}
                    </span>
                `;
            }
            
            // Load quick stats
            loadQuickStats(restaurantId);
        }
        
        // Load header and sidebar with role-based content
        loadHeader();
        loadSidebar();
    });
    
    // Load header
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
    
    // Load sidebar with role-based content
    function loadSidebar() {
        // Create dynamic sidebar based on role
        const sidebarHTML = generateSidebarHTML();
        document.getElementById('sidebar').innerHTML = sidebarHTML;
        
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
        
        // Setup sidebar toggle
        setupDesktopSidebarToggle();
    }
    
    function generateSidebarHTML() {
        const isOwner = userRole === 'owner';
        
        return `
            <div class="lg:col-span-1 transition-all duration-300 ease-in-out">
                <div class="bg-white rounded-xl shadow p-4 h-full overflow-y-auto relative">
                    <!-- Toggle Button for Desktop -->
                    <button id="sidebarToggleDesktop" 
                            class="lg:flex hidden absolute -right-3 top-6 bg-red-500 text-white w-6 h-6 rounded-full items-center justify-center z-10 hover:bg-red-600 transition-transform duration-300"
                            title="Toggle Sidebar">
                        <i id="sidebarToggleIcon" class="fas fa-chevron-left text-xs"></i>
                    </button>
                    
                    <!-- User Info -->
                    <div class="mb-6 p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 ${isOwner ? 'bg-red-100' : 'bg-blue-100'} rounded-full flex items-center justify-center">
                                <i class="fas fa-user ${isOwner ? 'text-red-500' : 'text-blue-500'}"></i>
                            </div>
                            <div>
                                <p class="font-medium text-gray-800">${isOwner ? 'Owner' : 'Staff'}</p>
                                <p class="text-xs text-gray-500 truncate" id="sidebarUserEmail"></p>
                            </div>
                        </div>
                    </div>
                    
                    <nav id="sidebarNav" class="space-y-2 transition-all duration-300">
                        <a href="dashboard.html" class="flex items-center space-x-3 p-3 bg-red-50 text-red-600 rounded-lg sidebar-link" data-tooltip="Dashboard">
                            <i class="fas fa-tachometer-alt"></i>
                            <span class="font-medium">Dashboard</span>
                        </a>
                        <a href="billing.html" class="flex items-center space-x-3 p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition sidebar-link" data-tooltip="Billing">
                            <i class="fas fa-cash-register"></i>
                            <span class="font-medium">Billing</span>
                        </a>
                        <a href="products.html" class="flex items-center space-x-3 p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition sidebar-link ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}" data-tooltip="Products" ${!isOwner ? 'onclick="return false;"' : ''}>
                            <i class="fas fa-hamburger"></i>
                            <span class="font-medium">Products</span>
                            ${!isOwner ? '<span class="text-xs text-gray-400 ml-auto">Owner only</span>' : ''}
                        </a>
                        <a href="orders.html" class="flex items-center space-x-3 p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition sidebar-link" data-tooltip="Orders">
                            <i class="fas fa-receipt"></i>
                            <span class="font-medium">Orders</span>
                        </a>
                        ${isOwner ? `
                        <a href="staff-management.html" class="flex items-center space-x-3 p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition sidebar-link" data-tooltip="Staff Management">
                            <i class="fas fa-users"></i>
                            <span class="font-medium">Staff</span>
                        </a>
                        ` : ''}
                        <a href="settings.html" class="flex items-center space-x-3 p-3 text-gray-600 hover:bg-gray-50 rounded-lg transition sidebar-link ${!isOwner ? 'opacity-50 cursor-not-allowed' : ''}" data-tooltip="Settings" ${!isOwner ? 'onclick="return false;"' : ''}>
                            <i class="fas fa-gear"></i>
                            <span class="font-medium">Settings</span>
                            ${!isOwner ? '<span class="text-xs text-gray-400 ml-auto">Owner only</span>' : ''}
                        </a>
                    </nav>

                    <div id="sidebarStats" class="mt-8 p-4 bg-blue-50 rounded-lg transition-all duration-300">
                        <h3 class="font-bold text-blue-800 mb-2">Quick Stats</h3>
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span class="text-blue-600">Today's Sales</span>
                                <span class="font-bold" id="todaySales">₹0</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-blue-600">Today's Orders</span>
                                <span class="font-bold" id="todayOrders">0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
            .where('restaurantId', '==', restaurantId)
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
        loadQuickStats(restaurantId);
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
    
    // Add user email to sidebar
    auth.onAuthStateChanged(user => {
        if (user) {
            const sidebarEmail = document.getElementById('sidebarUserEmail');
            if (sidebarEmail) {
                sidebarEmail.textContent = user.email;
            }
        }
    });
    
    // Call setup functions
    setupMobileSidebar();
    setupLogout();
});
