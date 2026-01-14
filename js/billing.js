// js/billing-tables.js - Unified Billing and Tables System
let cart = [];
let currentView = 'grid';
let products = [];
let tables = [];
let activeOrders = [];
let restaurantSettings = {};
let currentTableId = null;
let isStaff = false;

// Main initialization
document.addEventListener('DOMContentLoaded', function() {
    // Check auth
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // Check user role
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                isStaff = userData.role === 'staff';
            }
            
            // Load all data
            await loadRestaurantSettings();
            await loadProducts();
            await loadTables();
            await loadActiveOrders();
            
            // Setup UI
            setupTabNavigation();
            setupViewToggle();
            setupPaymentHandlers();
            setupEventListeners();
            
            // Initialize tables view
            renderTableGrid();
            renderActiveOrders();
            
            // Initialize billing view
            renderProductsInGridView(products);
            renderCategories();
            renderCart();
            updateTotals();
        }
    });
});

// Tab Navigation
function setupTabNavigation() {
    const tablesTab = document.getElementById('tablesTab');
    const billingTab = document.getElementById('billingTab');
    const takeawayTab = document.getElementById('takeawayTab');
    const switchToBilling = document.getElementById('switchToBilling');
    
    const tablesView = document.getElementById('tablesView');
    const billingView = document.getElementById('billingView');
    const takeawayView = document.getElementById('takeawayView');
    
    tablesTab.addEventListener('click', () => {
        setActiveTab('tables');
    });
    
    billingTab.addEventListener('click', () => {
        setActiveTab('billing');
    });
    
    takeawayTab.addEventListener('click', () => {
        setActiveTab('takeaway');
    });
    
    if (switchToBilling) {
        switchToBilling.addEventListener('click', () => {
            setActiveTab('billing');
        });
    }
}

function setActiveTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-red-500', 'text-gray-700');
        btn.classList.add('text-gray-500');
    });
    
    // Hide all views
    document.getElementById('tablesView').classList.add('hidden');
    document.getElementById('billingView').classList.add('hidden');
    document.getElementById('takeawayView').classList.add('hidden');
    
    // Show selected view and update tab
    switch(tabName) {
        case 'tables':
            document.getElementById('tablesTab').classList.add('active', 'border-red-500', 'text-gray-700');
            document.getElementById('tablesTab').classList.remove('text-gray-500');
            document.getElementById('tablesView').classList.remove('hidden');
            break;
        case 'billing':
            document.getElementById('billingTab').classList.add('active', 'border-red-500', 'text-gray-700');
            document.getElementById('billingTab').classList.remove('text-gray-500');
            document.getElementById('billingView').classList.remove('hidden');
            break;
        case 'takeaway':
            document.getElementById('takeawayTab').classList.add('active', 'border-red-500', 'text-gray-700');
            document.getElementById('takeawayTab').classList.remove('text-gray-500');
            document.getElementById('takeawayView').classList.remove('hidden');
            break;
    }
}

// Load restaurant settings
async function loadRestaurantSettings() {
    const user = auth.currentUser;
    try {
        const doc = await db.collection('restaurants').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            restaurantSettings = data.settings || {
                gstRate: 18,
                serviceCharge: 5,
                currency: '₹'
            };
            
            // Update UI with restaurant name
            const navName = document.getElementById('restaurantName');
            if (navName) navName.textContent = data.name;
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        // Default settings
        restaurantSettings = {
            gstRate: 18,
            serviceCharge: 5,
            currency: '₹'
        };
    }
}

// Load products
async function loadProducts() {
    const user = auth.currentUser;
    try {
        const snapshot = await db.collection('products')
            .where('restaurantId', '==', user.uid)
            .orderBy('name')
            .get();
        
        products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        // Cache products for offline use
        localStorage.setItem('cachedProducts', JSON.stringify(products));
    } catch (error) {
        console.error("Error loading products:", error);
        // Try to load from cache
        const cached = JSON.parse(localStorage.getItem('cachedProducts')) || [];
        products = cached;
    }
}

// Load tables
async function loadTables() {
    const user = auth.currentUser;
    try {
        const snapshot = await db.collection('tables')
            .where('restaurantId', '==', user.uid)
            .orderBy('tableNumber')
            .get();
        
        tables = [];
        snapshot.forEach(doc => {
            tables.push({ id: doc.id, ...doc.data() });
        });
        
        // Update table select in billing view
        updateTableSelect();
    } catch (error) {
        console.error("Error loading tables:", error);
    }
}

// Load active orders
async function loadActiveOrders() {
    const user = auth.currentUser;
    try {
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', user.uid)
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .get();
        
        activeOrders = [];
        snapshot.forEach(doc => {
            activeOrders.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("Error loading active orders:", error);
    }
}

// Update table select dropdown
function updateTableSelect() {
    const select = document.getElementById('tableSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">No Table (Takeaway/Counter)</option>';
    
    // Add only available tables
    tables.filter(table => table.status === 'available').forEach(table => {
        const option = document.createElement('option');
        option.value = table.id;
        option.textContent = `${table.tableNumber} (${table.capacity} persons)`;
        select.appendChild(option);
    });
}

// Render table grid
function renderTableGrid() {
    const grid = document.getElementById('tableGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (tables.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-table text-4xl text-gray-300 mb-4"></i>
                <p class="text-gray-500">No tables configured</p>
                <button id="setupTables" class="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-plus mr-2"></i> Setup Tables
                </button>
            </div>
        `;
        return;
    }
    
    tables.forEach(table => {
        const statusColor = {
            'available': 'bg-green-500',
            'occupied': 'bg-red-500',
            'reserved': 'bg-yellow-500'
        }[table.status] || 'bg-gray-500';
        
        const tableCard = document.createElement('div');
        tableCard.className = `table-card bg-white rounded-xl shadow-sm border-2 ${table.status === 'occupied' ? 'border-red-200' : table.status === 'reserved' ? 'border-yellow-200' : 'border-green-200'} p-4 text-center cursor-pointer hover:shadow-md transition-shadow`;
        tableCard.dataset.tableId = table.id;
        
        tableCard.innerHTML = `
            <div class="relative">
                <div class="w-16 h-16 ${statusColor} rounded-full flex items-center justify-center mx-auto mb-3">
                    <i class="fas fa-chair text-white text-2xl"></i>
                </div>
                ${table.status === 'occupied' ? 
                    `<span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                        <i class="fas fa-users"></i>
                    </span>` : ''}
            </div>
            <h3 class="font-bold text-gray-800">${table.tableNumber}</h3>
            <p class="text-sm text-gray-500">Capacity: ${table.capacity || 4}</p>
            <div class="mt-2">
                <span class="px-2 py-1 text-xs rounded-full ${table.status === 'available' ? 'bg-green-100 text-green-700' : table.status === 'occupied' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}">
                    ${table.status}
                </span>
            </div>
            <div class="mt-3 space-y-1">
                ${table.status === 'available' ? 
                    `<button class="take-order-btn w-full bg-red-500 text-white py-1 rounded text-sm hover:bg-red-600">
                        <i class="fas fa-utensils mr-1"></i> Take Order
                    </button>` : 
                    `<button class="view-order-btn w-full bg-blue-500 text-white py-1 rounded text-sm hover:bg-blue-600">
                        <i class="fas fa-eye mr-1"></i> View Order
                    </button>`
                }
                ${table.status === 'occupied' ? 
                    `<button class="add-more-btn w-full bg-green-500 text-white py-1 rounded text-sm hover:bg-green-600 mt-1">
                        <i class="fas fa-plus mr-1"></i> Add More
                    </button>` : ''
                }
            </div>
        `;
        
        grid.appendChild(tableCard);
    });
    
    // Add event listeners to table cards
    setupTableCardListeners();
}

function setupTableCardListeners() {
    document.querySelectorAll('.take-order-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const tableId = this.closest('.table-card').dataset.tableId;
            startOrderForTable(tableId);
        });
    });
    
    document.querySelectorAll('.view-order-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const tableId = this.closest('.table-card').dataset.tableId;
            viewTableOrder(tableId);
        });
    });
    
    document.querySelectorAll('.add-more-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const tableId = this.closest('.table-card').dataset.tableId;
            addMoreToTableOrder(tableId);
        });
    });
    
    document.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', function() {
            const tableId = this.dataset.tableId;
            const table = tables.find(t => t.id === tableId);
            if (table) {
                openTableDetails(table);
            }
        });
    });
}

// Start order for table
async function startOrderForTable(tableId) {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    
    try {
        // Update table status
        await db.collection('tables').doc(tableId).update({
            status: 'occupied',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Switch to billing tab and pre-select table
        currentTableId = tableId;
        document.getElementById('tableSelect').value = tableId;
        showCurrentTableBadge(table.tableNumber);
        setActiveTab('billing');
        
        // Clear any existing cart items
        cart = [];
        renderCart();
        updateTotals();
        
        showNotification(`Order started for Table ${table.tableNumber}`, 'success');
        
        // Refresh tables
        await loadTables();
        renderTableGrid();
        
    } catch (error) {
        console.error("Error starting order:", error);
        showNotification('Error starting order: ' + error.message, 'error');
    }
}

function showCurrentTableBadge(tableNumber) {
    const badge = document.getElementById('currentTableBadge');
    const badgeNumber = document.getElementById('currentTableNumber');
    
    if (badge && badgeNumber) {
        badgeNumber.textContent = tableNumber;
        badge.classList.remove('hidden');
    }
}

function hideCurrentTableBadge() {
    const badge = document.getElementById('currentTableBadge');
    if (badge) {
        badge.classList.add('hidden');
    }
}

// View table order
async function viewTableOrder(tableId) {
    try {
        const snapshot = await db.collection('orders')
            .where('restaurantId', '==', auth.currentUser.uid)
            .where('tableId', '==', tableId)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const order = snapshot.docs[0];
            showOrderDetails(order.id, order.data());
        } else {
            showNotification('No active order found for this table', 'info');
        }
    } catch (error) {
        console.error("Error viewing table order:", error);
        showNotification('Error loading order details', 'error');
    }
}

// Add more to table order
function addMoreToTableOrder(tableId) {
    const table = tables.find(t => t.id === tableId);
    if (table) {
        currentTableId = tableId;
        document.getElementById('tableSelect').value = tableId;
        showCurrentTableBadge(table.tableNumber);
        setActiveTab('billing');
        showNotification(`Add more items to Table ${table.tableNumber}`, 'info');
    }
}

// Show order details
async function showOrderDetails(orderId, orderData = null) {
    try {
        let order = orderData;
        if (!order) {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return;
            order = orderDoc.data();
        }
        
        const modal = document.getElementById('orderDetailsModal');
        const content = document.getElementById('orderDetailsContent');
        
        if (!modal || !content) return;
        
        const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        const orderDate = order.createdAt?.toDate() || new Date();
        
        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <p class="text-gray-600">Order ID</p>
                    <p class="font-bold">${order.orderId || orderId}</p>
                </div>
                <div>
                    <p class="text-gray-600">Table</p>
                    <p class="font-bold">${order.tableNumber || 'No Table'}</p>
                </div>
                <div>
                    <p class="text-gray-600">Customer</p>
                    <p class="font-bold">${order.customerName || 'Walk-in Customer'}</p>
                </div>
                <div>
                    <p class="text-gray-600">Date & Time</p>
                    <p class="font-bold">${orderDate.toLocaleDateString('en-IN')} ${orderDate.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
            </div>
            
            <h4 class="font-bold text-gray-700 mb-3">Order Items (${itemCount} items)</h4>
            <div class="border rounded-lg overflow-hidden mb-6">
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
                        ${order.items ? order.items.map(item => `
                            <tr class="border-t">
                                <td class="py-2 px-4">${item.name}</td>
                                <td class="py-2 px-4">${item.quantity}</td>
                                <td class="py-2 px-4">₹${item.price.toFixed(2)}</td>
                                <td class="py-2 px-4 font-bold">₹${(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" class="py-4 text-center text-gray-500">No items</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div class="border-t pt-4">
                <div class="flex justify-between mb-2">
                    <span>Subtotal:</span>
                    <span class="font-bold">₹${order.subtotal ? order.subtotal.toFixed(2) : '0.00'}</span>
                </div>
                ${order.gstAmount > 0 ? `
                    <div class="flex justify-between mb-2">
                        <span>GST (${order.gstRate || 0}%):</span>
                        <span>₹${order.gstAmount ? order.gstAmount.toFixed(2) : '0.00'}</span>
                    </div>
                ` : ''}
                ${order.serviceCharge > 0 ? `
                    <div class="flex justify-between mb-2">
                        <span>Service Charge (${order.serviceChargeRate || 0}%):</span>
                        <span>₹${order.serviceCharge ? order.serviceCharge.toFixed(2) : '0.00'}</span>
                    </div>
                ` : ''}
                <div class="flex justify-between text-xl font-bold border-t pt-4">
                    <span>Total:</span>
                    <span>₹${order.total ? order.total.toFixed(2) : '0.00'}</span>
                </div>
            </div>
            
            <div class="mt-6 flex space-x-3">
                <button onclick="generateBillForOrder('${orderId}')" class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                    <i class="fas fa-print mr-2"></i> Generate Bill
                </button>
                <button onclick="closeOrderDetailsModal()" class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                    Close
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
    } catch (error) {
        console.error("Error showing order details:", error);
        showNotification('Error loading order details', 'error');
    }
}

// Render active orders table
function renderActiveOrders() {
    const tbody = document.getElementById('activeOrdersTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (activeOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-gray-500">
                    <i class="fas fa-receipt text-2xl mb-2"></i>
                    <p>No active orders</p>
                </td>
            </tr>
        `;
        return;
    }
    
    activeOrders.forEach(order => {
        const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
        
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-3 px-4">
                <div class="font-bold">${order.tableNumber || 'No Table'}</div>
                ${order.customerName ? `<div class="text-xs text-gray-500">${order.customerName}</div>` : ''}
            </td>
            <td class="py-3 px-4">
                <div class="font-mono text-sm">${order.orderId || order.id.substring(0, 8)}</div>
                <div class="text-xs text-gray-500">
                    ${orderDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
            </td>
            <td class="py-3 px-4">${itemCount} items</td>
            <td class="py-3 px-4 font-bold">₹${order.total ? order.total.toFixed(2) : '0.00'}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                    Active
                </span>
            </td>
            <td class="py-3 px-4">
                <div class="flex space-x-2">
                    <button class="view-order-btn-table text-blue-500 hover:text-blue-700" data-id="${order.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="add-to-order-btn text-green-500 hover:text-green-700" data-id="${order.id}">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="close-order-btn text-red-500 hover:text-red-700" data-id="${order.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Add event listeners
    document.querySelectorAll('.view-order-btn-table').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.id;
            const order = activeOrders.find(o => o.id === orderId);
            if (order) {
                showOrderDetails(orderId, order);
            }
        });
    });
    
    document.querySelectorAll('.add-to-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.id;
            const order = activeOrders.find(o => o.id === orderId);
            if (order && order.tableId) {
                addMoreToTableOrder(order.tableId);
            }
        });
    });
    
    document.querySelectorAll('.close-order-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const orderId = this.dataset.id;
            closeOrderAndGenerateBill(orderId);
        });
    });
}

// Close order and generate bill
async function closeOrderAndGenerateBill(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) return;
        
        const order = orderDoc.data();
        
        // Generate bill first
        if (window.prepareReceiptForTableOrder) {
            await window.prepareReceiptForTableOrder(orderId, order.tableId);
            
            // Update order status
            await db.collection('orders').doc(orderId).update({
                isActive: false,
                status: 'completed',
                printedAt: firebase.firestore.FieldValue.serverTimestamp(),
                closedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update table status
            if (order.tableId) {
                await db.collection('tables').doc(order.tableId).update({
                    status: 'available',
                    currentOrderId: null,
                    customerCount: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            showNotification('Order completed and bill generated!', 'success');
            
            // Refresh data
            await loadTables();
            await loadActiveOrders();
            renderTableGrid();
            renderActiveOrders();
        }
        
    } catch (error) {
        console.error("Error closing order:", error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Generate bill for order
async function generateBillForOrder(orderId) {
    try {
        if (window.prepareReceiptForTableOrder) {
            await window.prepareReceiptForTableOrder(orderId);
            closeOrderDetailsModal();
        }
    } catch (error) {
        console.error("Error generating bill:", error);
        showNotification('Error generating bill: ' + error.message, 'error');
    }
}

// Open table details
function openTableDetails(table) {
    // Create a simple modal for table details
    const modal = document.getElementById('tableModal');
    const title = document.getElementById('tableModalTitle');
    
    if (!modal) return;
    
    title.textContent = `Table ${table.tableNumber}`;
    document.getElementById('tableId').value = table.id;
    document.getElementById('tableNumber').value = table.tableNumber;
    document.getElementById('tableCapacity').value = table.capacity || 4;
    document.getElementById('tableLocation').value = table.location || 'main_hall';
    
    // Set status
    document.querySelector(`input[name="status"][value="${table.status || 'available'}"]`).checked = true;
    
    modal.classList.remove('hidden');
}

// Close table modal
window.closeTableModal = function() {
    document.getElementById('tableModal').classList.add('hidden');
};

// Close order details modal
window.closeOrderDetailsModal = function() {
    document.getElementById('orderDetailsModal').classList.add('hidden');
};

// Billing functionality (from billing.js)
function setupViewToggle() {
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const productsGrid = document.getElementById('productsGrid');
    const productsList = document.getElementById('productsList');
    
    if (!gridViewBtn || !listViewBtn) return;
    
    gridViewBtn.addEventListener('click', () => {
        if (currentView === 'list') {
            currentView = 'grid';
            gridViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            productsGrid.classList.remove('hidden');
            productsList.classList.add('hidden');
            filterProducts();
        }
    });
    
    listViewBtn.addEventListener('click', () => {
        if (currentView === 'grid') {
            currentView = 'list';
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            productsList.classList.remove('hidden');
            productsGrid.classList.add('hidden');
            filterProducts();
        }
    });
}

function renderCategories() {
    const container = document.querySelector('.category-tab')?.parentElement;
    if (!container) return;
    
    const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
    
    container.innerHTML = '';
    
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = `category-tab px-4 py-2 rounded-lg text-sm whitespace-nowrap ${category === 'all' ? 'active bg-red-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
        button.dataset.category = category;
        button.textContent = category === 'all' ? 'All Items' : category;
        
        button.addEventListener('click', function() {
            document.querySelectorAll('.category-tab').forEach(t => {
                t.classList.remove('active', 'bg-red-500', 'text-white');
                t.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
            });
            
            this.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
            this.classList.add('active', 'bg-red-500', 'text-white');
            
            filterProducts();
        });
        
        container.appendChild(button);
    });
}

function filterProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const activeTab = document.querySelector('.category-tab.active');
    const category = activeTab ? activeTab.dataset.category : 'all';
    
    let filtered = products;
    
    if (category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm)) ||
            (p.category && p.category.toLowerCase().includes(searchTerm))
        );
    }
    
    if (currentView === 'grid') {
        renderProductsInGridView(filtered);
    } else {
        renderProductsInListView(filtered);
    }
}

function renderProductsInGridView(productsToShow) {
    const container = document.getElementById('productsGrid');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (productsToShow.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center text-gray-400">
                <i class="fas fa-search text-2xl mb-2"></i>
                <p class="text-sm">No products found</p>
            </div>
        `;
        return;
    }
    
    productsToShow.forEach(product => {
        const foodTypeColor = product.foodType === 'veg' ? 'bg-green-500' : 'bg-red-500';
        const foodTypeIcon = product.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
        
        const card = document.createElement('div');
        card.className = 'compact-card bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow';
        
        card.innerHTML = `
            <div class="h-20 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                ${product.imageUrl ? 
                    `<img src="${product.imageUrl}" alt="${product.name}" class="w-full h-full object-cover">` :
                    `<i class="fas fa-${foodTypeIcon} ${foodTypeColor === 'bg-green-500' ? 'text-green-400' : 'text-red-400'} text-xl"></i>`
                }
                <div class="absolute top-1 left-1 ${foodTypeColor} text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    <i class="fas fa-${foodTypeIcon} text-xs"></i>
                </div>
                <div class="absolute bottom-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    ₹${Number(product.price || 0).toFixed(0)}
                </div>
            </div>
            <div class="p-2">
                <h3 class="font-medium text-gray-800 text-sm mb-1 truncate">${product.name}</h3>
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>${product.category}</span>
                    <span>${product.baseQuantity || 1} ${product.quantityType || 'plate'}</span>
                </div>
                <button class="add-to-cart w-full mt-2 bg-red-500 text-white py-1 rounded text-xs hover:bg-red-600 transition"
                        data-id="${product.id}">
                    <i class="fas fa-plus mr-1"></i> Add to Cart
                </button>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.add-to-cart')) {
                addToCart(product.id);
            }
        });
        
        card.querySelector('.add-to-cart').addEventListener('click', function(e) {
            e.stopPropagation();
            addToCart(product.id);
        });
        
        container.appendChild(card);
    });
}

function renderProductsInListView(productsToShow) {
    const container = document.getElementById('productsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (productsToShow.length === 0) {
        container.innerHTML = `
            <div class="py-8 text-center text-gray-400">
                <i class="fas fa-search text-xl mb-2"></i>
                <p class="text-sm">No products found</p>
            </div>
        `;
        return;
    }
    
    productsToShow.forEach(product => {
        const foodTypeColor = product.foodType === 'veg' ? 'text-green-500' : 'text-red-500';
        const foodTypeIcon = product.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
        
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer';
        
        item.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="relative">
                    <div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        <i class="fas fa-${foodTypeIcon} ${foodTypeColor}"></i>
                    </div>
                </div>
                <div>
                    <h4 class="font-medium text-gray-800">${product.name}</h4>
                    <div class="text-xs text-gray-500">
                        ${product.category} • ${product.baseQuantity || 1} ${product.quantityType || 'plate'}
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <span class="font-bold">₹${Number(product.price || 0).toFixed(2)}</span>
                <button class="add-to-cart-list bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600"
                        data-id="${product.id}">
                    <i class="fas fa-plus text-xs"></i>
                </button>
            </div>
        `;
        
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.add-to-cart-list')) {
                addToCart(product.id);
            }
        });
        
        item.querySelector('.add-to-cart-list').addEventListener('click', function(e) {
            e.stopPropagation();
            addToCart(product.id);
        });
        
        container.appendChild(item);
    });
}

// Cart functionality
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            quantity: 1,
            imageUrl: product.imageUrl,
            category: product.category,
            foodType: product.foodType
        });
    }
    
    renderCart();
    updateTotals();
    showNotification(`${product.name} added to cart!`, 'success');
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartItemCount = document.getElementById('cartItemCount');
    
    if (!container) return;
    
    if (cart.length === 0) {
        container.innerHTML = '';
        if (emptyCart) {
            container.appendChild(emptyCart);
            emptyCart.classList.remove('hidden');
        }
        if (cartItemCount) cartItemCount.textContent = '0 items';
        return;
    }
    
    if (emptyCart) emptyCart.classList.add('hidden');
    container.innerHTML = '';
    
    let totalItems = 0;
    
    cart.forEach((item, index) => {
        totalItems += item.quantity;
        const foodTypeColor = item.foodType === 'veg' ? 'bg-green-500' : 'bg-red-500';
        const foodTypeIcon = item.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
        const itemTotal = item.price * item.quantity;
        
        const itemElement = document.createElement('div');
        itemElement.className = 'flex items-center justify-between py-2 border-b last:border-0';
        itemElement.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="relative">
                    <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        ${item.imageUrl ? 
                            `<img src="${item.imageUrl}" alt="${item.name}" class="w-full h-full object-cover rounded-lg">` :
                            `<i class="fas fa-${foodTypeIcon} ${foodTypeColor === 'bg-green-500' ? 'text-green-400' : 'text-red-400'}"></i>`
                        }
                    </div>
                    <div class="absolute -top-1 -right-1 ${foodTypeColor} text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                        <i class="fas fa-${foodTypeIcon} text-[8px]"></i>
                    </div>
                </div>
                <div>
                    <h4 class="font-medium text-sm text-gray-800">${item.name}</h4>
                    <div class="flex items-center space-x-3 text-xs text-gray-500">
                        <span>₹${item.price.toFixed(2)}</span>
                        <div class="flex items-center space-x-1">
                            <button class="decrease-quantity text-gray-500 hover:text-gray-700" data-index="${index}">
                                <i class="fas fa-minus-circle"></i>
                            </button>
                            <span class="font-medium w-6 text-center">${item.quantity}</span>
                            <button class="increase-quantity text-gray-500 hover:text-gray-700" data-index="${index}">
                                <i class="fas fa-plus-circle"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex items-center space-x-3">
                <span class="font-bold text-sm">₹${itemTotal.toFixed(2)}</span>
                <button class="remove-item text-red-400 hover:text-red-600" data-index="${index}">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `;
        container.appendChild(itemElement);
    });
    
    if (cartItemCount) cartItemCount.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
    
    // Add event listeners
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', function() {
            removeFromCart(parseInt(this.dataset.index));
        });
    });
    
    document.querySelectorAll('.increase-quantity').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            cart[index].quantity += 1;
            renderCart();
            updateTotals();
        });
    });
    
    document.querySelectorAll('.decrease-quantity').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            if (cart[index].quantity > 1) {
                cart[index].quantity -= 1;
                renderCart();
                updateTotals();
            } else {
                removeFromCart(index);
            }
        });
    });
}

function removeFromCart(index) {
    const item = cart[index];
    cart.splice(index, 1);
    renderCart();
    updateTotals();
    showNotification(`${item.name} removed from cart`, 'info');
}

function updateTotals() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const gstRate = restaurantSettings.gstRate || 18;
    const serviceRate = restaurantSettings.serviceCharge || 5;
    const currency = restaurantSettings.currency || '₹';
    
    const gstAmount = subtotal * (gstRate / 100);
    const serviceCharge = subtotal * (serviceRate / 100);
    const total = subtotal + gstAmount + serviceCharge;
    
    document.getElementById('subtotal').textContent = `${currency}${subtotal.toFixed(2)}`;
    document.getElementById('gstAmount').textContent = `${currency}${gstAmount.toFixed(2)}`;
    document.getElementById('serviceCharge').textContent = `${currency}${serviceCharge.toFixed(2)}`;
    document.getElementById('totalAmount').textContent = `${currency}${total.toFixed(2)}`;
    
    // Update labels
    document.querySelectorAll('span').forEach(span => {
        if (span.textContent.includes('GST')) {
            span.textContent = `GST (${gstRate}%)`;
        }
        if (span.textContent.includes('Service Charge')) {
            span.textContent = `Service Charge (${serviceRate}%)`;
        }
    });
    
    // Calculate change if cash payment
    if (document.getElementById('paymentMode')?.value === 'cash') {
        calculateChange();
    }
}

function setupPaymentHandlers() {
    const paymentMode = document.getElementById('paymentMode');
    const cashReceived = document.getElementById('cashReceived');
    
    if (paymentMode) {
        paymentMode.addEventListener('change', function() {
            const mode = this.value;
            const cashFields = document.getElementById('cashPaymentFields');
            const nonCashFields = document.getElementById('nonCashPaymentFields');
            
            if (mode === 'cash') {
                cashFields.classList.remove('hidden');
                nonCashFields.classList.add('hidden');
                cashReceived.required = true;
            } else {
                cashFields.classList.add('hidden');
                nonCashFields.classList.remove('hidden');
                cashReceived.required = false;
                document.getElementById('changeAmount').textContent = `${restaurantSettings.currency || '₹'}0.00`;
            }
            cashReceived.value = '';
        });
    }
    
    if (cashReceived) {
        cashReceived.addEventListener('input', calculateChange);
    }
}

function calculateChange() {
    const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
    const totalText = document.getElementById('totalAmount').textContent;
    const currency = restaurantSettings.currency || '₹';
    const total = parseFloat(totalText.replace(currency, '')) || 0;
    
    let change = 0;
    if (cashReceived >= total) {
        change = cashReceived - total;
    }
    
    const changeEl = document.getElementById('changeAmount');
    changeEl.textContent = `${currency}${change.toFixed(2)}`;
    
    if (cashReceived < total) {
        changeEl.classList.remove('text-green-600');
        changeEl.classList.add('text-red-600');
        changeEl.textContent = `${currency}-${(total - cashReceived).toFixed(2)}`;
    } else {
        changeEl.classList.remove('text-red-600');
        changeEl.classList.add('text-green-600');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Table selection change
    const tableSelect = document.getElementById('tableSelect');
    if (tableSelect) {
        tableSelect.addEventListener('change', function() {
            currentTableId = this.value;
            if (currentTableId) {
                const table = tables.find(t => t.id === currentTableId);
                if (table) {
                    showCurrentTableBadge(table.tableNumber);
                }
            } else {
                hideCurrentTableBadge();
            }
        });
    }
    
    // Product search
    const productSearch = document.getElementById('productSearch');
    if (productSearch) {
        productSearch.addEventListener('input', filterProducts);
    }
    
    // Clear cart
    const clearCartBtn = document.getElementById('clearCart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function() {
            if (cart.length === 0) return;
            if (confirm('Clear all items from cart?')) {
                cart = [];
                renderCart();
                updateTotals();
                showNotification('Cart cleared', 'info');
            }
        });
    }
    
    // Save order
    const saveOrderBtn = document.getElementById('saveOrder');
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', async function() {
            await saveOrder(false); // Save without printing
        });
    }
    
    // Print bill
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        printBillBtn.addEventListener('click', async function() {
            await saveOrder(true); // Save and print
        });
    }
    
    // Add table button
    const addTableBtn = document.getElementById('addTableBtn');
    if (addTableBtn) {
        addTableBtn.addEventListener('click', () => {
            document.getElementById('tableId').value = '';
            document.getElementById('tableModalTitle').textContent = 'Add New Table';
            document.getElementById('tableForm').reset();
            document.getElementById('tableModal').classList.remove('hidden');
        });
    }
    
    // Refresh tables
    const refreshTables = document.getElementById('refreshTables');
    if (refreshTables) {
        refreshTables.addEventListener('click', async () => {
            await loadTables();
            await loadActiveOrders();
            renderTableGrid();
            renderActiveOrders();
            updateTableSelect();
            showNotification('Tables refreshed', 'success');
        });
    }
    
    // Table form submission
    const tableForm = document.getElementById('tableForm');
    if (tableForm) {
        tableForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveTable();
        });
    }
}

// Save table
async function saveTable() {
    const user = auth.currentUser;
    const tableId = document.getElementById('tableId').value;
    const tableNumber = document.getElementById('tableNumber').value.trim();
    const capacity = parseInt(document.getElementById('tableCapacity').value);
    const location = document.getElementById('tableLocation').value;
    const status = document.querySelector('input[name="status"]:checked').value;
    
    if (!tableNumber) {
        showNotification('Table number is required', 'error');
        return;
    }
    
    const tableData = {
        tableNumber: tableNumber,
        capacity: capacity,
        location: location,
        status: status,
        restaurantId: user.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (tableId) {
            // Update existing table
            await db.collection('tables').doc(tableId).update(tableData);
            showNotification('Table updated successfully', 'success');
        } else {
            // Create new table
            tableData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('tables').add(tableData);
            showNotification('Table added successfully', 'success');
        }
        
        closeTableModal();
        await loadTables();
        renderTableGrid();
        updateTableSelect();
        
    } catch (error) {
        console.error("Error saving table:", error);
        showNotification('Error saving table: ' + error.message, 'error');
    }
}

// Save order
async function saveOrder(shouldPrint = false) {
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }
    
    const user = auth.currentUser;
    const tableId = document.getElementById('tableSelect').value;
    const paymentMode = document.getElementById('paymentMode').value;
    
    // Validate cash payment
    if (paymentMode === 'cash') {
        const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
        const totalText = document.getElementById('totalAmount').textContent;
        const total = parseFloat(totalText.replace('₹', '')) || 0;
        
        if (cashReceived < total) {
            showNotification('Insufficient cash received', 'error');
            return;
        }
    }
    
    try {
        // Generate order ID
        const orderId = await window.OrderCounter?.getNextOrderId() || `ORD${Date.now()}`;
        
        // Calculate amounts
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gstRate = restaurantSettings.gstRate || 18;
        const serviceRate = restaurantSettings.serviceCharge || 5;
        const gstAmount = subtotal * (gstRate / 100);
        const serviceCharge = subtotal * (serviceRate / 100);
        const total = subtotal + gstAmount + serviceCharge;
        
        // Get table info
        let tableNumber = '';
        if (tableId) {
            const table = tables.find(t => t.id === tableId);
            if (table) {
                tableNumber = table.tableNumber;
            }
        }
        
        const orderData = {
            restaurantId: user.uid,
            tableId: tableId || null,
            tableNumber: tableNumber,
            items: [...cart],
            customerName: document.getElementById('customerName').value || 'Walk-in Customer',
            customerPhone: document.getElementById('customerPhone').value || '',
            customerCount: tableId ? 1 : null,
            subtotal: subtotal,
            gstRate: gstRate,
            gstAmount: gstAmount,
            serviceChargeRate: serviceRate,
            serviceCharge: serviceCharge,
            total: total,
            paymentMode: paymentMode,
            cashReceived: paymentMode === 'cash' ? parseFloat(document.getElementById('cashReceived').value) || 0 : 0,
            changeAmount: paymentMode === 'cash' ? parseFloat(document.getElementById('changeAmount').textContent.replace('₹', '')) || 0 : 0,
            orderId: orderId,
            billNo: orderId,
            isActive: !shouldPrint, // If printing, mark as completed
            status: shouldPrint ? 'completed' : 'saved',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Save to Firestore
        const docRef = await db.collection('orders').add(orderData);
        
        // Update table status if it's a table order
        if (tableId && shouldPrint) {
            await db.collection('tables').doc(tableId).update({
                status: 'available',
                currentOrderId: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        if (shouldPrint) {
            // Generate and print bill
            if (window.prepareReceipt) {
                await window.prepareReceipt();
            }
            
            showNotification('Order completed and bill printed!', 'success');
            
            // Clear cart
            cart = [];
            renderCart();
            updateTotals();
            resetForm();
            
        } else {
            showNotification('Order saved successfully', 'success');
        }
        
        // Refresh active orders
        await loadActiveOrders();
        await loadTables();
        renderActiveOrders();
        renderTableGrid();
        updateTableSelect();
        
    } catch (error) {
        console.error("Error saving order:", error);
        showNotification('Error saving order: ' + error.message, 'error');
    }
}

function resetForm() {
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('tableSelect').value = '';
    document.getElementById('paymentMode').value = 'cash';
    document.getElementById('cashReceived').value = '';
    document.getElementById('changeAmount').textContent = `${restaurantSettings.currency || '₹'}0.00`;
    hideCurrentTableBadge();
    currentTableId = null;
    
    // Reset payment fields
    document.getElementById('cashPaymentFields').classList.remove('hidden');
    document.getElementById('nonCashPaymentFields').classList.add('hidden');
}

// Notification function
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[9999] text-white font-medium ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make functions globally available
window.closeTableModal = closeTableModal;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.generateBillForOrder = generateBillForOrder;
