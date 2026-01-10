// Initialize empty state. No more hardcoded tax values.
let cart = [];
let products = []; // This global array must be populated for addToCart to work
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
            const docRef = await db.collection('orders').add(orderData);
            return { success: true, id: docRef.id };
        } catch (error) {
            if (!isOnline()) {
                const localId = storageManager.saveOrder(orderData);
                return { success: true, id: localId, offline: true };
            }
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
                        productsData.push({ id: doc.id, ...doc.data() });
                    });
                    
                    // FIX: Populate the global products array so addToCart can find items
                    products = productsData; 
                    
                    localStorage.setItem('cachedProducts', JSON.stringify(productsData));
                    
                    // Extract categories and render filters
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
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
        }
        renderProducts(filtered);
    }

    function renderProducts(productsToShow) {
        const container = document.getElementById('productsGrid');
        if (!container) return;
        container.innerHTML = '';

        const currency = restaurantSettings.currency || '₹';

        if (productsToShow.length === 0) {
            container.innerHTML = '<div class="col-span-full py-10 text-center text-gray-500">No products found</div>';
            return;
        }

        productsToShow.forEach(product => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition cursor-pointer group';
            
            const imageUrl = typeof getProductImage === 'function' ? getProductImage(product.name) : null;
            
            card.innerHTML = `
                <div class="h-40 relative bg-gray-100 flex items-center justify-center overflow-hidden">
                    ${imageUrl 
                        ? `<img src="${imageUrl}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.outerHTML='<i class=\'fas fa-hamburger text-gray-300 text-4xl\'></i>'"/>`
                        : `<i class="fas fa-hamburger text-gray-300 text-4xl"></i>`
                    }
                </div>
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <h3 class="font-bold text-gray-800 truncate">${product.name}</h3>
                            <p class="text-xs text-gray-500 mt-1 truncate">${product.description || ''}</p>
                        </div>
                        <span class="font-bold text-red-500 ml-2">${currency}${Number(product.price || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex items-center justify-between mt-4">
                        <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">${product.category}</span>
                        <button class="add-to-cart bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600 transition" 
                                data-id="${product.id}">
                            <i class="fas fa-plus mr-1"></i> Add
                        </button>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => addToCart(product.id));
            container.appendChild(card);
        });
          
        document.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                addToCart(this.dataset.id);
            });
        });
    }

    function addToCart(productId) {
        // Now 'products' is populated, so find will work
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
                emptyCart.classList.remove('hidden');
            }
            return;
        }

        if (emptyCart) emptyCart.classList.add('hidden');
        container.innerHTML = '';

        const currency = restaurantSettings.currency || '₹';

        cart.forEach((item, index) => {
            const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
            const imageUrl = typeof getProductImage === 'function' ? getProductImage(item.name) : null;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'flex items-center justify-between py-2 border-b last:border-0';
            itemElement.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                        ${imageUrl 
                            ? `<img src="${imageUrl}" class="w-full h-full object-cover" onerror="this.outerHTML='<i class=\'fas fa-hamburger text-gray-400\'></i>'"/>`
                            : `<i class="fas fa-hamburger text-gray-400"></i>`
                        }
                    </div>
                    <div>
                        <h4 class="font-medium text-sm text-gray-800">${item.name}</h4>
                        <p class="text-xs text-gray-500">${currency}${Number(item.price || 0).toFixed(2)} × ${item.quantity}</p>
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
        
        // Use standard JS to find labels by text content
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

    const saveOrderBtn = document.getElementById('saveOrder');
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener('click', async function() {
            if (cart.length === 0) {
                showNotification('Cart is empty', 'error');
                return;
            }

            const user = auth.currentUser;
            const currency = restaurantSettings.currency || '₹';
            const totalText = document.getElementById('totalAmount').textContent;
            const total = parseFloat(totalText.replace(currency, '')) || 0;
            const paymentMode = document.getElementById('paymentMode').value;
            
            if (paymentMode === 'cash') {
                const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                if (cashReceived < total) {
                    showNotification('Insufficient cash received', 'error');
                    return;
                }
            }
            
            const orderData = {
                restaurantId: user.uid,
                items: JSON.parse(JSON.stringify(cart)), 
                customerName: document.getElementById('customerName').value || 'Walk-in Customer',
                customerPhone: document.getElementById('customerPhone').value || '',
                subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                gstRate: restaurantSettings.gstRate,
                gstAmount: parseFloat(document.getElementById('gstAmount').textContent.replace(currency, '')),
                serviceChargeRate: restaurantSettings.serviceCharge,
                serviceCharge: parseFloat(document.getElementById('serviceCharge').textContent.replace(currency, '')),
                total: total,
                paymentMode: paymentMode,
                status: 'saved',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('orders').add(orderData);
                showNotification('Order saved!', 'success');
                cart = [];
                renderCart();
                updateTotals();
                document.getElementById('customerName').value = '';
                document.getElementById('customerPhone').value = '';
            } catch (error) {
                showNotification('Failed to save order', 'error');
            }
        });
    }

    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        printBillBtn.addEventListener('click', function() {
            if (cart.length === 0) {
                showNotification('Cart is empty', 'error');
                return;
            }
            if (typeof prepareReceipt === 'function') {
                prepareReceipt();
            }
        });
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
});

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
