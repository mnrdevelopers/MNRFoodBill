// js/layout.js
document.addEventListener('DOMContentLoaded', function() {
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
                    const restaurantName = document.getElementById('restaurantName');
                    if (restaurantName) restaurantName.textContent = data.name;
                    
                    const mobileRestaurantName = document.querySelector('#mobileSidebar .text-xl');
                    if (mobileRestaurantName) mobileRestaurantName.textContent = data.name;
                }
            });
        
        // Set user email
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = user.email;
        
        // Load quick stats
        loadQuickStats(user.uid);
    });
    
    // Load header and sidebar
    loadHeader();
    loadSidebar();
    
    // Setup mobile sidebar toggle
    setupMobileSidebar();
    
    // Setup logout button
    setupLogout();
});

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
        })
        .catch(err => {
            console.error('Error loading sidebar:', err);
            document.getElementById('sidebar').innerHTML = '<p>Error loading sidebar</p>';
        });
}

function attachHeaderEvents() {
    // This will be called after header is loaded
    // The actual events are attached in setupMobileSidebar()
}

function setupMobileSidebar() {
    // Toggle mobile sidebar
    document.addEventListener('click', function(e) {
        if (e.target.closest('#sidebarToggle')) {
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
            !e.target.closest('#sidebarToggle') && 
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
    
    sidebarLinks.forEach(link => {
        link.classList.remove('bg-red-50', 'text-red-600');
        link.classList.add('text-gray-600', 'hover:bg-gray-50');
        
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage) {
            link.classList.remove('text-gray-600', 'hover:bg-gray-50');
            link.classList.add('bg-red-50', 'text-red-600');
        }
    });
    
    // Also update mobile sidebar links
    const mobileLinks = document.querySelectorAll('#mobileSidebar a');
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

// Add this to styles.css for better mobile experience
