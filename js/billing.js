document.addEventListener('DOMContentLoaded', function() {
    let cart = [];
    let products = [];
    let restaurantSettings = {};

    // Check auth
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadRestaurantSettings();
            loadProducts();
        }
    });

    // Load restaurant settings
    function loadRestaurantSettings() {
        const user = auth.currentUser;
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    restaurantSettings = doc.data().settings || {
                        gstRate: 18,
                        serviceCharge: 5,
                        currency: '₹'
                    };
                    updateTotals();
                }
            });
    }

    // Load products
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

    // Render categories
    function renderCategories(categories) {
        const container = document.querySelector('.category-tab.active').parentElement;
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
        const searchTerm = document.getElementById('productSearch').value.toLowerCase();
        let filtered = products;
        
        if (category !== 'all') {
            filtered = filtered.filter(p => p.category === category);
        }
        
        if (searchTerm) {
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.description?.toLowerCase().includes(searchTerm)
            );
        }
        
        renderProducts(filtered);
    }

    // Render products
    function renderProducts(productsToShow) {
        const container = document.getElementById('productsGrid');
        container.innerHTML = '';

        productsToShow.forEach(product => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer';
            card.innerHTML = `
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <h3 class="font-bold text-gray-800">${product.name}</h3>
                        <p class="text-sm text-gray-600">${product.description || ''}</p>
                    </div>
                    <span class="font-bold text-red-500">${restaurantSettings.currency}${product.price}</span>
                </div>
                <div class="flex items-center justify-between mt-3">
                    <span class="text-sm text-gray-500">${product.category}</span>
                    <button class="add-to-cart bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600" 
                            data-id="${product.id}">
                        <i class="fas fa-plus mr-1"></i> Add
                    </button>
                </div>
            `;
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
                price: product.price,
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
        
        if (cart.length === 0) {
            container.innerHTML = '';
            container.appendChild(emptyCart);
            emptyCart.classList.remove('hidden');
            return;
        }

        emptyCart.classList.add('hidden');
        container.innerHTML = '';

        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            const itemElement = document.createElement('div');
            itemElement.className = 'flex items-center justify-between py-2 border-b';
            itemElement.innerHTML = `
                <div class="flex-1">
                    <h4 class="font-medium text-gray-800">${item.name}</h4>
                    <p class="text-sm text-gray-600">${restaurantSettings.currency}${item.price} × ${item.quantity}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-bold">${restaurantSettings.currency}${itemTotal.toFixed(2)}</span>
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
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gstAmount = subtotal * (restaurantSettings.gstRate / 100);
        const serviceCharge = subtotal * (restaurantSettings.serviceCharge / 100);
        const total = subtotal + gstAmount + serviceCharge;

        document.getElementById('subtotal').textContent = `${restaurantSettings.currency}${subtotal.toFixed(2)}`;
        document.getElementById('gstAmount').textContent = `${restaurantSettings.currency}${gstAmount.toFixed(2)}`;
        document.getElementById('serviceCharge').textContent = `${restaurantSettings.currency}${serviceCharge.toFixed(2)}`;
        document.getElementById('totalAmount').textContent = `${restaurantSettings.currency}${total.toFixed(2)}`;
    }

    // Clear cart
    document.getElementById('clearCart').addEventListener('click', function() {
        if (cart.length === 0) return;
        
        if (confirm('Are you sure you want to clear all items from the cart?')) {
            cart = [];
            renderCart();
            updateTotals();
            showNotification('Cart cleared', 'info');
        }
    });

    // Save order
    document.getElementById('saveOrder').addEventListener('click', function() {
        if (cart.length === 0) {
            showNotification('Please add items to cart first', 'error');
            return;
        }

        const user = auth.currentUser;
        const orderData = {
            restaurantId: user.uid,
            items: cart,
            customerName: document.getElementById('customerName').value || 'Walk-in Customer',
            customerPhone: document.getElementById('customerPhone').value || '',
            subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            gstRate: restaurantSettings.gstRate,
            serviceChargeRate: restaurantSettings.serviceCharge,
            total: parseFloat(document.getElementById('totalAmount').textContent.replace(restaurantSettings.currency, '')),
            status: 'saved',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection('orders').add(orderData)
            .then(docRef => {
                showNotification('Order saved successfully!', 'success');
                document.getElementById('customerName').value = '';
                document.getElementById('customerPhone').value = '';
            })
            .catch(error => {
                showNotification('Error saving order: ' + error.message, 'error');
            });
    });

    // Print bill
    document.getElementById('printBill').addEventListener('click', function() {
        if (cart.length === 0) {
            showNotification('Please add items to cart first', 'error');
            return;
        }

        prepareReceipt();
        document.getElementById('printModal').classList.remove('hidden');
    });

    // Search functionality
    document.getElementById('productSearch').addEventListener('input', function() {
        filterProducts(document.querySelector('.category-tab.active').dataset.category);
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    function showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
});