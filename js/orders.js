document.addEventListener('DOMContentLoaded', function() {
    let orders = [];
    let currentPage = 1;
    const ordersPerPage = 10;
    let selectedOrder = null;
    let orderToDelete = null;

    // Check auth and setup
    setupAuthAndLogout();
    
    // Load initial data
    loadOrders();
    loadTodayStats();
    
    // Setup event listeners
    setupEventListeners();
});

function setupAuthAndLogout() {
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
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });
    }
}

function loadOrders(filters = {}) {
    const user = auth.currentUser;
    let query = db.collection('orders')
        .where('restaurantId', '==', user.uid)
        .orderBy('createdAt', 'desc');

    // Apply filters
    if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        
        query = query.where('createdAt', '>=', start)
                     .where('createdAt', '<=', end);
    }

    if (filters.status && filters.status !== 'all') {
        query = query.where('status', '==', filters.status);
    }

    query.get()
        .then(snapshot => {
            orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                orders.push({
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate() || new Date()
                });
            });
            renderOrdersTable();
            updatePagination();
        });
}

function loadTodayStats() {
    const user = auth.currentUser;
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
            let todayRevenue = 0;
            let todayOrders = 0;
            
            snapshot.forEach(doc => {
                const order = doc.data();
                todayRevenue += order.total || 0;
                todayOrders++;
            });

            const todayOrdersElement = document.getElementById('todayOrdersCount');
            const todayRevenueElement = document.getElementById('todayRevenue');
            const avgOrderValueElement = document.getElementById('avgOrderValue');
            
            if (todayOrdersElement) todayOrdersElement.textContent = todayOrders;
            if (todayRevenueElement) todayRevenueElement.textContent = `₹${todayRevenue.toFixed(2)}`;
            
            const avgOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0;
            if (avgOrderValueElement) avgOrderValueElement.textContent = `₹${avgOrderValue.toFixed(2)}`;
        });
}

function renderOrdersTable() {
    const tbody = document.getElementById('ordersTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-5 text-muted">
                    <i class="fas fa-receipt fs-1 mb-3 d-block"></i>
                    <p>No orders found</p>
                </td>
            </tr>
        `;
        return;
    }

    // Calculate pagination
    const startIndex = (currentPage - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const pageOrders = orders.slice(startIndex, endIndex);

    pageOrders.forEach(order => {
        const orderDate = order.createdAt.toLocaleDateString('en-IN');
        const orderTime = order.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        const statusBadge = getStatusBadge(order.status);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <small class="font-monospace">${order.orderId || order.id.substring(0, 8)}</small>
            </td>
            <td>
                <div>${orderDate}</div>
                <small class="text-muted">${orderTime}</small>
            </td>
            <td>
                <div class="fw-medium">${order.customerName}</div>
                ${order.customerPhone ? `<small class="text-muted">${order.customerPhone}</small>` : ''}
            </td>
            <td>${itemCount} items</td>
            <td class="fw-bold">₹${order.total ? order.total.toFixed(2) : '0.00'}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary view-order" data-id="${order.id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-warning print-order" data-id="${order.id}" title="Print Receipt">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-order" data-id="${order.id}" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Add event listeners
    document.querySelectorAll('.view-order').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.dataset.id;
            viewOrderDetails(orderId);
        });
    });

    document.querySelectorAll('.print-order').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.dataset.id;
            printOrder(orderId);
        });
    });

    document.querySelectorAll('.delete-order').forEach(button => {
        button.addEventListener('click', function() {
            const orderId = this.dataset.id;
            showDeleteOrderModal(orderId);
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

function setupEventListeners() {
    // Apply filters
    const applyFilterBtn = document.getElementById('applyFilter');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', function() {
            const filters = {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value,
                status: document.getElementById('statusFilter').value
            };
            
            currentPage = 1;
            loadOrders(filters);
        });
    }

    // Reset filters
    const resetFilterBtn = document.getElementById('resetFilter');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', function() {
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            document.getElementById('statusFilter').value = 'all';
            
            currentPage = 1;
            loadOrders({});
        });
    }

    // Pagination
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderOrdersTable();
                updatePagination();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(orders.length / ordersPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderOrdersTable();
                updatePagination();
            }
        });
    }

    // Delete confirmation
    const confirmDeleteOrderBtn = document.getElementById('confirmDeleteOrder');
    if (confirmDeleteOrderBtn) {
        confirmDeleteOrderBtn.addEventListener('click', function() {
            if (!orderToDelete) return;
            
            db.collection('orders').doc(orderToDelete).delete()
                .then(() => {
                    showNotification('Order deleted successfully', 'success');
                    orders = orders.filter(o => o.id !== orderToDelete);
                    renderOrdersTable();
                    updatePagination();
                    loadTodayStats(); // Refresh stats
                    closeDeleteOrderModal();
                })
                .catch(error => {
                    showNotification('Error deleting order: ' + error.message, 'danger');
                });
        });
    }
}

function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(orders.length / ordersPerPage));
    const pageInfoElement = document.getElementById('pageInfo');
    
    if (pageInfoElement) {
        pageInfoElement.textContent = `Page ${currentPage} of ${totalPages}`;
    }
    
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.disabled = currentPage === 1;
    }
    if (nextPageBtn) {
        nextPageBtn.disabled = currentPage === totalPages;
    }
}

function viewOrderDetails(orderId) {
    selectedOrder = orders.find(o => o.id === orderId);
    if (!selectedOrder) return;

    const modal = new bootstrap.Modal(document.getElementById('orderModal'));
    const details = document.getElementById('orderDetails');

    let itemsHtml = '';
    if (selectedOrder.items && selectedOrder.items.length > 0) {
        itemsHtml = `
            <div class="mb-4">
                <h6 class="fw-bold mb-3">Items</h6>
                <div class="table-responsive">
                    <table class="table table-sm">
                        <thead class="table-light">
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedOrder.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>₹${item.price.toFixed(2)}</td>
                                    <td class="fw-bold">₹${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    const orderDate = selectedOrder.createdAt.toLocaleDateString('en-IN');
    const orderTime = selectedOrder.createdAt.toLocaleTimeString('en-IN');

    details.innerHTML = `
        <div class="row mb-4">
            <div class="col-md-6 mb-3">
                <label class="form-label text-muted">Order ID</label>
                <div class="fw-bold">${selectedOrder.orderId || selectedOrder.id}</div>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label text-muted">Date & Time</label>
                <div class="fw-bold">${orderDate} ${orderTime}</div>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label text-muted">Customer Name</label>
                <div class="fw-bold">${selectedOrder.customerName}</div>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label text-muted">Phone</label>
                <div class="fw-bold">${selectedOrder.customerPhone || 'N/A'}</div>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label text-muted">Status</label>
                <div>${getStatusBadge(selectedOrder.status)}</div>
            </div>
        </div>
        ${itemsHtml}
        <div class="border-top pt-3">
            <div class="d-flex justify-content-between mb-2">
                <span>Subtotal:</span>
                <span>₹${selectedOrder.subtotal ? selectedOrder.subtotal.toFixed(2) : '0.00'}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <span>GST (${selectedOrder.gstRate || 0}%):</span>
                <span>₹${selectedOrder.gstAmount ? selectedOrder.gstAmount.toFixed(2) : '0.00'}</span>
            </div>
            <div class="d-flex justify-content-between mb-2">
                <span>Service Charge (${selectedOrder.serviceChargeRate || 0}%):</span>
                <span>₹${selectedOrder.serviceCharge ? selectedOrder.serviceCharge.toFixed(2) : '0.00'}</span>
            </div>
            <div class="d-flex justify-content-between fw-bold fs-5 pt-2 border-top">
                <span>Total:</span>
                <span>₹${selectedOrder.total ? selectedOrder.total.toFixed(2) : '0.00'}</span>
            </div>
        </div>
    `;

    modal.show();
}

function printOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    selectedOrder = order;
    window.printOrderReceipt();
}

window.printOrderReceipt = function() {
    if (!selectedOrder) return;

    // Prepare receipt for printing
    let receipt = `
${'='.repeat(32)}
    MNR FOOD COURT
${'='.repeat(32)}
Date: ${selectedOrder.createdAt.toLocaleDateString('en-IN')}
Time: ${selectedOrder.createdAt.toLocaleTimeString('en-IN', {hour12: true})}
${'-'.repeat(32)}
Order ID: ${selectedOrder.orderId || selectedOrder.id}
Customer: ${selectedOrder.customerName}
Phone: ${selectedOrder.customerPhone || 'N/A'}
${'-'.repeat(32)}
ITEM            QTY   AMOUNT
${'-'.repeat(32)}
`;
    
    if (selectedOrder.items) {
        selectedOrder.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            receipt += `${item.name.substring(0, 16).padEnd(16)} ${item.quantity.toString().padStart(3)}   ₹${itemTotal.toFixed(2).padStart(7)}\n`;
        });
    }
    
    receipt += `
${'-'.repeat(32)}
Subtotal:        ₹${selectedOrder.subtotal ? selectedOrder.subtotal.toFixed(2).padStart(10) : '0.00'.padStart(10)}
GST (${selectedOrder.gstRate || 0}%):       ₹${selectedOrder.gstAmount ? selectedOrder.gstAmount.toFixed(2).padStart(10) : '0.00'.padStart(10)}
Service (${selectedOrder.serviceChargeRate || 0}%):    ₹${selectedOrder.serviceCharge ? selectedOrder.serviceCharge.toFixed(2).padStart(10) : '0.00'.padStart(10)}
${'-'.repeat(32)}
TOTAL:          ₹${selectedOrder.total ? selectedOrder.total.toFixed(2).padStart(10) : '0.00'.padStart(10)}
${'='.repeat(32)}
Status: ${selectedOrder.status}
${'='.repeat(32)}
*** DUPLICATE COPY ***
`;
    
    // Set print content and show modal
    const printContent = document.getElementById('printContent');
    if (printContent) {
        printContent.textContent = receipt;
    }
    
    closeOrderModal();
    
    const printModal = new bootstrap.Modal(document.getElementById('printModal'));
    printModal.show();
};

function showDeleteOrderModal(orderId) {
    orderToDelete = orderId;
    const modal = new bootstrap.Modal(document.getElementById('deleteOrderModal'));
    modal.show();
}

window.closeDeleteOrderModal = function() {
    orderToDelete = null;
    const modalElement = document.getElementById('deleteOrderModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
};

window.closeOrderModal = function() {
    const modalElement = document.getElementById('orderModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
};

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
