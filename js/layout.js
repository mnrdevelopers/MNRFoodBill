// js/layout.js
document.addEventListener('DOMContentLoaded', function() {
    let sidebarOpen = localStorage.getItem('sidebarOpen') !== 'false';
    
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
                    const restaurantNameElements = document.querySelectorAll('#restaurantName, #mobileSidebar .text-xl');
                    restaurantNameElements.forEach(el => {
                        if (el) el.textContent = data.name;
                    });
                }
            });
        
        const userEmail = document.getElementById('userEmail');
        if (userEmail) userEmail.textContent = user.email;
        
        loadQuickStats(user.uid);
    });
    
    loadHeader();
    loadSidebar(() => {
        // Initialize state after sidebar is loaded
        if (!sidebarOpen) {
            applySidebarState(false);
        }
    });
    
    setupMobileSidebar();
    setupDesktopSidebarToggle();
    setupLogout();
});

function loadHeader() {
    fetch('components/header.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('header').innerHTML = html;
        });
}

function loadSidebar(callback) {
    fetch('components/sidebar.html')
        .then(response => response.text())
        .then(html => {
            const sidebarContainer = document.getElementById('sidebar');
            if (sidebarContainer) {
                sidebarContainer.innerHTML = html;
                updateActiveLink();
                loadQuickStats();
                if (callback) callback();
            }
        });
}

function setupDesktopSidebarToggle() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('#sidebarToggleDesktop') || e.target.closest('#sidebarToggleDesktopHeader')) {
            const sidebar = document.getElementById('sidebar');
            const isOpen = !sidebar.classList.contains('sidebar-collapsed');
            applySidebarState(!isOpen);
        }
    });
}

function applySidebarState(open) {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const icon = document.getElementById('sidebarToggleIcon');
    
    if (!sidebar || !mainContent) return;

    if (open) {
        sidebar.classList.remove('sidebar-collapsed', 'lg:col-span-1');
        sidebar.classList.add('lg:col-span-3');
        mainContent.classList.remove('lg:col-span-11');
        mainContent.classList.add('lg:col-span-9');
        if (icon) icon.classList.replace('fa-chevron-right', 'fa-chevron-left');
    } else {
        sidebar.classList.add('sidebar-collapsed', 'lg:col-span-1');
        sidebar.classList.remove('lg:col-span-3');
        mainContent.classList.remove('lg:col-span-9');
        mainContent.classList.add('lg:col-span-11');
        if (icon) icon.classList.replace('fa-chevron-left', 'fa-chevron-right');
    }
    
    localStorage.setItem('sidebarOpen', open);
}

function setupMobileSidebar() {
    document.addEventListener('click', function(e) {
        const mobileSidebar = document.getElementById('mobileSidebar');
        const overlay = document.getElementById('mobileSidebarOverlay');
        
        if (e.target.closest('#sidebarToggleMobile')) {
            mobileSidebar?.classList.remove('-translate-x-full');
            overlay?.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        if (e.target.closest('#closeSidebar') || e.target.closest('#mobileSidebarOverlay')) {
            mobileSidebar?.classList.add('-translate-x-full');
            overlay?.classList.add('hidden');
            document.body.style.overflow = '';
        }
    });
}

function updateActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.sidebar-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('bg-red-50', 'text-red-600');
            link.classList.remove('text-gray-600');
        } else {
            link.classList.remove('bg-red-50', 'text-red-600');
            link.classList.add('text-gray-600');
        }
    });
}

function loadQuickStats(userId = null) {
    const user = userId ? {uid: userId} : auth.currentUser;
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    db.collection('orders')
        .where('restaurantId', '==', user.uid)
        .where('createdAt', '>=', today)
        .where('createdAt', '<', tomorrow)
        .where('status', '==', 'completed')
        .get()
        .then(snapshot => {
            let sales = 0;
            snapshot.forEach(doc => sales += doc.data().total || 0);
            
            const salesEls = document.querySelectorAll('#todaySales, #mobileTodaySales');
            const countEls = document.querySelectorAll('#todayOrders, #mobileTodayOrders');
            
            salesEls.forEach(el => el.textContent = `₹${sales.toFixed(2)}`);
            countEls.forEach(el => el.textContent = snapshot.size);
        });
}

function setupLogout() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('#logoutBtn')) {
            auth.signOut().then(() => window.location.href = 'index.html');
        }
    });
}
