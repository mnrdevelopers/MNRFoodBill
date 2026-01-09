let cart = [];
let products = [];
let restaurantSettings = {
    gstRate: 0,
    serviceCharge: 0,
    currency: '₹'
};

document.addEventListener('DOMContentLoaded', function() {
    // Setup authentication and common functions
    setupAuthAndLogout();
    
    // Initialize billing page
    initializeBilling();
});

function setupAuthAndLogout() {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadUserInfo();
            setupLogoutButton();
            loadRestaurantSettings();
            loadProducts();
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
            });
        });
    }
}

function initializeBilling() {
    setupPaymentModeHandlers();
    setupEventListeners();
    setupCategoryTabs();
}

function loadRestaurantSettings() {
    const user = auth.currentUser;
    db.collection('restaurants').doc(user.uid).get()
        .then(doc => {
            if (doc.exists) {
                const data = doc.data();
                const settings = data.settings || {};
                
                restaurantSettings = {
                    gstRate: Number(settings.gstRate) || 0,
                    serviceCharge: Number(settings.serviceCharge) || 0,
                    currency: settings.currency || '₹'
                };
                
                updateGSTLabels();
            }
        })
        .catch(err => {
            console.error("Error loading settings:", err);
        });
}

function updateGSTLabels() {
    const gstLabel = document.querySelector('span:has(+ #gstAmount)');
    const serviceLabel = document.querySelector('span:has(+ #serviceCharge)');
    
    if (gstLabel) {
        gstLabel.textContent = `GST (${restaurantSettings.gstRate}%)`;
    }
    if (serviceLabel) {
        serviceLabel.textContent = `Service Charge (${restaurantSettings.serviceCharge}%)`;
    }
}

function setupPaymentModeHandlers() {
    const paymentMode = document.getElementById('paymentMode');
    const cashReceived = document.getElementById('cashReceived');
    
    if (paymentMode) {
        paymentMode.addEventListener('change', function() {
            const mode = this.value;
            const cashFields = document.getElementById('cashPaymentFields');
            const nonCashFields = document.getElementById('nonCashPaymentFields');
            
            if (mode === 'cash') {
                cashFields.classList.remove('d-none');
                nonCashFields.classList.add('d-none');
                cashReceived.required = true;
            } else {
                cashFields.classList.add('d-none');
                nonCashFields.classList.remove('d-none');
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
    const total = parseFloat(totalText.replace(/[^0-9.-]+/g, "")) || 0;
    
    let change = 0;
    if (cashReceived >= total) {
        change = cashReceived - total;
    }
    
    const changeElement = document.getElementById('changeAmount');
    changeElement.textContent = `${restaurantSettings.currency}${change.toFixed(2)}`;
    
    if (cashReceived < total) {
        changeElement.classList.remove('text-success');
        changeElement.classList.add('text-danger');
        changeElement.textContent = `${restaurantSettings.currency}${(cashReceived - total).toFixed(2)}`;
    } else {
        changeElement.classList.remove('text-danger');
        changeElement.classList.add('text-success');
    }
}

function loadProducts() {
    const user = auth.currentUser;
    db.collection('products')
        .where('restaurantId', '==', user.uid)
        .orderBy('category')
        .get()
        .then(snapshot => {
            products = [];
            const categories = new Set(['all']);
            
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                products.push(product);
                categories.add(product.category);
            });

            renderCategories(categories);
            renderProducts(products);
        });
}

function renderCategories(categories) {
    const container = document.querySelector('.d-flex.overflow-auto');
    if (!container) return;
    
    container.innerHTML = `
        <button class="btn btn-sm btn-danger me-2 category-tab active" data-category="all">
            All Items
        </button>
    `;

    categories.forEach(category => {
        if (category !== 'all') {
            container.innerHTML += `
                <button class="btn btn-sm btn-outline-secondary me-2 category-tab" data-category="${category}">
                    ${category}
                </button>
            `;
        }
    });

    // Add event listeners to category tabs
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.category-tab').forEach(t => {
                t.classList.remove('active', 'btn-danger');
                t.classList.add('btn-outline-secondary');
            });
            
            this.classList.remove('btn-outline-secondary');
            this.classList.add('active', 'btn-danger');
            
            const category = this.dataset.category;
            filterProducts(category);
        });
    });
}

function filterProducts(category) {
    const searchInput = document.getElementById('productSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    let filtered = products;
    
    if (category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
    }
    
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }
    
    renderProducts(filtered);
}

function renderProducts(productsToShow) {
    const container = document.getElementById('productsGrid');
    if (!container) return;
    container.innerHTML = '';

    productsToShow.forEach(product => {
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-md-4 col-lg-3';
        col.innerHTML = `
            <div class="product-card card h-100 border">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title fw-bold mb-1">${product.name}</h6>
                        <span class="fw-bold text-danger">${restaurantSettings.currency}${Number(product.price || 0).toFixed(2)}</span>
                    </div>
                    ${product.description ? `<p class="card-text small text-muted mb-3">${product.description}</p>` : ''}
                    <div class="d-flex justify-content-between align-items-center mt-auto">
                        <span class="badge bg-light text-dark">${product.category}</span>
                        <button class="add-to-cart btn btn-sm btn-danger" data-id="${product.id}">
                            <i class="fas fa-plus me-1"></i> Add
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });

    // Add event listeners to Add buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const productId = this.dataset.id;
            addToCart(productId);
        });
    });

    // Add click event to product cards
    container.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', function() {
            const addButton = this.querySelector('.add-to-cart');
            if (addButton) {
                const productId = addButton.dataset.id;
                addToCart(productId);
            }
        });
    });
}

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
            quantity: 1
        });
    }

    renderCart();
    updateTotals();
    showNotification(`${product.name} added to cart!`, 'success');
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '';
        if (emptyCart) {
            container.appendChild(emptyCart);
            emptyCart.classList.remove('d-none');
        }
        return;
    }

    if (emptyCart) emptyCart.classList.add('d-none');
    container.innerHTML = '';

    cart.forEach((item, index) => {
        const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="flex-grow-1">
                    <div class="fw-medium">${item.name}</div>
                    <small class="text-muted">${restaurantSettings.currency}${Number(item.price || 0).toFixed(2)} × ${item.quantity}</small>
                </div>
                <div class="d-flex align-items-center">
                    <span class="fw-bold me-3">${restaurantSettings.currency}${itemTotal.toFixed(2)}</span>
                    <button class="btn btn-sm btn-outline-danger remove-item" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(itemElement);
    });

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-item').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            removeFromCart(index);
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
    
    // Recalculate change if cash payment
    if (document.getElementById('paymentMode').value === 'cash') {
        calculateChange();
    }
}

function setupEventListeners() {
    // Clear cart
    const clearCartBtn = document.getElementById('clearCart');
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function() {
            if (cart.length === 0) return;
            
            if (confirm('Are you sure you want to clear all items from the cart?')) {
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
        saveOrderBtn.addEventListener('click', function() {
            if (cart.length === 0) {
                showNotification('Please add items to cart first', 'danger');
                return;
            }

            const user = auth.currentUser;
            if (!user) return;

            const paymentMode = document.getElementById('paymentMode').value;
            const currency = restaurantSettings.currency || '₹';
            const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
            const totalText = document.getElementById('totalAmount').textContent;
            const total = parseFloat(totalText.replace(/[^0-9.-]+/g, "")) || 0;
            
            // Validate payment for cash mode
            if (paymentMode === 'cash') {
                const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                if (cashReceived <= 0) {
                    showNotification('Please enter cash received amount', 'danger');
                    document.getElementById('cashReceived').focus();
                    return;
                }
                if (cashReceived < total) {
                    showNotification('Cash received is less than total amount', 'danger');
                    document.getElementById('cashReceived').focus();
                    return;
                }
            }
            
            const orderData = {
                restaurantId: user.uid,
                items: JSON.parse(JSON.stringify(cart)),
                customerName: document.getElementById('customerName').value || 'Walk-in Customer',
                customerPhone: document.getElementById('customerPhone').value || '',
                subtotal: Number(subtotal) || 0,
                gstRate: Number(restaurantSettings.gstRate) || 0,
                gstAmount: Number(document.getElementById('gstAmount')?.textContent.replace(/[^0-9.-]+/g, "") || 0),
                serviceChargeRate: Number(restaurantSettings.serviceCharge) || 0,
                serviceCharge: Number(document.getElementById('serviceCharge')?.textContent.replace(/[^0-9.-]+/g, "") || 0),
                total: Number(total) || 0,
                paymentMode: paymentMode,
                cashReceived: paymentMode === 'cash' ? parseFloat(document.getElementById('cashReceived').value) || 0 : 0,
                changeAmount: paymentMode === 'cash' ? parseFloat(document.getElementById('changeAmount').textContent.replace(/[^0-9.-]+/g, "")) || 0 : 0,
                status: 'saved',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            db.collection('orders').add(orderData)
                .then(docRef => {
                    showNotification('Order saved successfully!', 'success');
                    // Clear form
                    document.getElementById('customerName').value = '';
                    document.getElementById('customerPhone').value = '';
                    document.getElementById('cashReceived').value = '';
                    document.getElementById('changeAmount').textContent = `${currency}0.00`;
                })
                .catch(error => {
                    console.error("Firebase Error:", error);
                    showNotification('Error saving order: ' + error.message, 'danger');
                });
        });
    }

    // Print bill
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        printBillBtn.addEventListener('click', function() {
            if (cart.length === 0) {
                showNotification('Please add items to cart first', 'danger');
                return;
            }

            // Validate payment for cash mode
            const paymentMode = document.getElementById('paymentMode').value;
            if (paymentMode === 'cash') {
                const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                const totalText = document.getElementById('totalAmount').textContent;
                const currency = restaurantSettings.currency || '₹';
                const total = parseFloat(totalText.replace(/[^0-9.-]+/g, "")) || 0;
                
                if (cashReceived <= 0) {
                    showNotification('Please enter cash received amount', 'danger');
                    document.getElementById('cashReceived').focus();
                    return;
                }
                if (cashReceived < total) {
                    showNotification('Cash received is less than total amount', 'danger');
                    document.getElementById('cashReceived').focus();
                    return;
                }
            }

            if (typeof prepareReceipt === 'function') {
                prepareReceipt();
                // Show modal using Bootstrap
                const modal = new bootstrap.Modal(document.getElementById('printModal'));
                modal.show();
            } else {
                showNotification('Printing module not loaded.', 'danger');
            }
        });
    }

    // Search functionality
    const productSearchInput = document.getElementById('productSearch');
    if (productSearchInput) {
        productSearchInput.addEventListener('input', function() {
            const activeTab = document.querySelector('.category-tab.active');
            filterProducts(activeTab ? activeTab.dataset.category : 'all');
        });
    }
}

function setupCategoryTabs() {
    // This is handled in renderCategories now
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

// Export cart functions for print.js
window.renderCart = renderCart;
window.updateTotals = updateTotals;
window.cart = cart;
