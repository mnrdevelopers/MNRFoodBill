// js/tables.js - Table Management System
document.addEventListener('DOMContentLoaded', function() {
    let tables = [];
    let activeOrders = [];
    let quickOrderCart = [];
    let selectedTableId = null;
    let products = [];

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadTables();
            loadActiveOrders();
            setupEventListeners();
        }
    });

    // Load all tables
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
            
            renderTableGrid();
        } catch (error) {
            console.error("Error loading tables:", error);
            showNotification('Failed to load tables', 'error');
        }
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
            document.getElementById('setupTables')?.addEventListener('click', () => {
                document.getElementById('addTableBtn').click();
            });
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
        document.querySelectorAll('.take-order-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const tableId = this.closest('.table-card').dataset.tableId;
                startNewOrder(tableId);
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
                addMoreToOrder(tableId);
            });
        });

        // Table card click
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
            
            renderActiveOrders();
        } catch (error) {
            console.error("Error loading active orders:", error);
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
                        <button class="view-active-order text-blue-500 hover:text-blue-700" data-id="${order.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="add-to-active-order text-green-500 hover:text-green-700" data-id="${order.id}">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="close-active-order text-red-500 hover:text-red-700" data-id="${order.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.view-active-order').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderId = this.dataset.id;
                viewOrderDetails(orderId);
            });
        });

        document.querySelectorAll('.add-to-active-order').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderId = this.dataset.id;
                addMoreToActiveOrder(orderId);
            });
        });

        document.querySelectorAll('.close-active-order').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderId = this.dataset.id;
                closeOrderAndGenerateBill(orderId);
            });
        });
    }

    // Start new order for a table
    async function startNewOrder(tableId) {
        const table = tables.find(t => t.id === tableId);
        if (!table) return;
        
        // Update table status to occupied
        try {
            await db.collection('tables').doc(tableId).update({
                status: 'occupied',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Open quick order modal with this table pre-selected
            selectedTableId = tableId;
            openQuickOrderModal(table);
            
            showNotification(`Order started for ${table.tableNumber}`, 'success');
            loadTables(); // Refresh table grid
        } catch (error) {
            showNotification('Error starting order: ' + error.message, 'error');
        }
    }

    // Open quick order modal
    async function openQuickOrderModal(table = null) {
        const modal = document.getElementById('quickOrderModal');
        if (!modal) return;
        
        // Reset quick order
        quickOrderCart = [];
        renderQuickCart();
        
        // Load available tables
        await loadAvailableTables();
        
        // Load products
        await loadProductsForQuickOrder();
        
        if (table) {
            // Pre-select this table
            document.querySelectorAll('.table-select-btn').forEach(btn => {
                btn.classList.remove('bg-red-500', 'text-white');
                btn.classList.add('bg-gray-100', 'text-gray-700');
                if (btn.dataset.tableId === table.id) {
                    btn.classList.remove('bg-gray-100', 'text-gray-700');
                    btn.classList.add('bg-red-500', 'text-white');
                    selectedTableId = table.id;
                }
            });
            
            // Set customer count from table
            document.getElementById('quickCustomerCount').value = table.customerCount || 2;
        }
        
        modal.classList.remove('hidden');
    }

    // Load available tables for quick order
    async function loadAvailableTables() {
        const user = auth.currentUser;
        try {
            const snapshot = await db.collection('tables')
                .where('restaurantId', '==', user.uid)
                .where('status', 'in', ['available', 'occupied'])
                .orderBy('tableNumber')
                .get();
            
            const grid = document.getElementById('availableTablesGrid');
            if (!grid) return;
            
            grid.innerHTML = '';
            
            snapshot.forEach(doc => {
                const table = { id: doc.id, ...doc.data() };
                const isOccupied = table.status === 'occupied';
                const isSelected = table.id === selectedTableId;
                
                const tableBtn = document.createElement('button');
                tableBtn.type = 'button';
                tableBtn.className = `table-select-btn p-3 rounded-lg text-center ${isSelected ? 'bg-red-500 text-white' : isOccupied ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`;
                tableBtn.dataset.tableId = table.id;
                tableBtn.innerHTML = `
                    <div class="font-bold">${table.tableNumber}</div>
                    <div class="text-xs">${isOccupied ? 'Occupied' : 'Available'}</div>
                    ${isOccupied ? '<div class="text-xs mt-1"><i class="fas fa-users"></i> Has active order</div>' : ''}
                `;
                
                tableBtn.addEventListener('click', function() {
                    // Deselect all
                    document.querySelectorAll('.table-select-btn').forEach(btn => {
                        btn.classList.remove('bg-red-500', 'text-white');
                        btn.classList.add(isOccupied ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100', 'text-gray-700');
                    });
                    
                    // Select this one
                    this.classList.remove('bg-yellow-100', 'bg-gray-100', 'text-yellow-700', 'text-gray-700');
                    this.classList.add('bg-red-500', 'text-white');
                    selectedTableId = table.id;
                    
                    // If table is occupied, load its current order
                    if (isOccupied) {
                        loadExistingOrderForTable(table.id);
                    }
                });
                
                grid.appendChild(tableBtn);
            });
        } catch (error) {
            console.error("Error loading available tables:", error);
        }
    }

    // Load products for quick order
    async function loadProductsForQuickOrder() {
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
            
            renderQuickProducts();
        } catch (error) {
            console.error("Error loading products:", error);
        }
    }

    // Render products in quick order
    function renderQuickProducts(filter = '') {
        const grid = document.getElementById('quickProductsGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        let filteredProducts = products;
        if (filter) {
            const searchTerm = filter.toLowerCase();
            filteredProducts = products.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.category.toLowerCase().includes(searchTerm)
            );
        }
        
        if (filteredProducts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-2 text-center py-8 text-gray-500">
                    <i class="fas fa-search text-xl mb-2"></i>
                    <p>No products found</p>
                </div>
            `;
            return;
        }
        
        filteredProducts.forEach(product => {
            const foodTypeIcon = product.foodType === 'veg' ? 'leaf text-green-500' : 'drumstick-bite text-red-500';
            const inCart = quickOrderCart.find(item => item.id === product.id);
            
            const productCard = document.createElement('div');
            productCard.className = `product-card bg-white border rounded-lg p-3 cursor-pointer hover:bg-gray-50 ${inCart ? 'border-red-300 bg-red-50' : ''}`;
            productCard.dataset.productId = product.id;
            
            productCard.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-medium text-gray-800 text-sm">${product.name}</div>
                        <div class="text-xs text-gray-500">${product.category}</div>
                    </div>
                    <i class="fas fa-${foodTypeIcon} text-xs"></i>
                </div>
                <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-800">₹${(product.price || 0).toFixed(2)}</span>
                    <button class="add-to-quick-cart ${inCart ? 'bg-red-500' : 'bg-gray-200'} text-white text-xs px-2 py-1 rounded">
                        ${inCart ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'}
                    </button>
                </div>
            `;
            
            grid.appendChild(productCard);
        });
        
        // Add event listeners
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', function(e) {
                if (!e.target.closest('.add-to-quick-cart')) {
                    const productId = this.dataset.productId;
                    toggleProductInQuickCart(productId);
                }
            });
        });
        
        document.querySelectorAll('.add-to-quick-cart').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const productId = this.closest('.product-card').dataset.productId;
                toggleProductInQuickCart(productId);
            });
        });
    }

    // Toggle product in quick cart
    function toggleProductInQuickCart(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;
        
        const existingItem = quickOrderCart.find(item => item.id === productId);
        
        if (existingItem) {
            // Remove from cart
            quickOrderCart = quickOrderCart.filter(item => item.id !== productId);
        } else {
            // Add to cart
            quickOrderCart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                quantity: 1,
                category: product.category
            });
        }
        
        renderQuickCart();
        renderQuickProducts(document.getElementById('quickProductSearch')?.value || '');
    }

    // Render quick cart
   function renderQuickCart() {
    const container = document.getElementById('quickCartItems');
    const subtotalEl = document.getElementById('quickSubtotal');
    
    if (!container) return;
    
    if (quickOrderCart.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-4">
                <i class="fas fa-shopping-cart"></i>
                <p class="text-sm">No items selected</p>
            </div>
        `;
        if (subtotalEl) subtotalEl.textContent = '₹0.00';
        return;
    }
    
    let subtotal = 0;
    container.innerHTML = '';
    
    quickOrderCart.forEach((item, index) => {
        const itemPrice = parseFloat(item.price) || 0;
        const itemQuantity = parseInt(item.quantity) || 1;
        const itemTotal = itemPrice * itemQuantity;
        subtotal += itemTotal;
        
        const itemEl = document.createElement('div');
        itemEl.className = 'flex justify-between items-center bg-gray-50 p-2 rounded mb-2';
        itemEl.innerHTML = `
            <div class="flex-1">
                <div class="text-sm font-medium">${item.name}</div>
                <div class="text-xs text-gray-500">${item.category || ''}</div>
            </div>
            <div class="flex items-center space-x-3 ml-4">
                <button class="decrease-qty text-gray-500 hover:text-gray-700" data-index="${index}">
                    <i class="fas fa-minus-circle"></i>
                </button>
                <span class="font-medium w-8 text-center">${itemQuantity}</span>
                <button class="increase-qty text-gray-500 hover:text-gray-700" data-index="${index}">
                    <i class="fas fa-plus-circle"></i>
                </button>
                <span class="font-bold w-20 text-right">₹${itemTotal.toFixed(2)}</span>
                <button class="remove-quick-item text-red-400 hover:text-red-600" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.appendChild(itemEl);
    });
    
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    
    // Add event listeners
    document.querySelectorAll('.remove-quick-item').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.dataset.index);
            quickOrderCart.splice(index, 1);
            renderQuickCart();
            renderQuickProducts(document.getElementById('quickProductSearch')?.value || '');
        });
    });
    
    document.querySelectorAll('.increase-qty').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.dataset.index);
            if (quickOrderCart[index]) {
                quickOrderCart[index].quantity = (parseInt(quickOrderCart[index].quantity) || 1) + 1;
                renderQuickCart();
            }
        });
    });
    
    document.querySelectorAll('.decrease-qty').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const index = parseInt(this.dataset.index);
            if (quickOrderCart[index] && quickOrderCart[index].quantity > 1) {
                quickOrderCart[index].quantity = (parseInt(quickOrderCart[index].quantity) || 1) - 1;
                renderQuickCart();
            }
        });
    });
}
    
    // Save quick order
    async function saveQuickOrder() {
    if (!selectedTableId) {
        showNotification('Please select a table', 'error');
        return;
    }
    
    if (quickOrderCart.length === 0) {
        showNotification('Please add at least one item', 'error');
        return;
    }
    
    const user = auth.currentUser;
    const table = tables.find(t => t.id === selectedTableId);
    if (!table) return;
    
    const customerName = document.getElementById('quickCustomerName').value.trim() || 'Walk-in Customer';
    const customerCount = parseInt(document.getElementById('quickCustomerCount').value) || 2;
    
    // Calculate amounts
    const subtotal = quickOrderCart.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 1;
        return sum + (price * quantity);
    }, 0);
    
    // Get restaurant settings for tax calculation
    let gstRate = 18;
    let serviceRate = 5;
    
    try {
        const resDoc = await db.collection('restaurants').doc(user.uid).get();
        if (resDoc.exists) {
            const settings = resDoc.data().settings || {};
            gstRate = parseFloat(settings.gstRate) || 18;
            serviceRate = parseFloat(settings.serviceCharge) || 5;
        }
    } catch (error) {
        console.error("Error loading restaurant settings:", error);
    }
    
    const gstAmount = subtotal * (gstRate / 100);
    const serviceCharge = subtotal * (serviceRate / 100);
    const total = subtotal + gstAmount + serviceCharge;
    
    // Check if table already has an active order
    let existingOrder = null;
    const activeOrder = activeOrders.find(o => o.tableId === selectedTableId && o.isActive);
    
    try {
        let orderId;
        let sessionId;
        
        if (activeOrder) {
            // Add to existing order
            orderId = activeOrder.id;
            sessionId = activeOrder.sessionId;
            
            // Merge items
            const existingItems = activeOrder.items || [];
            const updatedItems = [...existingItems];
            
            quickOrderCart.forEach(newItem => {
                const existingItemIndex = updatedItems.findIndex(item => item.id === newItem.id);
                if (existingItemIndex > -1) {
                    // Update quantity
                    updatedItems[existingItemIndex].quantity = 
                        (parseInt(updatedItems[existingItemIndex].quantity) || 0) + 
                        (parseInt(newItem.quantity) || 1);
                } else {
                    // Add new item
                    updatedItems.push({
                        ...newItem,
                        quantity: parseInt(newItem.quantity) || 1
                    });
                }
            });
            
            // Recalculate totals
            const updatedSubtotal = updatedItems.reduce((sum, item) => {
                const price = parseFloat(item.price) || 0;
                const quantity = parseInt(item.quantity) || 1;
                return sum + (price * quantity);
            }, 0);
            
            const updatedGstAmount = updatedSubtotal * (gstRate / 100);
            const updatedServiceCharge = updatedSubtotal * (serviceRate / 100);
            const updatedTotal = updatedSubtotal + updatedGstAmount + updatedServiceCharge;
            
            // Update order
            await db.collection('orders').doc(orderId).update({
                items: updatedItems,
                subtotal: updatedSubtotal,
                gstRate: gstRate,
                gstAmount: updatedGstAmount,
                serviceChargeRate: serviceRate,
                serviceCharge: updatedServiceCharge,
                total: updatedTotal,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification(`Added items to order at ${table.tableNumber}`, 'success');
            
        } else {
            // Create new order
            sessionId = 'session_' + Date.now();
            orderId = await generateOrderId();
            
            const orderData = {
                restaurantId: user.uid,
                tableId: selectedTableId,
                tableNumber: table.tableNumber,
                items: quickOrderCart.map(item => ({
                    ...item,
                    quantity: parseInt(item.quantity) || 1
                })),
                customerName: customerName,
                customerCount: customerCount,
                subtotal: subtotal,
                gstRate: gstRate,
                gstAmount: gstAmount,
                serviceChargeRate: serviceRate,
                serviceCharge: serviceCharge,
                total: total,
                orderId: orderId,
                billNo: orderId,
                sessionId: sessionId,
                isActive: true,
                status: 'active',
                paymentMode: 'cash', // Default
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Update table status
            await db.collection('tables').doc(selectedTableId).update({
                status: 'occupied',
                customerCount: customerCount,
                currentOrderId: orderId,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Save order
            await db.collection('orders').add(orderData);
            
            showNotification(`Order created for ${table.tableNumber}`, 'success');
        }
        
        // Close modal and refresh
        closeQuickOrderModal();
        loadTables();
        loadActiveOrders();
        
    } catch (error) {
        console.error("Error saving order:", error);
        showNotification('Error saving order: ' + error.message, 'error');
    }
}

    // Generate order ID
    async function generateOrderId() {
        const user = auth.currentUser;
        const today = new Date();
        const dateStr = today.getFullYear().toString().substr(-2) + 
                       (today.getMonth() + 1).toString().padStart(2, '0') + 
                       today.getDate().toString().padStart(2, '0');
        
        // Get today's order count
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));
        
        try {
            const snapshot = await db.collection('orders')
                .where('restaurantId', '==', user.uid)
                .where('createdAt', '>=', startOfDay)
                .where('createdAt', '<=', endOfDay)
                .get();
            
            const orderCount = snapshot.size + 1;
            return `ORD${dateStr}${orderCount.toString().padStart(3, '0')}`;
        } catch (error) {
            // Fallback
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            return `ORD${dateStr}${random}`;
        }
    }

    // View table order
    async function viewTableOrder(tableId) {
        const table = tables.find(t => t.id === tableId);
        if (!table) return;
        
        try {
            // Find active order for this table
            const snapshot = await db.collection('orders')
                .where('restaurantId', '==', auth.currentUser.uid)
                .where('tableId', '==', tableId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const order = snapshot.docs[0];
                viewOrderDetails(order.id);
            } else {
                showNotification(`No active order for ${table.tableNumber}`, 'info');
            }
        } catch (error) {
            console.error("Error viewing table order:", error);
        }
    }

    // Add more to existing order
    function addMoreToOrder(tableId) {
        const table = tables.find(t => t.id === tableId);
        if (table) {
            selectedTableId = tableId;
            openQuickOrderModal(table);
        }
    }

    // Add more to active order
    function addMoreToActiveOrder(orderId) {
        const order = activeOrders.find(o => o.id === orderId);
        if (order && order.tableId) {
            const table = tables.find(t => t.id === order.tableId);
            if (table) {
                selectedTableId = order.tableId;
                openQuickOrderModal(table);
            }
        }
    }

    // View order details
    async function viewOrderDetails(orderId) {
        try {
            const orderDoc = await db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) return;
            
            const order = { id: orderDoc.id, ...orderDoc.data() };
            
            // Create modal to show order details
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
                    <div class="p-6 border-b">
                        <div class="flex justify-between items-center">
                            <h3 class="text-xl font-bold text-gray-800">Order Details</h3>
                            <button class="close-order-modal text-gray-400 hover:text-gray-600">
                                <i class="fas fa-times text-xl"></i>
                            </button>
                        </div>
                        <div class="mt-2 text-sm text-gray-600">
                            Table: <span class="font-bold">${order.tableNumber}</span> | 
                            Order ID: <span class="font-mono">${order.orderId}</span> |
                            Customer: <span class="font-medium">${order.customerName}</span>
                        </div>
                    </div>
                    <div class="p-6 overflow-y-auto max-h-[60vh]">
                        <h4 class="font-bold text-gray-700 mb-3">Order Items</h4>
                        <div class="space-y-3">
                            ${order.items ? order.items.map((item, index) => `
                                <div class="flex justify-between items-center bg-gray-50 p-3 rounded">
                                    <div>
                                        <div class="font-medium">${item.name}</div>
                                        <div class="text-sm text-gray-500">₹${item.price.toFixed(2)} × ${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}</div>
                                    </div>
                                    <span class="font-bold">₹${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            `).join('') : '<p class="text-gray-500">No items</p>'}
                        </div>
                        
                        <div class="mt-6 border-t pt-4">
                            <div class="flex justify-between mb-2">
                                <span>Subtotal:</span>
                                <span class="font-bold">₹${order.subtotal ? order.subtotal.toFixed(2) : '0.00'}</span>
                            </div>
                            <div class="flex justify-between mb-2">
                                <span>GST (18%):</span>
                                <span>₹${order.gstAmount ? order.gstAmount.toFixed(2) : '0.00'}</span>
                            </div>
                            <div class="flex justify-between mb-4">
                                <span>Service Charge (5%):</span>
                                <span>₹${order.serviceCharge ? order.serviceCharge.toFixed(2) : '0.00'}</span>
                            </div>
                            <div class="flex justify-between text-xl font-bold border-t pt-4">
                                <span>Total:</span>
                                <span>₹${order.total ? order.total.toFixed(2) : '0.00'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="p-6 border-t bg-gray-50">
                        <div class="flex space-x-3">
                            <button class="add-more-items flex-1 bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600">
                                <i class="fas fa-plus mr-2"></i> Add More Items
                            </button>
                            <button class="generate-bill flex-1 bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600">
                                <i class="fas fa-file-invoice-dollar mr-2"></i> Generate Bill
                            </button>
                            <button class="close-order flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                                <i class="fas fa-times mr-2"></i> Close Order
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add event listeners
            modal.querySelector('.close-order-modal').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.querySelector('.add-more-items').addEventListener('click', () => {
                modal.remove();
                addMoreToOrder(order.tableId);
            });
            
            modal.querySelector('.generate-bill').addEventListener('click', () => {
                modal.remove();
                generateBillForOrder(order.id);
            });
            
            modal.querySelector('.close-order').addEventListener('click', () => {
                if (confirm('Close this order and generate bill?')) {
                    modal.remove();
                    closeOrderAndGenerateBill(order.id);
                }
            });
            
        } catch (error) {
            console.error("Error viewing order details:", error);
            showNotification('Error loading order details', 'error');
        }
    }

   // Generate bill for order
async function generateBillForOrder(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) return;
        
        const order = orderDoc.data();
        
        // Show printing notification
        showNotification('Preparing bill for printing...', 'info');
        
        // Check if the function exists
        if (typeof window.prepareReceiptForTableOrder === 'function') {
            // Use the print function
            await window.prepareReceiptForTableOrder(orderId, order.tableId);
        } else if (typeof window.generateBill === 'function') {
            // Use fallback function
            await window.generateBill(orderId, order.tableId);
        } else {
            // Direct print implementation as fallback
            await directPrintOrderBill(orderId, order.tableId);
        }
        
    } catch (error) {
        console.error("Error generating bill:", error);
        showNotification('Error generating bill: ' + error.message, 'error');
    }
}

    
  // Close order and generate bill
async function closeOrderAndGenerateBill(orderId) {
    try {
        const orderDoc = await db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) return;
        
        const order = orderDoc.data();
        
        // Generate bill first
        showNotification('Generating bill...', 'info');
        
        // Use the print function
        if (window.prepareReceiptForTableOrder) {
            await window.prepareReceiptForTableOrder(orderId, order.tableId);
            
            // Then update order and table status
            setTimeout(async () => {
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
                loadTables();
                loadActiveOrders();
            }, 2000); // Give time for printing
        }
        
    } catch (error) {
        console.error("Error closing order:", error);
        showNotification('Error: ' + error.message, 'error');
    }
}

    // Setup event listeners
    function setupEventListeners() {
        // Add table button
        document.getElementById('addTableBtn')?.addEventListener('click', () => {
            openTableModal();
        });
        
        // Quick order button
        document.getElementById('quickOrderBtn')?.addEventListener('click', () => {
            openQuickOrderModal();
        });
        
        // Save quick order
        document.getElementById('saveQuickOrder')?.addEventListener('click', (e) => {
            e.preventDefault();
            saveQuickOrder();
        });
        
        // Quick product search
        document.getElementById('quickProductSearch')?.addEventListener('input', function() {
            renderQuickProducts(this.value);
        });
        
        // Table form submission
        document.getElementById('tableForm')?.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveTable();
        });
    }

    // Open table modal
    function openTableModal(table = null) {
        const modal = document.getElementById('tableModal');
        const form = document.getElementById('tableForm');
        const title = document.getElementById('tableModalTitle');
        
        if (!modal || !form) return;
        
        form.reset();
        
        if (table) {
            title.textContent = 'Edit Table';
            document.getElementById('tableId').value = table.id;
            document.getElementById('tableNumber').value = table.tableNumber;
            document.getElementById('tableCapacity').value = table.capacity || 4;
            document.getElementById('tableLocation').value = table.location || 'main_hall';
            
            // Set status radio
            document.querySelector(`input[name="status"][value="${table.status || 'available'}"]`).checked = true;
        } else {
            title.textContent = 'Add New Table';
            document.getElementById('tableId').value = '';
        }
        
        modal.classList.remove('hidden');
    }

    // Close table modal
    window.closeTableModal = function() {
        document.getElementById('tableModal').classList.add('hidden');
    };

    // Close quick order modal
    window.closeQuickOrderModal = function() {
        document.getElementById('quickOrderModal').classList.add('hidden');
        quickOrderCart = [];
        selectedTableId = null;
    };

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
            loadTables();
            
        } catch (error) {
            console.error("Error saving table:", error);
            showNotification('Error saving table: ' + error.message, 'error');
        }
    }

    // Open table details
    function openTableDetails(table) {
        // Create a modal to show table details and options
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg w-full max-w-md">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold text-gray-800">${table.tableNumber}</h3>
                        <button class="close-table-details text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <div class="mt-2 text-sm text-gray-600">
                        Status: <span class="font-bold ${table.status === 'available' ? 'text-green-600' : table.status === 'occupied' ? 'text-red-600' : 'text-yellow-600'}">${table.status}</span>
                    </div>
                </div>
                <div class="p-6">
                    <div class="space-y-4">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Capacity:</span>
                            <span class="font-bold">${table.capacity || 4} persons</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Location:</span>
                            <span class="font-medium">${table.location || 'Main Hall'}</span>
                        </div>
                        ${table.customerCount ? `
                            <div class="flex justify-between">
                                <span class="text-gray-600">Current Guests:</span>
                                <span class="font-bold">${table.customerCount}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="mt-6 space-y-3">
                        ${table.status === 'available' ? `
                            <button class="w-full bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 start-order-btn">
                                <i class="fas fa-utensils mr-2"></i> Start New Order
                            </button>
                        ` : table.status === 'occupied' ? `
                            <button class="w-full bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 view-order-btn">
                                <i class="fas fa-eye mr-2"></i> View Current Order
                            </button>
                            <button class="w-full bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 add-more-btn">
                                <i class="fas fa-plus mr-2"></i> Add More Items
                            </button>
                            <button class="w-full bg-yellow-500 text-white py-3 rounded-lg font-bold hover:bg-yellow-600 generate-bill-btn">
                                <i class="fas fa-file-invoice-dollar mr-2"></i> Generate Bill
                            </button>
                        ` : ''}
                        <button class="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50 edit-table-btn">
                            <i class="fas fa-edit mr-2"></i> Edit Table
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.close-table-details').addEventListener('click', () => {
            modal.remove();
        });
        
        if (table.status === 'available') {
            modal.querySelector('.start-order-btn')?.addEventListener('click', () => {
                modal.remove();
                startNewOrder(table.id);
            });
        } else if (table.status === 'occupied') {
            modal.querySelector('.view-order-btn')?.addEventListener('click', () => {
                modal.remove();
                viewTableOrder(table.id);
            });
            
            modal.querySelector('.add-more-btn')?.addEventListener('click', () => {
                modal.remove();
                addMoreToOrder(table.id);
            });
            
            modal.querySelector('.generate-bill-btn')?.addEventListener('click', () => {
                modal.remove();
                if (confirm('Generate bill and close order for this table?')) {
                    closeOrderForTable(table.id);
                }
            });
        }
        
        modal.querySelector('.edit-table-btn')?.addEventListener('click', () => {
            modal.remove();
            openTableModal(table);
        });
    }

    // Close order for table
    async function closeOrderForTable(tableId) {
        try {
            // Find active order for this table
            const snapshot = await db.collection('orders')
                .where('restaurantId', '==', auth.currentUser.uid)
                .where('tableId', '==', tableId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const orderId = snapshot.docs[0].id;
                await closeOrderAndGenerateBill(orderId);
            } else {
                // No active order, just update table status
                await db.collection('tables').doc(tableId).update({
                    status: 'available',
                    currentOrderId: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showNotification('Table marked as available', 'success');
                loadTables();
            }
        } catch (error) {
            console.error("Error closing order for table:", error);
            showNotification('Error: ' + error.message, 'error');
        }
    }

    // Load existing order for table
    async function loadExistingOrderForTable(tableId) {
        try {
            const snapshot = await db.collection('orders')
                .where('restaurantId', '==', auth.currentUser.uid)
                .where('tableId', '==', tableId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const order = snapshot.docs[0].data();
                const orderItems = order.items || [];
                
                // Add existing items to quick cart
                quickOrderCart = [...orderItems];
                renderQuickCart();
                renderQuickProducts(document.getElementById('quickProductSearch')?.value || '');
                
                // Set customer info
                document.getElementById('quickCustomerName').value = order.customerName || '';
                document.getElementById('quickCustomerCount').value = order.customerCount || 2;
                
                showNotification(`Loaded existing order with ${orderItems.length} items`, 'info');
            }
        } catch (error) {
            console.error("Error loading existing order:", error);
        }
    }

    // Show notification
    function showNotification(message, type) {
        const n = document.createElement('div');
        n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[9999] text-white font-medium ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
        n.textContent = message;
        document.body.appendChild(n);
        
        setTimeout(() => {
            n.style.opacity = '0';
            n.style.transform = 'translateY(-20px)';
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }
});
