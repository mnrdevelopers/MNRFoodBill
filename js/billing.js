let cart = [];
let currentView = 'grid';
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
            setupViewToggle(); // Add this line
            setupPaymentHandlers();
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
                    const data = doc.data();
                    productsData.push({ 
                        id: doc.id, 
                        name: data.name,
                        price: data.price,
                        category: data.category,
                        description: data.description,
                        imageUrl: data.imageUrl, // Ensure this is loaded
                        ...data 
                    });
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
    // Store filtered products
    window.filteredProducts = productsToShow;
    
    if (currentView === 'grid') {
        renderProductsInGridView(productsToShow);
    } else {
        renderProductsInListView(productsToShow);
    }
}

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
        // Use imageUrl from Firestore or fallback to default
        const imageUrl = product.imageUrl || (typeof getProductImage === 'function' ? getProductImage(product.name) : null);
        
        const card = document.createElement('div');
        card.className = 'compact-card bg-white border border-gray-200 rounded-lg overflow-hidden cursor-pointer';
        
        // Determine display price
        let displayPrice = Number(product.price || 0).toFixed(2);
        let hasVariations = product.variations && product.variations.length > 0;
        
        if (hasVariations) {
            const prices = product.variations.map(v => v.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            if (minPrice === maxPrice) {
                displayPrice = minPrice.toFixed(2);
            } else {
                displayPrice = `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`;
            }
        }
        
        card.innerHTML = `
            <div class="h-20 bg-gray-50 flex items-center justify-center overflow-hidden relative">
                ${imageUrl 
                    ? `<img src="${imageUrl}" alt="${product.name}" 
                          class="w-full h-full object-cover product-image"
                          onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                    : ''
                }
                <div class="w-full h-full flex items-center justify-center ${imageUrl ? 'hidden' : ''}">
                    <i class="fas fa-hamburger text-gray-300 text-xl"></i>
                </div>
                <div class="absolute bottom-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    ${currency}${displayPrice}
                </div>
                ${hasVariations ? `
                    <div class="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                        <i class="fas fa-layer-group mr-1"></i>${product.variations.length}
                    </div>
                ` : ''}
            </div>
            <div class="p-2">
                <h3 class="product-name font-medium text-gray-800 mb-1">${product.name}</h3>
                <div class="flex items-center justify-between">
                    <span class="product-category text-xs text-gray-500">${product.category}</span>
                    ${hasVariations ? `
                        <button class="select-variation bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-blue-600 transition" 
                                data-id="${product.id}"
                                title="Select variation">
                            <i class="fas fa-caret-down"></i>
                        </button>
                    ` : `
                        <button class="add-to-cart bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition" 
                                data-id="${product.id}"
                                title="Add to cart">
                            <i class="fas fa-plus"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
        
        if (hasVariations) {
            // For products with variations, show selection modal
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.select-variation')) {
                    showVariationSelection(product);
                }
            });
            
            // Variation selector button
            const selectBtn = card.querySelector('.select-variation');
            if (selectBtn) {
                selectBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showVariationSelection(product);
                });
            }
        } else {
            // For products without variations, direct add to cart
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.add-to-cart')) {
                    addToCart(product.id, product.name, product.price);
                }
            });
            
            const addBtn = card.querySelector('.add-to-cart');
            if (addBtn) {
                addBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    addToCart(product.id, product.name, product.price);
                });
            }
        }
        
        container.appendChild(card);
    });
    
    // Add event listeners to add-to-cart buttons
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
        const hasVariations = product.variations && product.variations.length > 0;
        
        // Determine display price
        let displayPrice = Number(product.price || 0).toFixed(2);
        if (hasVariations) {
            const prices = product.variations.map(v => v.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            
            if (minPrice === maxPrice) {
                displayPrice = minPrice.toFixed(2);
            } else {
                displayPrice = `${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}`;
            }
        }
        
        const listItem = document.createElement('div');
        listItem.className = 'list-item bg-white';
        
        listItem.innerHTML = `
            <div class="flex-shrink-0">
                <div class="relative">
                    ${imageUrl 
                        ? `<img src="${imageUrl}" alt="${product.name}" 
                              class="list-image"
                              onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                        : ''
                    }
                    <div class="w-12 h-12 bg-gray-100 rounded flex items-center justify-center ${imageUrl ? 'hidden' : ''}">
                        <i class="fas fa-hamburger text-gray-400"></i>
                    </div>
                    ${hasVariations ? `
                        <div class="absolute -top-1 -left-1 bg-blue-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            ${product.variations.length}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="list-details">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="list-name">${product.name}</h4>
                        ${hasVariations ? `
                            <div class="text-xs text-gray-500 mt-1">
                                <i class="fas fa-layer-group mr-1"></i>${product.variations.length} variations
                            </div>
                        ` : ''}
                    </div>
                    <span class="list-price">${currency}${displayPrice}</span>
                </div>
                ${product.description ? `<p class="list-description">${product.description}</p>` : ''}
                <span class="list-category">${product.category}</span>
            </div>
            ${hasVariations ? `
                <button class="select-variation-list bg-blue-500 text-white w-8 h-8 rounded-full flex items-center justify-center ml-2 hover:bg-blue-600 transition" 
                        data-id="${product.id}"
                        title="Select variation">
                    <i class="fas fa-caret-down text-xs"></i>
                </button>
            ` : `
                <button class="add-to-cart-list bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center ml-2 hover:bg-red-600 transition" 
                        data-id="${product.id}"
                        title="Add to cart">
                    <i class="fas fa-plus text-xs"></i>
                </button>
            `}
        `;
        
        if (hasVariations) {
            listItem.addEventListener('click', (e) => {
                if (!e.target.closest('.select-variation-list')) {
                    showVariationSelection(product);
                }
            });
            
            const selectBtn = listItem.querySelector('.select-variation-list');
            if (selectBtn) {
                selectBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showVariationSelection(product);
                });
            }
        } else {
            listItem.addEventListener('click', (e) => {
                if (!e.target.closest('.add-to-cart-list')) {
                    addToCart(product.id, product.name, product.price);
                }
            });
            
            const addBtn = listItem.querySelector('.add-to-cart-list');
            if (addBtn) {
                addBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    addToCart(product.id, product.name, product.price);
                });
            }
        }
        
        container.appendChild(listItem);
    });
    
    // Add event listeners to list view add-to-cart buttons
    document.querySelectorAll('.add-to-cart-list').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            addToCart(this.dataset.id);
        });
    });
}
    
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
        // Store complete product details in cart
        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            quantity: 1,
            imageUrl: product.imageUrl, // Store image URL
            category: product.category
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
        const productDetails = products.find(p => p.id === item.id);
        const imageUrl = productDetails?.imageUrl || (typeof getProductImage === 'function' ? getProductImage(item.name) : null);
        
        const itemTotal = Number(item.price || 0) * Number(item.quantity || 0);
        
        const itemElement = document.createElement('div');
        itemElement.className = 'flex items-center justify-between py-3 border-b last:border-0';
        itemElement.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    ${imageUrl 
                        ? `<img src="${imageUrl}" alt="${item.displayName}" 
                              class="w-full h-full object-cover"
                              onerror="this.onerror=null; this.outerHTML='<i class=\'fas fa-hamburger text-gray-400\'></i>'">`
                        : `<i class="fas fa-hamburger text-gray-400"></i>`
                    }
                </div>
                <div>
                    <h4 class="font-medium text-sm text-gray-800">${item.displayName}</h4>
                    ${item.variationName ? `
                        <div class="text-xs text-gray-600 mb-1">${item.name} • ${item.variationName}</div>
                    ` : ''}
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
            renderProductsInView(products);
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
            renderProductsInListView(products);
        }
    });
}

// Variation selection modal
function showVariationSelection(product) {
    const modal = document.getElementById('variationModal');
    const productName = document.getElementById('variationProductName');
    const optionsContainer = document.getElementById('variationOptions');
    
    if (!modal || !productName || !optionsContainer) return;
    
    // Set product name
    productName.textContent = product.name;
    
    // Clear previous options
    optionsContainer.innerHTML = '';
    
    // Add variation options
    product.variations.forEach((variation, index) => {
        const option = document.createElement('button');
        option.className = 'w-full p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 text-left transition-colors';
        option.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <div class="font-medium text-gray-800">${variation.name}</div>
                    <div class="text-sm text-gray-500">${product.name} - ${variation.name}</div>
                </div>
                <div class="text-red-500 font-bold">₹${variation.price.toFixed(2)}</div>
            </div>
        `;
        
        option.addEventListener('click', () => {
            addToCartWithVariation(product, variation);
            closeVariationModal();
        });
        
        optionsContainer.appendChild(option);
    });
    
    // Show modal
    modal.classList.remove('hidden');
}

function closeVariationModal() {
    const modal = document.getElementById('variationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Close modal when clicking outside
document.getElementById('variationModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeVariationModal();
    }
});

// Updated addToCart function to handle variations
function addToCart(productId, productName = '', price = 0, variationName = '') {
    const product = products.find(p => p.id === productId);
    if (!product) {
        console.error("Product not found:", productId);
        return;
    }

    // If no variation name provided but product has variations, show modal
    if (product.variations && product.variations.length > 0 && !variationName) {
        showVariationSelection(product);
        return;
    }

    // Determine final display name
    let displayName = product.name;
    let itemPrice = price || product.price;
    
    if (variationName) {
        displayName = `${product.name} - ${variationName}`;
        const variation = product.variations.find(v => v.name === variationName);
        if (variation) {
            itemPrice = variation.price;
        }
    }

    const existingItem = cart.find(item => 
        item.id === productId && 
        item.variationName === variationName
    );
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            displayName: displayName,
            price: itemPrice,
            quantity: 1,
            variationName: variationName || '',
            imageUrl: product.imageUrl,
            category: product.category
        });
    }

    renderCart();
    updateTotals();
    showNotification(`${displayName} added to cart!`, 'success');
}

// Helper function for adding with variation
function addToCartWithVariation(product, variation) {
    addToCart(product.id, product.name, variation.price, variation.name);
}





