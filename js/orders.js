document.addEventListener('DOMContentLoaded', function() {
    let orders = [];
    let currentPage = 1;
    const ordersPerPage = 10;
    let selectedOrder = null;
    let orderToDelete = null;

    let isStaff = false;

    // Check auth
   auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            isStaff = userData.role === 'staff';
        }
        loadOrders();
        loadTodayStats();
    }
});

    // Load orders
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

    // Load today's stats
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

                document.getElementById('todayOrdersCount').textContent = todayOrders;
                document.getElementById('todayRevenue').textContent = `₹${todayRevenue.toFixed(2)}`;
                
                const avgOrderValue = todayOrders > 0 ? todayRevenue / todayOrders : 0;
                document.getElementById('avgOrderValue').textContent = `₹${avgOrderValue.toFixed(2)}`;
            });
    }

    // Render orders table
    function renderOrdersTable() {
        const tbody = document.getElementById('ordersTable');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-gray-500">
                        <i class="fas fa-receipt text-3xl mb-2"></i>
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

            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-4 px-6">
                    <div class="font-mono text-sm">${order.orderId || order.id.substring(0, 8)}</div>
                </td>
                <td class="py-4 px-6">
                    <div>${orderDate}</div>
                    <div class="text-sm text-gray-500">${orderTime}</div>
                </td>
                <td class="py-4 px-6">
                    <div class="font-medium">${order.customerName}</div>
                    ${order.customerPhone ? `<div class="text-sm text-gray-500">${order.customerPhone}</div>` : ''}
                </td>
                <td class="py-4 px-6">${itemCount} items</td>
                <td class="py-4 px-6 font-bold">₹${order.total ? order.total.toFixed(2) : '0.00'}</td>
                <td class="py-4 px-6">
                    <span class="px-3 py-1 rounded-full text-sm ${getStatusClass(order.status)}">
                        ${order.status}
                    </span>
                </td>
                <td class="py-4 px-6">
                    <div class="flex space-x-2">
                        <button class="view-order text-blue-500 hover:text-blue-700" data-id="${order.id}" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="print-order text-orange-500 hover:text-orange-700" data-id="${order.id}" title="Print Receipt">
                            <i class="fas fa-print"></i>
                        </button>
                        <button class="delete-order text-red-500 hover:text-red-700" data-id="${order.id}" title="Delete Order">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
             <td class="py-4 px-6">
            <div class="flex space-x-2">
                <button class="view-order text-blue-500 hover:text-blue-700" data-id="${order.id}" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="print-order text-orange-500 hover:text-orange-700" data-id="${order.id}" title="Print Receipt">
                    <i class="fas fa-print"></i>
                </button>
                ${!isStaff ? `
                    <button class="delete-order text-red-500 hover:text-red-700" data-id="${order.id}" title="Delete Order">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
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

    // Get status CSS class
    function getStatusClass(status) {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'saved':
                return 'bg-yellow-100 text-yellow-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    // View order details
    function viewOrderDetails(orderId) {
        selectedOrder = orders.find(o => o.id === orderId);
        if (!selectedOrder) return;

        const modal = document.getElementById('orderModal');
        const details = document.getElementById('orderDetails');

        let itemsHtml = '';
        if (selectedOrder.items && selectedOrder.items.length > 0) {
            itemsHtml = `
                <h4 class="font-bold text-gray-700">Items:</h4>
                <div class="border rounded-lg overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="py-2 px-4 text-left">Item</th>
                                <th class="py-2 px-4 text-left">Qty</th>
                                <th class="py-2 px-4 text-left">Price</th>
                                <th class="py-2 px-4 text-left">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${selectedOrder.items.map(item => `
                                <tr class="border-t">
                                    <td class="py-2 px-4">${item.name}</td>
                                    <td class="py-2 px-4">${item.quantity}</td>
                                    <td class="py-2 px-4">₹${item.price.toFixed(2)}</td>
                                    <td class="py-2 px-4 font-bold">₹${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        const orderDate = selectedOrder.createdAt.toLocaleDateString('en-IN');
        const orderTime = selectedOrder.createdAt.toLocaleTimeString('en-IN');

        details.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-gray-600">Order ID</p>
                    <p class="font-bold">${selectedOrder.orderId || selectedOrder.id}</p>
                </div>
                <div>
                    <p class="text-gray-600">Date & Time</p>
                    <p class="font-bold">${orderDate} ${orderTime}</p>
                </div>
                <div>
                    <p class="text-gray-600">Customer Name</p>
                    <p class="font-bold">${selectedOrder.customerName}</p>
                </div>
                <div>
                    <p class="text-gray-600">Phone</p>
                    <p class="font-bold">${selectedOrder.customerPhone || 'N/A'}</p>
                </div>
                <div>
                    <p class="text-gray-600">Status</p>
                    <span class="px-3 py-1 rounded-full text-sm ${getStatusClass(selectedOrder.status)}">
                        ${selectedOrder.status}
                    </span>
                </div>
            </div>
            ${itemsHtml}
            <div class="border-t pt-4">
                <div class="flex justify-between mb-2">
                    <span>Subtotal:</span>
                    <span>₹${selectedOrder.subtotal ? selectedOrder.subtotal.toFixed(2) : '0.00'}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span>GST (${selectedOrder.gstRate || 0}%):</span>
                    <span>₹${selectedOrder.gstAmount ? selectedOrder.gstAmount.toFixed(2) : '0.00'}</span>
                </div>
                <div class="flex justify-between mb-2">
                    <span>Service Charge (${selectedOrder.serviceChargeRate || 0}%):</span>
                    <span>₹${selectedOrder.serviceCharge ? selectedOrder.serviceCharge.toFixed(2) : '0.00'}</span>
                </div>
                <div class="flex justify-between text-xl font-bold pt-2 border-t">
                    <span>Total:</span>
                    <span>₹${selectedOrder.total ? selectedOrder.total.toFixed(2) : '0.00'}</span>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    }

    // Print order receipt
    window.printOrderReceipt = function() {
        if (!selectedOrder) return;

        // Prepare receipt for printing
        let receipt = `
            ${'='.repeat(32)}
                FASTFOOD RESTAURANT
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
        document.getElementById('printContent').textContent = receipt;
        closeOrderModal();
        document.getElementById('printModal').classList.remove('hidden');
    };

    // Delete logic
    function showDeleteOrderModal(orderId) {
        orderToDelete = orderId;
        document.getElementById('deleteOrderModal').classList.remove('hidden');
    }

    window.closeDeleteOrderModal = function() {
        orderToDelete = null;
        document.getElementById('deleteOrderModal').classList.add('hidden');
    };

    document.getElementById('confirmDeleteOrder').addEventListener('click', function() {
        if (!orderToDelete) return;
        
        db.collection('orders').doc(orderToDelete).delete()
            .then(() => {
                showNotification('Order deleted successfully', 'success');
                orders = orders.filter(o => o.id !== orderToDelete);
                renderOrdersTable();
                updatePagination();
                loadTodayStats(); // Refresh stats in case a today's order was deleted
                closeDeleteOrderModal();
            })
            .catch(error => {
                showNotification('Error deleting order: ' + error.message, 'error');
            });
    });

    // Print order directly
    function printOrder(orderId) {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        selectedOrder = order;
        printOrderReceipt();
    }

    // Close order modal
    window.closeOrderModal = function() {
        document.getElementById('orderModal').classList.add('hidden');
    };

    // Apply filters
    document.getElementById('applyFilter').addEventListener('click', function() {
        const filters = {
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            status: document.getElementById('statusFilter').value
        };
        
        currentPage = 1;
        loadOrders(filters);
    });

    // Reset filters
    document.getElementById('resetFilter').addEventListener('click', function() {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        document.getElementById('statusFilter').value = 'all';
        
        currentPage = 1;
        loadOrders({});
    });

    // Pagination
    document.getElementById('prevPage').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderOrdersTable();
            updatePagination();
        }
    });

    document.getElementById('nextPage').addEventListener('click', function() {
        const totalPages = Math.ceil(orders.length / ordersPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderOrdersTable();
            updatePagination();
        }
    });

    function updatePagination() {
        const totalPages = Math.max(1, Math.ceil(orders.length / ordersPerPage));
        document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
        
        document.getElementById('prevPage').disabled = currentPage === 1;
        document.getElementById('nextPage').disabled = currentPage === totalPages;
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white font-semibold`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
});

