document.addEventListener('DOMContentLoaded', function() {
    // Check auth and setup logout for all pages
    setupAuthAndLogout();
    
    // Load dashboard specific data
    loadDashboardData();
});

function setupAuthAndLogout() {
    // Check authentication
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadUserInfo();
            setupLogoutButton();
        }
    });
}

function loadUserInfo() {
    const user = auth.currentUser;
    if (!user) return;
    
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }
    
    // Load restaurant name
    db.collection('restaurants').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                const restaurantNameElement = document.getElementById('restaurantName');
                if (restaurantNameElement) {
                    restaurantNameElement.textContent = data.name || 'MNRFoodBill';
                }
            }
        })
        .catch(error => console.error("Error loading restaurant info:", error));
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            }).catch(error => {
                console.error("Logout error:", error);
                showNotification('Logout failed. Please try again.', 'danger');
            });
        });
    }
}

function loadDashboardData() {
    const user = auth.currentUser;
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Today's sales and orders
    db.collection('orders')
        .where('restaurantId', '==', user.uid)
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

            const todaySalesElement = document.getElementById('todaySales');
            const todayOrdersElement = document.getElementById('todayOrders');
            
            if (todaySalesElement) todaySalesElement.textContent = `₹${todaySales.toFixed(2)}`;
            if (todayOrdersElement) todayOrdersElement.textContent = todayOrders;
        });

    // Total revenue and orders
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

            const totalRevenueElement = document.getElementById('totalRevenue');
            const totalOrdersElement = document.getElementById('totalOrders');
            
            if (totalRevenueElement) totalRevenueElement.textContent = `₹${totalRevenue.toFixed(2)}`;
            if (totalOrdersElement) totalOrdersElement.textContent = totalOrders;
        });

    // Total products
    db.collection('products')
        .where('restaurantId', '==', user.uid)
        .get()
        .then(snapshot => {
            const totalProductsElement = document.getElementById('totalProducts');
            if (totalProductsElement) {
                totalProductsElement.textContent = snapshot.size;
            }
        });

    // Load recent orders
    loadRecentOrders();
}

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
                        <td colspan="5" class="text-center text-muted py-4">
                            <i class="fas fa-receipt fs-1 mb-2 d-block"></i>
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
                
                const statusBadge = getStatusBadge(order.status || 'saved');
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <small class="font-monospace">${order.orderId || doc.id.substring(0, 8)}</small>
                    </td>
                    <td>
                        ${orderDate.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}
                    </td>
                    <td>${itemCount} items</td>
                    <td class="fw-bold">₹${order.total ? order.total.toFixed(2) : '0.00'}</td>
                    <td>${statusBadge}</td>
                `;
                tbody.appendChild(row);
            });
        });
}

function getStatusBadge(status) {
    const statusMap = {
        'completed': 'success',
        'saved': 'warning',
        'cancelled': 'danger'
    };
    
    const color = statusMap[status] || 'secondary';
    return `<span class="badge bg-${color}">${status}</span>`;
}

function showNotification(message, type) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification-toast position-fixed top-0 end-0 m-3 toast show`;
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
        <div class="toast-header bg-${type} text-white">
            <strong class="me-auto">${type === 'success' ? 'Success' : type === 'danger' ? 'Error' : 'Info'}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Make functions available globally for modals
window.closePrintModal = function() {
    const modal = document.getElementById('printModal');
    if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) {
            bsModal.hide();
        } else {
            // If modal is not initialized, hide it manually
            modal.classList.remove('show');
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            const backdrop = document.querySelector('.modal-backdrop');
            if (backdrop) backdrop.remove();
        }
    }
};

window.printReceipt = function() {
    // This function will be overridden by print.js
    console.log('Print receipt function called');
};
