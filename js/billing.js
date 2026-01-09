// Initialize empty state. No more hardcoded tax values.
let cart = [];
let products = [];
let restaurantSettings = {
    gstRate: 0,
    serviceCharge: 0,
    currency: ''
};

document.addEventListener('DOMContentLoaded', function() {
    // Check auth
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadRestaurantSettings();
            loadProducts();
        }
    });

    // Load restaurant settings from Firestore (Source of Truth)
    function loadRestaurantSettings() {
        const user = auth.currentUser;
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const fetchedSettings = data.settings || {};
                    
                    // Assign from database or force 0/empty (no hardcoded defaults)
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
                    // If no settings found, redirect to settings page to set them up
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

    // Add network check
function isOnline() {
  return navigator.onLine;
}

    // Setup payment mode handlers
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
                
                // Clear cash received field when switching modes
                cashReceived.value = '';
            });
        }
        
        if (cashReceived) {
            cashReceived.addEventListener('input', calculateChange);
        }
    }

    // Calculate change
    function calculateChange() {
        const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
        const totalText = document.getElementById('totalAmount').textContent;
        const currency = restaurantSettings.currency || '';
        const total = parseFloat(totalText.replace(currency, '')) || 0;
        
        let change = 0;
        if (cashReceived >= total) {
            change = cashReceived - total;
        }
        
        document.getElementById('changeAmount').textContent = `${currency}${change.toFixed(2)}`;
        
        // Visual feedback for insufficient cash
        if (cashReceived < total) {
            document.getElementById('changeAmount').classList.remove('text-green-600');
            document.getElementById('changeAmount').classList.add('text-red-600');
            document.getElementById('changeAmount').textContent = `${currency}${(cashReceived - total).toFixed(2)}`;
        } else {
            document.getElementById('changeAmount').classList.remove('text-red-600');
            document.getElementById('changeAmount').classList.add('text-green-600');
        }
    }

    // Modified saveOrder function
async function saveOrderToFirebase(orderData) {
  try {
    const docRef = await db.collection('orders').add(orderData);
    return { success: true, id: docRef.id };
  } catch (error) {
    if (!isOnline()) {
      // Save locally if offline
      const localId = storageManager.saveOrder(orderData);
      return { success: true, id: localId, offline: true };
    }
    throw error;
  }
}

    // Load products
  function loadProducts() {
  if (isOnline()) {
    // Load from Firebase
    const user = auth.currentUser;
    db.collection('products')
      .where('restaurantId', '==', user.uid)
      .get()
      .then(snapshot => {
        // Cache locally
        const productsData = [];
        snapshot.forEach(doc => {
          productsData.push({ id: doc.id, ...doc.data() });
        });
        localStorage.setItem('cachedProducts', JSON.stringify(productsData));
        renderProducts(productsData);
      })
      .catch(() => {
        // Fallback to cache
        const cached = JSON.parse(localStorage.getItem('cachedProducts')) || [];
        renderProducts(cached);
      });
  } else {
    // Use cached data
    const cached = JSON.parse(localStorage.getItem('cachedProducts')) || [];
    renderProducts(cached);
  }
}
    
    // Render categories
    function renderCategories(categories) {
        const categoryTabs = document.querySelector('.category-tab');
        if (!categoryTabs) return;
        
        const container = categoryTabs.parentElement;
        container.innerHTML = `
            <button class="category-tab active px-4 py-2 bg-red-500 text-white rounded-lg whitespace-nowrap" data-category="all">All Items</button>
        `;

        categories.forEach(category => {
            if (category !== 'all') {
                container.innerHTML += `
                    <button class="category-tab px-4 py-2 bg-gray-100 text-gray-700 rounded-lg whitespace-nowrap hover:bg-gray-200" data-category="${category}">
                        ${category}
                    </button>
                `;
            }
        });

        // Add category tab event listeners
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.category-tab').forEach(t => {
                    t.classList.remove('active', 'bg-red-500', 'text-white');
                    t.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                });
                
                this.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
                this.classList.add('active', 'bg-red-500', 'text-white');
                
                const category = this.dataset.category;
                filterProducts(category);
            });
        });
    }

    // Filter products by category
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

    // Render products
  function renderProducts(productsToShow) {
    const container = document.getElementById('productsGrid');
    if (!container) return;
    container.innerHTML = '';

    const currency = restaurantSettings.currency || '';

    productsToShow.forEach(product => {
        const card = document.createElement('div');
        card.className = 'bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition cursor-pointer';
        
        // Get image URL based on product name
        const imageUrl = getProductImage(product.name);
        
        const cardContent = `
            <div class="h-40 ${imageUrl ? 'overflow-hidden' : 'bg-gray-100 flex items-center justify-center'}">
                ${imageUrl 
                    ? `<img src="${imageUrl}" 
                           alt="${product.name}" 
                           class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                           onerror="this.style.display='none'; this.parentElement.classList.add('bg-gray-100', 'flex', 'items-center', 'justify-center'); this.parentElement.innerHTML='<i class=\\'fas fa-hamburger text-gray-300 text-4xl\\'></i>';" />`
                    : `<i class="fas fa-hamburger text-gray-300 text-4xl"></i>`
                }
            </div>
            <div class="p-4">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex-1">
                        <h3 class="font-bold text-gray-800 truncate">${product.name}</h3>
                        <p class="text-sm text-gray-600 mt-1 truncate">${product.description || ''}</p>
                    </div>
                    <span class="font-bold text-red-500 ml-2">${currency}${Number(product.price || 0).toFixed(2)}</span>
                </div>
                <div class="flex items-center justify-between mt-4">
                    <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${product.category}</span>
                    <button class="add-to-cart bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600" 
                            data-id="${product.id}">
                        <i class="fas fa-plus mr-1"></i> Add
                    </button>
                </div>
            </div>
        `;
        
        card.innerHTML = cardContent;
        container.appendChild(card);
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
    container.querySelectorAll('.bg-white').forEach(card => {
        card.addEventListener('click', function() {
            const addButton = this.querySelector('.add-to-cart');
            if (addButton) {
                const productId = addButton.dataset.id;
                addToCart(productId);
            }
        });
    });
}

    // Add product to cart
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

    // Render cart items
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

        const currency = restaurantSettings.currency || '';

       cart.forEach((item, index) => {
    const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
    const imageUrl = getProductImage(item.name);
    
    const itemElement = document.createElement('div');
    itemElement.className = 'flex items-center justify-between py-2 border-b';
    itemElement.innerHTML = `
        <div class="flex items-center space-x-3">
            ${imageUrl 
                ? `<img src="${imageUrl}" 
                       class="w-10 h-10 object-cover rounded-lg"
                       alt="${item.name}"
                       onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\"w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center\\"><i class=\\"fas fa-hamburger text-gray-400\\"></i></div>' + this.parentElement.innerHTML;">`
                : `<div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                     <i class="fas fa-hamburger text-gray-400"></i>
                   </div>`
            }
            <div>
                <h4 class="font-medium text-gray-800">${item.name}</h4>
                <p class="text-sm text-gray-600">${currency}${Number(item.price || 0).toFixed(2)} × ${item.quantity}</p>
            </div>
        </div>
        <div class="flex items-center space-x-2">
            <span class="font-bold">${currency}${itemTotal.toFixed(2)}</span>
            <button class="remove-item text-red-500 hover:text-red-700" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
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

    // Remove item from cart
    function removeFromCart(index) {
        const item = cart[index];
        cart.splice(index, 1);
        renderCart();
        updateTotals();
        showNotification(`${item.name} removed from cart`, 'info');
    }

    // Update totals
    function updateTotals() {
        const subtotalElem = document.getElementById('subtotal');
        if (!subtotalElem) return;

        const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
        
        // Use database values
        const gstRate = Number(restaurantSettings.gstRate) || 0;
        const serviceRate = Number(restaurantSettings.serviceCharge) || 0;
        const currency = restaurantSettings.currency || '';

        const gstAmount = subtotal * (gstRate / 100);
        const serviceCharge = subtotal * (serviceRate / 100);
        const total = subtotal + gstAmount + serviceCharge;

        subtotalElem.textContent = `${currency}${subtotal.toFixed(2)}`;
        document.getElementById('gstAmount').textContent = `${currency}${gstAmount.toFixed(2)}`;
        document.getElementById('serviceCharge').textContent = `${currency}${serviceCharge.toFixed(2)}`;
        document.getElementById('totalAmount').textContent = `${currency}${total.toFixed(2)}`;
        
        // Update the labels in the UI to show the rates dynamically
        const gstLabel = document.querySelector('div.flex.justify-between.mb-2:has(#gstAmount) span.text-gray-600');
        if (gstLabel) gstLabel.textContent = `GST (${gstRate}%)`;
        
        const serviceLabel = document.querySelector('div.flex.justify-between.mb-4:has(#serviceCharge) span.text-gray-600');
        if (serviceLabel) serviceLabel.textContent = `Service Charge (${serviceRate}%)`;
        
        // Recalculate change if cash payment
        if (document.getElementById('paymentMode').value === 'cash') {
            calculateChange();
        }
    }

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
                showNotification('Please add items to cart first', 'error');
                return;
            }

            const user = auth.currentUser;
            if (!user) return;

            const paymentMode = document.getElementById('paymentMode').value;
            const currency = restaurantSettings.currency || '';
            const subtotal = cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
            const totalText = document.getElementById('totalAmount').textContent;
            const total = parseFloat(totalText.replace(currency, '')) || 0;
            
            // Validate payment for cash mode
            if (paymentMode === 'cash') {
                const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                if (cashReceived <= 0) {
                    showNotification('Please enter cash received amount', 'error');
                    document.getElementById('cashReceived').focus();
                    return;
                }
                if (cashReceived < total) {
                    showNotification('Cash received is less than total amount', 'error');
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
                gstAmount: Number(document.getElementById('gstAmount')?.textContent.replace(currency, '') || 0),
                serviceChargeRate: Number(restaurantSettings.serviceCharge) || 0,
                serviceCharge: Number(document.getElementById('serviceCharge')?.textContent.replace(currency, '') || 0),
                total: Number(total) || 0,
                paymentMode: paymentMode,
                cashReceived: paymentMode === 'cash' ? parseFloat(document.getElementById('cashReceived').value) || 0 : 0,
                changeAmount: paymentMode === 'cash' ? parseFloat(document.getElementById('changeAmount').textContent.replace(currency, '')) || 0 : 0,
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
                    showNotification('Error saving order: ' + error.message, 'error');
                });
        });
    }

    // Print bill
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        printBillBtn.addEventListener('click', function() {
            if (cart.length === 0) {
                showNotification('Please add items to cart first', 'error');
                return;
            }

            // Validate payment for cash mode
            const paymentMode = document.getElementById('paymentMode').value;
            if (paymentMode === 'cash') {
                const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                const totalText = document.getElementById('totalAmount').textContent;
                const currency = restaurantSettings.currency || '';
                const total = parseFloat(totalText.replace(currency, '')) || 0;
                
                if (cashReceived <= 0) {
                    showNotification('Please enter cash received amount', 'error');
                    document.getElementById('cashReceived').focus();
                    return;
                }
                if (cashReceived < total) {
                    showNotification('Cash received is less than total amount', 'error');
                    document.getElementById('cashReceived').focus();
                    return;
                }
            }

            if (typeof prepareReceipt === 'function') {
                prepareReceipt();
                document.getElementById('printModal').classList.remove('hidden');
            } else {
                showNotification('Printing module not loaded.', 'error');
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

    // Export helpers for other scripts
    window.renderCart = renderCart;
    window.updateTotals = updateTotals;
});

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}


