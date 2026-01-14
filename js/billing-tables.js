// js/billing-tables.js
document.addEventListener('DOMContentLoaded', function() {
    // Wait for billing.js to initialize
    setTimeout(initTableManagement, 500);
});

function initTableManagement() {
    renderTables();
    setupTableEventListeners();
    updateTableCartInfo();
    
    // Listen for cart changes
    document.addEventListener('cartUpdated', updateTableCartInfo);
    
    // Listen for table changes
    document.addEventListener('tableChanged', function(e) {
        updateActiveTableInfo();
        updateTableCartInfo();
        
        // Load cart items from active table
        const tableId = e.detail.tableId;
        if (tableId) {
            loadCartFromTable(tableId);
        }
    });
}

function renderTables() {
    const container = document.getElementById('tablesContainer');
    if (!container) return;
    
    const tables = window.TableManager.getAllTables();
    const activeTableId = window.TableManager.getActiveTable();
    
    container.innerHTML = '';
    
    tables.forEach(table => {
        const tableOrder = window.TableManager.getTableOrders(table.id);
        const isActive = table.id === activeTableId;
        
        const tableCard = document.createElement('div');
        tableCard.className = `table-card bg-white rounded-lg shadow-sm border p-3 relative cursor-pointer ${table.status} ${isActive ? 'active' : ''}`;
        tableCard.dataset.tableId = table.id;
        
        // Add pulse animation if table has orders
        if (tableOrder.orders.length > 0 && !isActive) {
            tableCard.classList.add('pulse');
        }
        
        tableCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <h3 class="font-bold text-gray-800 text-lg">${table.name}</h3>
                    <div class="flex items-center space-x-2 mt-1">
                        <span class="table-status status-badge ${getStatusClass(table.status)}">
                            ${table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                        </span>
                        <span class="text-xs text-gray-500">
                            <i class="fas fa-users"></i> ${table.capacity}
                        </span>
                    </div>
                </div>
                
                <div class="table-actions flex space-x-1">
                    ${table.status === 'occupied' ? `
                        <button class="view-orders-btn p-1.5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200" 
                                title="View Orders">
                            <i class="fas fa-eye text-xs"></i>
                        </button>
                    ` : ''}
                    <button class="edit-table-btn p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200" 
                            title="Edit Table">
                        <i class="fas fa-edit text-xs"></i>
                    </button>
                </div>
            </div>
            
            ${table.status === 'occupied' ? `
                <div class="border-t pt-2 mt-2">
                    <div class="space-y-1 text-xs">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Orders:</span>
                            <span class="font-medium">${tableOrder.orders.length}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">Items:</span>
                            <span>${tableOrder.orders.reduce((total, order) => total + order.items.length, 0)}</span>
                        </div>
                        <div class="flex justify-between font-bold text-gray-700">
                            <span>Total:</span>
                            <span class="text-red-600">₹${tableOrder.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="mt-3">
                ${table.status === 'available' ? `
                    <button class="occupy-table-btn w-full bg-red-500 text-white py-1.5 rounded text-sm hover:bg-red-600 transition">
                        <i class="fas fa-user-plus mr-1"></i> Occupy
                    </button>
                ` : table.status === 'occupied' ? `
                    <button class="checkout-table-btn w-full bg-green-500 text-white py-1.5 rounded text-sm hover:bg-green-600 transition">
                        <i class="fas fa-receipt mr-1"></i> Checkout
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(tableCard);
    });
    
    updateActiveTableInfo();
}

function setupTableEventListeners() {
    // Table card click
    document.addEventListener('click', function(e) {
        const tableCard = e.target.closest('.table-card');
        if (tableCard) {
            const tableId = tableCard.dataset.tableId;
            handleTableClick(tableId);
            return;
        }
        
        // Occupy button
        if (e.target.closest('.occupy-table-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            e.stopPropagation();
            showOccupyTableModal(tableId);
            return;
        }
        
        // Checkout button
        if (e.target.closest('.checkout-table-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            e.stopPropagation();
            showCheckoutModal(tableId);
            return;
        }
        
        // View orders button
        if (e.target.closest('.view-orders-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            e.stopPropagation();
            viewTableOrders(tableId);
            return;
        }
        
        // Clear active table
        if (e.target.closest('#clearActiveTable')) {
            e.preventDefault();
            clearActiveTable();
            return;
        }
        
        // View table orders from cart
        if (e.target.closest('#viewTableOrdersBtn')) {
            const activeTableId = window.TableManager.getActiveTable();
            if (activeTableId) {
                viewTableOrders(activeTableId);
            }
            return;
        }
    });
}

function handleTableClick(tableId) {
    const table = window.TableManager.getTableById(tableId);
    
    if (table.status === 'available') {
        showOccupyTableModal(tableId);
    } else if (table.status === 'occupied') {
        // Set as active table
        window.TableManager.setActiveTable(tableId);
        renderTables();
        
        // Load cart from this table
        loadCartFromTable(tableId);
        
        showNotification(`Now taking orders for ${table.name}`, 'info');
    }
}

function showOccupyTableModal(tableId) {
    const table = window.TableManager.getTableById(tableId);
    
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-md">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-800">Occupy ${table.name}</h3>
                        <button onclick="closeModal(this)" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="occupyTableForm">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-gray-700 mb-2">Customer Name</label>
                                <input type="text" id="tableCustomerName" 
                                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" 
                                       placeholder="Enter customer name" required>
                            </div>
                            <div>
                                <label class="block text-gray-700 mb-2">Phone Number</label>
                                <input type="tel" id="tableCustomerPhone" 
                                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" 
                                       placeholder="Enter phone number">
                            </div>
                            <div>
                                <label class="block text-gray-700 mb-2">Number of Guests</label>
                                <input type="number" id="tableGuests" min="1" max="${table.capacity}"
                                       class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent" 
                                       value="1" required>
                            </div>
                        </div>
                        
                        <div class="mt-6 flex space-x-3">
                            <button type="submit" 
                                    class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition">
                                Occupy Table
                            </button>
                            <button type="button" onclick="closeModal(this)"
                                    class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50 transition">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    modal.id = 'occupyTableModal';
    document.body.appendChild(modal);
    
    // Focus on first input
    setTimeout(() => {
        document.getElementById('tableCustomerName')?.focus();
    }, 100);
    
    // Form submission
    document.getElementById('occupyTableForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const customerInfo = {
            name: document.getElementById('tableCustomerName').value.trim(),
            phone: document.getElementById('tableCustomerPhone').value.trim(),
            guests: parseInt(document.getElementById('tableGuests').value)
        };
        
        if (window.TableManager.occupyTable(tableId, customerInfo)) {
            renderTables();
            updateActiveTableInfo();
            updateTableCartInfo();
            showNotification(`${table.name} is now occupied`, 'success');
            closeModal(document.querySelector('#occupyTableModal button[onclick]'));
        }
    });
}

function closeModal(button) {
    const modal = button.closest('.fixed.inset-0');
    if (modal) {
        modal.remove();
    }
}

function updateActiveTableInfo() {
    const activeTableInfo = document.getElementById('activeTableInfo');
    const currentTableName = document.getElementById('currentTableName');
    const activeTableId = window.TableManager.getActiveTable();
    
    if (activeTableId) {
        const table = window.TableManager.getTableById(activeTableId);
        activeTableInfo.classList.remove('hidden');
        currentTableName.textContent = table.name;
    } else {
        activeTableInfo.classList.add('hidden');
    }
}

function clearActiveTable() {
    window.TableManager.setActiveTable(null);
    renderTables();
    updateActiveTableInfo();
    updateTableCartInfo();
    
    // Clear cart
    if (window.cart) {
        window.cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
    }
    
    showNotification('No active table', 'info');
}

function updateTableCartInfo() {
    const tableCartInfo = document.getElementById('tableCartInfo');
    const cartTableName = document.getElementById('cartTableName');
    const cartTableStatus = document.getElementById('cartTableStatus');
    
    const activeTableId = window.TableManager.getActiveTable();
    
    if (activeTableId) {
        const table = window.TableManager.getTableById(activeTableId);
        const tableOrder = window.TableManager.getTableOrders(activeTableId);
        
        tableCartInfo.classList.remove('hidden');
        cartTableName.textContent = table.name;
        
        if (tableOrder.orders.length > 0) {
            cartTableStatus.textContent = `${tableOrder.orders.length} orders • ${tableOrder.orders.reduce((total, order) => total + order.items.length, 0)} items`;
        } else {
            cartTableStatus.textContent = 'No orders yet';
        }
    } else {
        tableCartInfo.classList.add('hidden');
    }
}

function loadCartFromTable(tableId) {
    if (!window.cart) window.cart = [];
    
    // Get all items from table orders
    const tableOrder = window.TableManager.getTableOrders(tableId);
    const allItems = [];
    
    tableOrder.orders.forEach(order => {
        order.items.forEach(item => {
            const existingItem = allItems.find(i => i.id === item.id);
            if (existingItem) {
                existingItem.quantity += item.quantity;
            } else {
                allItems.push({...item});
            }
        });
    });
    
    // Update cart
    window.cart = [...allItems];
    
    // Update UI if functions exist
    if (typeof renderCart === 'function') {
        renderCart();
    }
    
    if (typeof updateTotals === 'function') {
        updateTotals();
    }
    
    // Update customer info
    if (tableOrder.customer) {
        const customerNameInput = document.getElementById('customerName');
        const customerPhoneInput = document.getElementById('customerPhone');
        
        if (customerNameInput) customerNameInput.value = tableOrder.customer.name || '';
        if (customerPhoneInput) customerPhoneInput.value = tableOrder.customer.phone || '';
    }
}

function viewTableOrders(tableId) {
    const table = window.TableManager.getTableById(tableId);
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-2xl my-8">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-gray-800">${table.name} - Order History</h3>
                        <button onclick="closeModal(this)" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    ${tableOrder.customer ? `
                        <div class="bg-gray-50 rounded-lg p-4 mb-6">
                            <h4 class="font-bold text-gray-700 mb-2">Customer</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p class="text-sm text-gray-500">Name</p>
                                    <p class="font-medium">${tableOrder.customer.name || 'Walk-in Customer'}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Phone</p>
                                    <p class="font-medium">${tableOrder.customer.phone || 'N/A'}</p>
                                </div>
                                ${tableOrder.customer.guests ? `
                                    <div>
                                        <p class="text-sm text-gray-500">Guests</p>
                                        <p class="font-medium">${tableOrder.customer.guests}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${tableOrder.orders.length > 0 ? `
                        <div class="space-y-6">
                            ${tableOrder.orders.map((order, index) => `
                                <div class="border rounded-lg overflow-hidden">
                                    <div class="bg-gray-50 px-4 py-3 flex justify-between items-center">
                                        <div>
                                            <span class="font-bold">Order ${index + 1}</span>
                                            <span class="text-sm text-gray-500 ml-3">
                                                ${new Date(order.timestamp).toLocaleTimeString('en-IN', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        <span class="font-bold">₹${order.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div class="p-4">
                                        <div class="space-y-2">
                                            ${order.items.map(item => `
                                                <div class="flex justify-between items-center py-1">
                                                    <div class="flex items-center space-x-3">
                                                        <span>${item.name}</span>
                                                        <span class="text-sm text-gray-500">× ${item.quantity}</span>
                                                    </div>
                                                    <span class="font-medium">₹${(item.price * item.quantity).toFixed(2)}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                            
                            <div class="bg-red-50 rounded-lg p-4">
                                <h4 class="font-bold text-gray-700 mb-3">Total Summary</h4>
                                <div class="space-y-2">
                                    <div class="flex justify-between">
                                        <span>Subtotal:</span>
                                        <span>₹${tableOrder.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>GST:</span>
                                        <span>₹${tableOrder.gst.toFixed(2)}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span>Service Charge:</span>
                                        <span>₹${tableOrder.service.toFixed(2)}</span>
                                    </div>
                                    <div class="flex justify-between text-lg font-bold pt-2 border-t">
                                        <span>Total:</span>
                                        <span class="text-red-600">₹${tableOrder.total.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="text-center py-8">
                            <i class="fas fa-receipt text-4xl text-gray-300 mb-4"></i>
                            <p class="text-gray-500">No orders for this table yet</p>
                        </div>
                    `}
                    
                    <div class="mt-6 flex space-x-3">
                        <button onclick="setActiveTableAndClose('${tableId}')" 
                                class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                            <i class="fas fa-chair mr-2"></i> Make Active
                        </button>
                        <button onclick="closeModal(this)"
                                class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    modal.id = 'viewOrdersModal';
    document.body.appendChild(modal);
}

window.setActiveTableAndClose = function(tableId) {
    window.TableManager.setActiveTable(tableId);
    renderTables();
    updateActiveTableInfo();
    updateTableCartInfo();
    loadCartFromTable(tableId);
    closeModal(document.querySelector('#viewOrdersModal button[onclick*="closeModal"]'));
};

function showCheckoutModal(tableId) {
    const table = window.TableManager.getTableById(tableId);
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-2xl my-8">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-gray-800">Checkout - ${table.name}</h3>
                        <button onclick="closeModal(this)" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="bg-red-50 rounded-lg p-4 mb-6">
                        <div class="text-center mb-4">
                            <i class="fas fa-receipt text-3xl text-red-500 mb-2"></i>
                            <h4 class="font-bold text-red-700 text-lg">Final Bill</h4>
                        </div>
                        
                        <div class="space-y-3">
                            <div class="flex justify-between text-lg">
                                <span class="font-bold">Total Amount:</span>
                                <span class="font-bold text-red-600 text-xl">₹${tableOrder.total.toFixed(2)}</span>
                            </div>
                            
                            <div class="text-sm text-gray-600 space-y-1">
                                <div class="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span>₹${tableOrder.subtotal.toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>GST:</span>
                                    <span>₹${tableOrder.gst.toFixed(2)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span>Service Charge:</span>
                                    <span>₹${tableOrder.service.toFixed(2)}</span>
                                </div>
                            </div>
                            
                            ${tableOrder.customer ? `
                                <div class="pt-3 border-t">
                                    <p class="text-sm text-gray-500">Customer: ${tableOrder.customer.name || 'Walk-in'}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <h4 class="font-bold text-gray-700 mb-3">Payment Options</h4>
                        <div class="grid grid-cols-2 gap-3">
                            <button onclick="processTablePayment('${tableId}', 'cash')" 
                                    class="bg-green-100 text-green-700 py-3 rounded-lg font-bold hover:bg-green-200 border border-green-200">
                                <i class="fas fa-money-bill-wave mr-2"></i> Cash
                            </button>
                            <button onclick="processTablePayment('${tableId}', 'card')" 
                                    class="bg-blue-100 text-blue-700 py-3 rounded-lg font-bold hover:bg-blue-200 border border-blue-200">
                                <i class="fas fa-credit-card mr-2"></i> Card
                            </button>
                            <button onclick="processTablePayment('${tableId}', 'upi')" 
                                    class="bg-purple-100 text-purple-700 py-3 rounded-lg font-bold hover:bg-purple-200 border border-purple-200">
                                <i class="fas fa-qrcode mr-2"></i> UPI
                            </button>
                            <button onclick="showSplitBillOptions('${tableId}')" 
                                    class="bg-yellow-100 text-yellow-700 py-3 rounded-lg font-bold hover:bg-yellow-200 border border-yellow-200">
                                <i class="fas fa-cut mr-2"></i> Split Bill
                            </button>
                        </div>
                    </div>
                    
                    <div class="flex space-x-3">
                        <button onclick="printTableBill('${tableId}')" 
                                class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                            <i class="fas fa-print mr-2"></i> Print Bill
                        </button>
                        <button onclick="closeModal(this)"
                                class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                            Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    modal.id = 'checkoutModal';
    document.body.appendChild(modal);
}

window.processTablePayment = function(tableId, paymentMethod) {
    // Save order to Firestore first
    saveTableOrderToFirestore(tableId, paymentMethod);
    
    // Then clear table
    window.TableManager.clearTable(tableId);
    
    // Update UI
    renderTables();
    updateActiveTableInfo();
    updateTableCartInfo();
    
    // Show success message
    showNotification(`Payment processed via ${paymentMethod}. Table cleared.`, 'success');
    
    // Close modal
    closeModal(document.querySelector('#checkoutModal button[onclick*="closeModal"]'));
};

window.printTableBill = function(tableId) {
    const table = window.TableManager.getTableById(tableId);
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    // Prepare receipt content
    let receipt = `\n`;
    receipt += '='.repeat(40) + '\n';
    receipt += `        ${table.name.toUpperCase()}\n`;
    receipt += '='.repeat(40) + '\n';
    receipt += `Date: ${new Date().toLocaleDateString('en-IN')}\n`;
    receipt += `Time: ${new Date().toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}\n`;
    
    if (tableOrder.customer) {
        receipt += `Customer: ${tableOrder.customer.name || 'Walk-in'}\n`;
        if (tableOrder.customer.phone) {
            receipt += `Phone: ${tableOrder.customer.phone}\n`;
        }
    }
    
    receipt += '-'.repeat(40) + '\n';
    receipt += 'ORDER ITEMS:\n';
    receipt += '-'.repeat(40) + '\n';
    
    // List all items from all orders
    tableOrder.orders.forEach((order, orderIndex) => {
        receipt += `Order ${orderIndex + 1}:\n`;
        order.items.forEach(item => {
            receipt += `${item.name.padEnd(25)} ${item.quantity} x ₹${item.price.toFixed(2)} = ₹${(item.price * item.quantity).toFixed(2)}\n`;
        });
        receipt += '\n';
    });
    
    receipt += '-'.repeat(40) + '\n';
    receipt += `Subtotal:           ₹${tableOrder.subtotal.toFixed(2)}\n`;
    receipt += `GST:                ₹${tableOrder.gst.toFixed(2)}\n`;
    receipt += `Service Charge:     ₹${tableOrder.service.toFixed(2)}\n`;
    receipt += '-'.repeat(40) + '\n';
    receipt += `TOTAL:              ₹${tableOrder.total.toFixed(2)}\n`;
    receipt += '='.repeat(40) + '\n';
    receipt += 'Thank you for dining with us!\n';
    receipt += 'Please visit again.\n\n\n';
    
    // Print using existing print function
    if (typeof prepareReceipt === 'function') {
        // Store current cart
        const originalCart = [...window.cart];
        const originalCustomerName = document.getElementById('customerName').value;
        const originalCustomerPhone = document.getElementById('customerPhone').value;
        
        // Set cart to table's items
        window.cart = [];
        tableOrder.orders.forEach(order => {
            order.items.forEach(item => {
                const existingItem = window.cart.find(cartItem => cartItem.id === item.id);
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                } else {
                    window.cart.push({...item});
                }
            });
        });
        
        // Set customer info
        if (tableOrder.customer) {
            document.getElementById('customerName').value = tableOrder.customer.name || '';
            document.getElementById('customerPhone').value = tableOrder.customer.phone || '';
        }
        
        // Update UI
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        // Print
        prepareReceipt();
        
        // Restore original cart and customer info
        window.cart = originalCart;
        document.getElementById('customerName').value = originalCustomerName;
        document.getElementById('customerPhone').value = originalCustomerPhone;
        
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
    }
    
    // Process payment and clear table
    setTimeout(() => {
        processTablePayment(tableId, 'cash');
    }, 1000);
};

async function saveTableOrderToFirestore(tableId, paymentMethod) {
    const user = auth.currentUser;
    if (!user) return;
    
    const table = window.TableManager.getTableById(tableId);
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    if (tableOrder.orders.length === 0) return;
    
    try {
        const orderData = {
            restaurantId: user.uid,
            tableId: tableId,
            tableName: table.name,
            items: [],
            orders: tableOrder.orders,
            customerName: tableOrder.customer?.name || 'Walk-in Customer',
            customerPhone: tableOrder.customer?.phone || '',
            subtotal: tableOrder.subtotal,
            gstRate: window.restaurantSettings?.gstRate || 0,
            gstAmount: tableOrder.gst,
            serviceChargeRate: window.restaurantSettings?.serviceCharge || 0,
            serviceCharge: tableOrder.service,
            total: tableOrder.total,
            paymentMode: paymentMethod,
            status: 'completed',
            orderId: `TBL-${Date.now()}`,
            billNo: `TBL-${Date.now()}`,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Combine all items
        tableOrder.orders.forEach(order => {
            order.items.forEach(item => {
                const existingItem = orderData.items.find(i => i.id === item.id);
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                } else {
                    orderData.items.push({...item});
                }
            });
        });
        
        await db.collection('orders').add(orderData);
        console.log('Table order saved to Firestore');
        
    } catch (error) {
        console.error('Error saving table order:', error);
    }
}

// Override the saveOrder button in billing.js
function overrideBillingFunctions() {
    const originalSaveOrder = window.saveOrder;
    
    window.saveOrder = function() {
        const activeTableId = window.TableManager.getActiveTable();
        
        if (!activeTableId) {
            showNotification('Please select a table first', 'error');
            return;
        }
        
        if (window.cart.length === 0) {
            showNotification('Cart is empty', 'error');
            return;
        }
        
        const table = window.TableManager.getTableById(activeTableId);
        const customerInfo = {
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim()
        };
        
        // Add order to table
        window.TableManager.addOrderToTable(activeTableId, window.cart, customerInfo);
        
        // Show success message
        showNotification(`Order saved to ${table.name}`, 'success');
        
        // Clear cart for next order
        window.cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        // Update tables display
        renderTables();
        updateTableCartInfo();
    };
    
    // Also override the print function
    const originalPrintBill = window.printBill;
    
    window.printBill = function() {
        const activeTableId = window.TableManager.getActiveTable();
        
        if (activeTableId) {
            // Check if table has orders
            const tableOrder = window.TableManager.getTableOrders(activeTableId);
            if (tableOrder.orders.length === 0) {
                showNotification('No orders for this table', 'error');
                return;
            }
            
            // Show checkout modal
            showCheckoutModal(activeTableId);
        } else {
            // Use original print function for no table
            if (typeof prepareReceipt === 'function') {
                prepareReceipt();
            }
        }
    };
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        overrideBillingFunctions();
    }, 1000);
});

// Helper function for notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white font-medium ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
