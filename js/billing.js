let cart = [];
let currentView = 'grid';
let products = [];
let restaurantSettings = {
    gstRate: 0,
    serviceCharge: 0,
    currency: ''
};
let restaurantTables = [];

// Global functions
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error("Product not found in local state:", productId);
        return;
    }

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
            category: product.category
        });
    }

    renderCart();
    updateTotals();
    showNotification(`${product.name} added to cart!`, 'success');
}

// Table Management Functions
function initializeTableManagement() {
    // Load saved tables
    loadTablesFromLocalStorage();
    
    // Initialize TableManager
    if (!window.TableManager) {
        window.TableManager = new TableManager();
    }
    
    renderTables();
    setupTableEventListeners();
}

function renderTables() {
    const container = document.getElementById('tablesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const tables = window.TableManager.getAllTables();
    
    tables.forEach(table => {
        const tableOrder = window.TableManager.getTableOrders(table.id);
        const isActive = window.TableManager.getActiveTable() === table.id;
        
        const tableCard = document.createElement('div');
        tableCard.className = `table-card bg-white rounded-xl shadow p-4 ${isActive ? 'active' : ''} ${table.status}`;
        tableCard.dataset.tableId = table.id;
        
        tableCard.innerHTML = `
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-bold text-lg text-gray-800">${table.name}</h3>
                    <div class="flex items-center space-x-2 mt-1">
                        <span class="table-status ${getStatusClass(table.status)}">
                            ${table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                        </span>
                        <span class="text-sm text-gray-500">
                            <i class="fas fa-users mr-1"></i>${table.capacity}
                        </span>
                    </div>
                </div>
                <div class="table-actions flex space-x-1">
                    ${table.status === 'occupied' ? `
                        <button class="add-order-btn p-1 text-blue-600 hover:text-blue-800" title="Add Order">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                        <button class="view-orders-btn p-1 text-green-600 hover:text-green-800" title="View Orders">
                            <i class="fas fa-eye"></i>
                        </button>
                    ` : ''}
                    <button class="edit-table-btn p-1 text-gray-600 hover:text-gray-800" title="Edit Table">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            
            ${table.status === 'occupied' ? `
                <div class="border-t pt-3">
                    <div class="text-sm text-gray-600">
                        <div class="flex justify-between mb-1">
                            <span>Orders:</span>
                            <span class="font-bold">${tableOrder.orders.length}</span>
                        </div>
                        <div class="flex justify-between mb-1">
                            <span>Items:</span>
                            <span>${tableOrder.orders.reduce((total, order) => total + order.items.length, 0)}</span>
                        </div>
                        <div class="flex justify-between font-bold">
                            <span>Total:</span>
                            <span class="text-red-600">₹${tableOrder.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="mt-4">
                ${table.status === 'available' ? `
                    <button class="occupy-table-btn w-full bg-red-500 text-white py-2 rounded-lg text-sm hover:bg-red-600">
                        <i class="fas fa-chair mr-2"></i>Occupy Table
                    </button>
                ` : table.status === 'occupied' ? `
                    <button class="checkout-table-btn w-full bg-green-500 text-white py-2 rounded-lg text-sm hover:bg-green-600">
                        <i class="fas fa-receipt mr-2"></i>Checkout
                    </button>
                ` : ''}
            </div>
        `;
        
        container.appendChild(tableCard);
    });
    
    updateActiveTableInfo();
}

function getStatusClass(status) {
    switch(status) {
        case 'available': return 'status-available';
        case 'occupied': return 'status-occupied';
        case 'reserved': return 'status-reserved';
        case 'cleaning': return 'status-cleaning';
        default: return 'status-available';
    }
}

function setupTableEventListeners() {
    // Table card click
    document.addEventListener('click', function(e) {
        const tableCard = e.target.closest('.table-card');
        if (tableCard) {
            const tableId = tableCard.dataset.tableId;
            handleTableClick(tableId);
        }
        
        // Occupy table button
        if (e.target.closest('.occupy-table-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            occupyTable(tableId);
        }
        
        // Checkout button
        if (e.target.closest('.checkout-table-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            checkoutTable(tableId);
        }
        
        // Add order button
        if (e.target.closest('.add-order-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            setActiveTable(tableId);
        }
        
        // View orders button
        if (e.target.closest('.view-orders-btn')) {
            const tableCard = e.target.closest('.table-card');
            const tableId = tableCard.dataset.tableId;
            viewTableOrders(tableId);
        }
        
        // Clear active table
        if (e.target.closest('#clearActiveTable')) {
            clearActiveTable();
        }
    });
}

function handleTableClick(tableId) {
    const table = window.TableManager.getTableById(tableId);
    
    if (table.status === 'available') {
        // Show occupy modal
        showOccupyTableModal(table);
    } else if (table.status === 'occupied') {
        // Set as active table
        setActiveTable(tableId);
    }
}

function showOccupyTableModal(table) {
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-md">
                <div class="p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Occupy ${table.name}</h3>
                    <form id="occupyTableForm">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-gray-700 mb-2">Customer Name</label>
                                <input type="text" id="tableCustomerName" 
                                       class="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                       placeholder="Enter customer name">
                            </div>
                            <div>
                                <label class="block text-gray-700 mb-2">Phone Number</label>
                                <input type="tel" id="tableCustomerPhone" 
                                       class="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                       placeholder="Enter phone number">
                            </div>
                            <div>
                                <label class="block text-gray-700 mb-2">Number of Guests</label>
                                <input type="number" id="tableGuests" min="1" max="${table.capacity}"
                                       class="w-full px-4 py-2 border border-gray-300 rounded-lg" 
                                       value="1">
                            </div>
                        </div>
                        <div class="mt-6 flex space-x-3">
                            <button type="submit" 
                                    class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                                Occupy Table
                            </button>
                            <button type="button" onclick="closeModal()"
                                    class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
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
    
    // Add form submit handler
    document.getElementById('occupyTableForm').addEventListener('submit', function(e) {
        e.preventDefault();
        occupyTable(table.id, {
            name: document.getElementById('tableCustomerName').value,
            phone: document.getElementById('tableCustomerPhone').value,
            guests: parseInt(document.getElementById('tableGuests').value)
        });
        closeModal();
    });
}

function closeModal() {
    const modal = document.getElementById('occupyTableModal');
    if (modal) modal.remove();
}

function occupyTable(tableId, customerInfo = null) {
    window.TableManager.markTableOccupied(tableId, customerInfo);
    setActiveTable(tableId);
    renderTables();
    showNotification(`${window.TableManager.getTableById(tableId).name} is now occupied`, 'success');
}

function setActiveTable(tableId) {
    window.TableManager.setActiveTable(tableId);
    renderTables();
    updateActiveTableInfo();
    
    const table = window.TableManager.getTableById(tableId);
    showNotification(`Now taking orders for ${table.name}`, 'info');
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
    showNotification('No active table', 'info');
}

function checkoutTable(tableId) {
    const table = window.TableManager.getTableById(tableId);
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    if (tableOrder.orders.length === 0) {
        showNotification('No orders for this table', 'warning');
        return;
    }
    
    // Set this table as active and load its orders
    setActiveTable(tableId);
    
    // Show checkout modal with bill details
    showCheckoutModal(table, tableOrder);
}

function showCheckoutModal(table, tableOrder) {
    const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div class="bg-white rounded-xl shadow-lg w-full max-w-2xl my-8">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-gray-800">Checkout - ${table.name}</h3>
                        <button onclick="closeCheckoutModal()" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <!-- Customer Info -->
                    ${tableOrder.customer ? `
                        <div class="bg-gray-50 rounded-lg p-4 mb-6">
                            <h4 class="font-bold text-gray-700 mb-2">Customer Details</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p class="text-sm text-gray-500">Name</p>
                                    <p class="font-medium">${tableOrder.customer.name || 'Walk-in Customer'}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-500">Phone</p>
                                    <p class="font-medium">${tableOrder.customer.phone || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Order Groups -->
                    <div class="mb-6">
                        <h4 class="font-bold text-gray-700 mb-3">Order Timeline</h4>
                        <div class="space-y-4">
                            ${tableOrder.orders.map((orderGroup, index) => `
                                <div class="order-group p-4 rounded-lg">
                                    <div class="order-group-header flex justify-between items-center mb-3 pb-2">
                                        <span class="font-bold">Order ${index + 1}</span>
                                        <span class="order-time">
                                            ${new Date(orderGroup.timestamp).toLocaleTimeString('en-IN', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                    <div class="space-y-2">
                                        ${orderGroup.items.map(item => `
                                            <div class="flex justify-between items-center">
                                                <span>${item.name} × ${item.quantity}</span>
                                                <span class="font-bold">₹${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div class="flex justify-between font-bold mt-3 pt-3 border-t">
                                        <span>Subtotal:</span>
                                        <span>₹${orderGroup.subtotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Bill Summary -->
                    <div class="bg-red-50 rounded-lg p-4 mb-6">
                        <h4 class="font-bold text-gray-700 mb-3">Bill Summary</h4>
                        <div class="space-y-2">
                            <div class="flex justify-between">
                                <span>Subtotal:</span>
                                <span>₹${tableOrder.subtotal.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>GST (${restaurantSettings.gstRate}%):</span>
                                <span>₹${tableOrder.gst.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Service Charge (${restaurantSettings.serviceCharge}%):</span>
                                <span>₹${tableOrder.service.toFixed(2)}</span>
                            </div>
                            <div class="flex justify-between text-xl font-bold pt-2 border-t">
                                <span>Total Amount:</span>
                                <span class="text-red-600">₹${tableOrder.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Split Bill Option -->
                    <div class="mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="font-bold text-gray-700">Split Bill</h4>
                            <button id="splitBillBtn" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i class="fas fa-cut mr-1"></i>Split Bill
                            </button>
                        </div>
                        <div id="splitBillOptions" class="hidden space-y-3">
                            <div class="flex space-x-2">
                                <button class="split-option px-3 py-2 border rounded-lg" data-split="2">2 Ways</button>
                                <button class="split-option px-3 py-2 border rounded-lg" data-split="3">3 Ways</button>
                                <button class="split-option px-3 py-2 border rounded-lg" data-split="4">4 Ways</button>
                                <button class="split-option px-3 py-2 border rounded-lg" data-split="custom">Custom</button>
                            </div>
                            <div id="splitBillResult" class="hidden"></div>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div class="flex space-x-3">
                        <button onclick="printTableBill('${table.id}')" 
                                class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                            <i class="fas fa-print mr-2"></i>Print Bill & Close Table
                        </button>
                        <button onclick="closeCheckoutModal()"
                                class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                            Cancel
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
    
    // Setup split bill functionality
    setupSplitBillFunctionality(table.id);
}

function setupSplitBillFunctionality(tableId) {
    const splitBillBtn = document.getElementById('splitBillBtn');
    const splitBillOptions = document.getElementById('splitBillOptions');
    const splitBillResult = document.getElementById('splitBillResult');
    
    if (splitBillBtn) {
        splitBillBtn.addEventListener('click', function() {
            splitBillOptions.classList.toggle('hidden');
        });
    }
    
    document.querySelectorAll('.split-option').forEach(button => {
        button.addEventListener('click', function() {
            const splitWays = this.dataset.split;
            
            if (splitWays === 'custom') {
                const customSplit = prompt('Enter number of ways to split:');
                if (customSplit && !isNaN(customSplit) && customSplit > 0) {
                    calculateSplitBill(tableId, parseInt(customSplit));
                }
            } else {
                calculateSplitBill(tableId, parseInt(splitWays));
            }
        });
    });
}

function calculateSplitBill(tableId, splitWays) {
    const splitAmounts = window.TableManager.splitTableBill(tableId, splitWays);
    const splitBillResult = document.getElementById('splitBillResult');
    
    let resultHTML = `
        <div class="bg-green-50 rounded-lg p-4">
            <h5 class="font-bold text-green-800 mb-2">Split Bill - ${splitWays} Ways</h5>
            <div class="space-y-2">
    `;
    
    splitAmounts.forEach((split, index) => {
        resultHTML += `
            <div class="split-bill-item p-3 rounded">
                <div class="flex justify-between items-center">
                    <span>Person ${split.person}:</span>
                    <span class="font-bold text-green-600">₹${split.amount.toFixed(2)}</span>
                </div>
            </div>
        `;
    });
    
    resultHTML += `
            </div>
            <div class="mt-3 text-sm text-green-700">
                <i class="fas fa-info-circle mr-1"></i>
                Each person pays: ₹${(splitAmounts[0]?.amount || 0).toFixed(2)}
            </div>
        </div>
    `;
    
    splitBillResult.innerHTML = resultHTML;
    splitBillResult.classList.remove('hidden');
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.remove();
}

function printTableBill(tableId) {
    const table = window.TableManager.getTableById(tableId);
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    // Prepare receipt with table information
    const customerName = tableOrder.customer?.name || 'Walk-in Customer';
    const customerPhone = tableOrder.customer?.phone || '';
    
    // Set customer info in billing form
    document.getElementById('customerName').value = customerName;
    document.getElementById('customerPhone').value = customerPhone;
    
    // Load table's cart
    loadCartFromTable(tableId);
    
    // Print the bill
    if (typeof prepareReceipt === 'function') {
        // Add table info to receipt
        const originalPrepareReceipt = window.prepareReceipt;
        
        window.prepareReceipt = function() {
            const tableInfo = `
Table: ${table.name}
Guests: ${tableOrder.customer?.guests || 1}
${'-'.repeat(32)}
`;
            
            // Get the original receipt
            const receipt = originalPrepareReceipt.call(this);
            
            // Add table info at the beginning
            return tableInfo + receipt;
        };
        
        prepareReceipt();
        
        // Restore original function
        window.prepareReceipt = originalPrepareReceipt;
    }
    
    // Clear table after printing
    window.TableManager.clearTableOrder(tableId);
    clearActiveTable();
    renderTables();
    
    closeCheckoutModal();
}

function loadCartFromTable(tableId) {
    const tableOrder = window.TableManager.getTableOrders(tableId);
    
    // Clear current cart
    cart = [];
    
    // Add all items from all orders in the table
    tableOrder.orders.forEach(orderGroup => {
        orderGroup.items.forEach(item => {
            addToCart(item.id); // This will handle quantity
        });
    });
    
    renderCart();
    updateTotals();
}

function viewTableOrders(tableId) {
    setActiveTable(tableId);
}

// Table-aware save order function
function saveTableOrder() {
    if (!window.TableManager.getActiveTable()) {
        showNotification('Please select a table first', 'error');
        return;
    }
    
    if (cart.length === 0) {
        showNotification('Cart is empty', 'error');
        return;
    }
    
    const tableId = window.TableManager.getActiveTable();
    const customerInfo = {
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value
    };
    
    // Add order to table
    const orderGroup = window.TableManager.addOrderToTable(tableId, cart, customerInfo);
    
    showNotification(`Order added to ${window.TableManager.getTableById(tableId).name}`, 'success');
    
    // Clear cart for next order (but keep table active)
    cart = [];
    renderCart();
    updateTotals();
    
    // Update table display
    renderTables();
}

// Table-aware print bill function
function printTableBillFinal() {
    if (!window.TableManager.getActiveTable()) {
        // Use original print function if no table
        if (typeof prepareReceipt === 'function') {
            prepareReceipt();
        }
        return;
    }
    
    const tableId = window.TableManager.getActiveTable();
    printTableBill(tableId);
}

// Product Rendering Functions
function renderProductsInGridView(productsToShow) {
    const container = document.getElementById('productsGrid');
    if (!container) return;
    container.innerHTML = '';

    const currency = restaurantSettings.currency || '₹';

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
        const imageUrl = product.imageUrl || (typeof getProductImage === 'function' ? getProductImage(product.name) : null);
        const foodTypeColor = product.foodType === 'veg' ? 'bg-green-500' : 'bg-red-500';
        const foodTypeIcon = product.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
        
        const card = document.createElement('div');
        card.className = 'compact-card bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer';
        
        card.innerHTML = `
            <div class="h-20 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                ${imageUrl 
                    ? `<img src="${imageUrl}" alt="${product.name}" 
                          class="w-full h-full object-cover product-image"
                          onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : ''
                }
                <div class="w-full h-full flex items-center justify-center ${imageUrl ? 'hidden' : ''}">
                    <i class="fas fa-${foodTypeIcon} ${foodTypeColor === 'bg-green-500' ? 'text-green-400' : 'text-red-400'} text-xl"></i>
                </div>
                
                <!-- Food Type Badge -->
                <div class="absolute top-1 left-1 ${foodTypeColor} text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    <i class="fas fa-${foodTypeIcon} text-xs"></i>
                </div>
                
                <!-- Price Badge -->
                <div class="absolute bottom-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    ₹${Number(product.price || 0).toFixed(0)}
                </div>
            </div>
            <div class="p-2">
                <h3 class="product-name font-medium text-gray-800 mb-1">${product.name}</h3>
                <div class="flex items-center justify-between mb-1">
                    <span class="product-category text-xs text-gray-500">${product.category}</span>
                    <span class="quantity-type text-xs font-medium text-gray-700">
                        ${product.baseQuantity || 1} ${product.quantityType || 'plate'}
                    </span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-xs text-gray-600">
                        ${product.description ? product.description.substring(0, 15) + '...' : ''}
                    </span>
                    <button class="add-to-cart bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition" 
                            data-id="${product.id}"
                            title="Add to cart">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
        
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.add-to-cart')) {
                addToCart(product.id);
            }
        });
        
        container.appendChild(card);
    });
    
    // Add event listeners
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            addToCart(this.dataset.id);
        });
    });
}

function renderProductsInListView(productsToShow) {
    const container = document.getElementById('productsList');
    if (!container) return;
    container.innerHTML = '';

    const currency = restaurantSettings.currency || '₹';

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
        const imageUrl = product.imageUrl || (typeof getProductImage === 'function' ? getProductImage(product.name) : null);
        const foodTypeColor = product.foodType === 'veg' ? 'bg-green-500' : 'bg-red-500';
        const foodTypeIcon = product.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
        
        const listItem = document.createElement('div');
        listItem.className = 'list-item bg-white';
        
        listItem.innerHTML = `
            <div class="flex-shrink-0 relative">
                ${imageUrl 
                    ? `<img src="${imageUrl}" alt="${product.name}" 
                          class="list-image"
                          onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : ''
                }
                <div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center ${imageUrl ? 'hidden' : ''}">
                    <i class="fas fa-${foodTypeIcon} ${foodTypeColor === 'bg-green-500' ? 'text-green-400' : 'text-red-400'}"></i>
                </div>
                <div class="absolute -top-1 -right-1 ${foodTypeColor} text-white text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    <i class="fas fa-${foodTypeIcon} text-xs"></i>
                </div>
            </div>
            <div class="list-details">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="list-name">${product.name}</h4>
                        <div class="flex items-center space-x-2 mt-1">
                            <span class="list-category">${product.category}</span>
                            <span class="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                ${product.baseQuantity || 1} ${product.quantityType || 'plate'}
                            </span>
                        </div>
                    </div>
                    <span class="list-price">${currency}${Number(product.price || 0).toFixed(2)}</span>
                </div>
                ${product.description ? `<p class="list-description">${product.description}</p>` : ''}
            </div>
            <button class="add-to-cart-list bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center ml-2 hover:bg-red-600 transition" 
                    data-id="${product.id}"
                    title="Add to cart">
                <i class="fas fa-plus text-xs"></i>
            </button>
        `;
        
        listItem.addEventListener('click', (e) => {
            if (!e.target.closest('.add-to-cart-list')) {
                addToCart(product.id);
            }
        });
        
        container.appendChild(listItem);
    });
    
    document.querySelectorAll('.add-to-cart-list').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            addToCart(this.dataset.id);
        });
    });
}

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
            
            // Re-render products in grid view
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
            
            renderProductsInGridView(filtered);
        }
    });
    
    listViewBtn.addEventListener('click', () => {
        if (currentView === 'grid') {
            currentView = 'list';
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            productsList.classList.remove('hidden');
            productsGrid.classList.add('hidden');
            
            // Re-render products in list view
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
            
            renderProductsInListView(filtered);
        }
    });
}

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white text-sm font-medium`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        n.style.transform = 'translateX(20px)';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}

// Main DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', function() {
    // Check auth
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadRestaurantSettings();
            loadProducts();
            setupViewToggle();
            setupPaymentHandlers();
            initializeTableManagement(); // Initialize table management
        }
    });

    // Load restaurant settings from Firestore
    function loadRestaurantSettings() {
        const user = auth.currentUser;
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const fetchedSettings = data.settings || {};
                    
                    restaurantSettings = {
                        gstRate: Number(fetchedSettings.gstRate) || 0,
                        serviceCharge: Number(fetchedSettings.serviceCharge) || 0,
                        currency: fetchedSettings.currency || '₹'
                    };
                    
                    if (data.name) {
                        const navName = document.getElementById('restaurantName');
                        if (navName) navName.textContent = data.name;
                    }

                    renderCart();
                    updateTotals();
                    setupPaymentHandlers();
                } else {
                    showNotification('Please configure your settings first.', 'info');
                    setTimeout(() => {
                        window.location.href = 'settings.html';
                    }, 2000);
                }
            })
            .catch(err => {
                console.error("Error loading settings:", err);
                updateTotals();
                setupPaymentHandlers();
            });
    }

    function isOnline() {
        return navigator.onLine;
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
                    document.getElementById('changeAmount').textContent = `${restaurantSettings.currency}0.00`;
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
        const currency = restaurantSettings.currency || '';
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
            changeEl.textContent = `${currency}${(cashReceived - total).toFixed(2)}`;
        } else {
            changeEl.classList.remove('text-red-600');
            changeEl.classList.add('text-green-600');
        }
    }

    async function saveOrderToFirebase(orderData) {
        try {
            // Generate sequential order ID
            const orderId = await window.OrderCounter.getNextOrderId();
            orderData.orderId = orderId;
            orderData.billNo = orderId;
            
            const docRef = await db.collection('orders').add(orderData);
            return { success: true, id: docRef.id, orderId: orderId };
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    }

    function loadProducts() {
        const user = auth.currentUser;
        if (!user) return;

        if (isOnline()) {
            db.collection('products')
                .where('restaurantId', '==', user.uid)
                .get()
                .then(snapshot => {
                    const productsData = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        productsData.push({ 
                            id: doc.id, 
                            name: data.name,
                            price: data.price,
                            category: data.category,
                            description: data.description,
                            imageUrl: data.imageUrl,
                            ...data 
                        });
                    });
                    
                    products = productsData;
                    
                    localStorage.setItem('cachedProducts', JSON.stringify(productsData));
                    
                    const categories = [...new Set(productsData.map(p => p.category))];
                    renderCategories(categories);
                    renderProducts(productsData);
                })
                .catch(err => {
                    console.error("Firestore product load failed:", err);
                    const cached = JSON.parse(localStorage.getItem('cachedProducts')) || [];
                    products = cached;
                    renderProducts(cached);
                });
        } else {
            const cached = JSON.parse(localStorage.getItem('cachedProducts')) || [];
            products = cached;
            renderProducts(cached);
        }
    }
    
    function renderCategories(categories) {
        const container = document.querySelector('.category-tab')?.parentElement;
        if (!container) return;
        
        container.innerHTML = `
            <button class="category-tab active px-4 py-2 bg-red-500 text-white rounded-lg whitespace-nowrap" data-category="all">All Items</button>
        `;

        categories.forEach(category => {
            if (category && category !== 'all') {
                container.innerHTML += `
                    <button class="category-tab px-4 py-2 bg-gray-100 text-gray-700 rounded-lg whitespace-nowrap hover:bg-gray-200" data-category="${category}">
                        ${category}
                    </button>
                `;
            }
        });

        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.category-tab').forEach(t => {
                    t.classList.remove('active', 'bg-red-50', 'text-white');
                    t.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                });
                
                this.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                this.classList.add('active', 'bg-red-50', 'text-white');
                
                filterProducts(this.dataset.category);
            });
        });
    }

    function filterProducts(category) {
        const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
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

    function renderProducts(productsToShow) {
        if (currentView === 'grid') {
            renderProductsInGridView(productsToShow);
        } else {
            renderProductsInListView(productsToShow);
        }
    }
    
    function renderCart() {
        const container = document.getElementById('cartItems');
        const emptyCart = document.getElementById('emptyCart');
        if (!container) return;

        if (cart.length === 0) {
            container.innerHTML = '';
            if (emptyCart) {
                container.appendChild(emptyCart);
                emptyCart.classList.remove('hidden');
            }
            return;
        }

        if (emptyCart) emptyCart.classList.add('hidden');
        container.innerHTML = '';

        const currency = restaurantSettings.currency || '₹';

        cart.forEach((item, index) => {
            const productDetails = products.find(p => p.id === item.id);
            const imageUrl = productDetails?.imageUrl || (typeof getProductImage === 'function' ? getProductImage(item.name) : null);
            const foodTypeColor = productDetails?.foodType === 'veg' ? 'bg-green-500' : 'bg-red-500';
            const foodTypeIcon = productDetails?.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
            
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
            
            const itemElement = document.createElement('div');
            itemElement.className = 'flex items-center justify-between py-2 border-b last:border-0';
            itemElement.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                            ${imageUrl 
                                ? `<img src="${imageUrl}" alt="${item.name}" 
                                      class="w-full h-full object-cover"
                                      onerror="this.onerror=null; this.outerHTML='<i class=\'fas fa-utensils text-gray-400\'></i>'">`
                                : `<i class="fas fa-${foodTypeIcon} ${foodTypeColor === 'bg-green-500' ? 'text-green-400' : 'text-red-400'}"></i>`
                            }
                        </div>
                        <div class="absolute -top-1 -right-1 ${foodTypeColor} text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                            <i class="fas fa-${foodTypeIcon} text-[8px]"></i>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-medium text-sm text-gray-800">${item.name}</h4>
                        <div class="flex items-center space-x-2 text-xs text-gray-500">
                            <span>${productDetails?.baseQuantity || 1} ${productDetails?.quantityType || 'plate'}</span>
                            <span>•</span>
                            <span>${currency}${Number(item.price || 0).toFixed(2)} × ${item.quantity}</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-3">
                    <span class="font-bold text-sm">${currency}${itemTotal.toFixed(2)}</span>
                    <button class="remove-item text-red-400 hover:text-red-600 p-1" data-index="${index}">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            `;
            container.appendChild(itemElement);
        });

        document.querySelectorAll('.remove-item').forEach(button => {
            button.addEventListener('click', function() {
                removeFromCart(parseInt(this.dataset.index));
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
        const subtotalElem = document.getElementById('subtotal');
        if (!subtotalElem) return;

        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
        
        const gstRate = Number(restaurantSettings.gstRate) || 0;
        const serviceRate = Number(restaurantSettings.serviceCharge) || 0;
        const currency = restaurantSettings.currency || '₹';

        const gstAmount = subtotal * (gstRate / 100);
        const serviceCharge = subtotal * (serviceRate / 100);
        const total = subtotal + gstAmount + serviceCharge;

        subtotalElem.textContent = `${currency}${subtotal.toFixed(2)}`;
        document.getElementById('gstAmount').textContent = `${currency}${gstAmount.toFixed(2)}`;
        document.getElementById('serviceCharge').textContent = `${currency}${serviceCharge.toFixed(2)}`;
        document.getElementById('totalAmount').textContent = `${currency}${total.toFixed(2)}`;
        
        const allSpans = document.querySelectorAll('span');
        
        allSpans.forEach(span => {
            if (span.textContent.includes('GST')) {
                span.textContent = `GST (${gstRate}%)`;
            }
            if (span.textContent.includes('Service Charge')) {
                span.textContent = `Service Charge (${serviceRate}%)`;
            }
        });
        
        if (document.getElementById('paymentMode')?.value === 'cash') {
            calculateChange();
        }
    }

    const clearCartBtn = document.getElementById('clearCart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function() {
            if (cart.length === 0) return;
            if (confirm('Clear all items?')) {
                cart = [];
                renderCart();
                updateTotals();
                showNotification('Cart cleared', 'info');
            }
        });
    }

    // Update save order button to use table-aware function
    const saveOrderBtn = document.getElementById('saveOrder');
    if (saveOrderBtn) {
        saveOrderBtn.removeEventListener('click', saveTableOrder); // Remove old listener if exists
        saveOrderBtn.addEventListener('click', saveTableOrder); // Add table-aware listener
    }
    
    // Update print bill button to use table-aware function
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        printBillBtn.removeEventListener('click', printTableBillFinal); // Remove old listener if exists
        printBillBtn.addEventListener('click', printTableBillFinal); // Add table-aware listener
    }
    
    const productSearchInput = document.getElementById('productSearch');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', function() {
            const activeTab = document.querySelector('.category-tab.active');
            filterProducts(activeTab ? activeTab.dataset.category : 'all');
        });
    }

    window.renderCart = renderCart;
    window.updateTotals = updateTotals;
    window.saveTableOrder = saveTableOrder;
    window.printTableBillFinal = printTableBillFinal;
    window.printTableBill = printTableBill;
    window.closeCheckoutModal = closeCheckoutModal;
    window.loadCartFromTable = loadCartFromTable;
});
