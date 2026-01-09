document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let productToDelete = null;
    let productModal;
    let deleteModal;

    // Initialize Bootstrap Modals
    const productModalElem = document.getElementById('productModal');
    const deleteModalElem = document.getElementById('deleteModal');
    
    if (productModalElem) productModal = new bootstrap.Modal(productModalElem);
    if (deleteModalElem) deleteModal = new bootstrap.Modal(deleteModalElem);

    // Check auth
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadProducts();
        }
    });

    // Load products
    function loadProducts() {
        const user = auth.currentUser;
        db.collection('products')
            .where('restaurantId', '==', user.uid)
            .orderBy('name')
            .get()
            .then(snapshot => {
                products = [];
                snapshot.forEach(doc => {
                    products.push({ id: doc.id, ...doc.data() });
                });
                renderProductsTable();
            });
    }

    // Render products table
    function renderProductsTable() {
        const tbody = document.getElementById('productsTable');
        tbody.innerHTML = '';

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 text-center text-gray-500">
                        <i class="fas fa-box-open text-3xl mb-2"></i>
                        <p>No products found. Add your first product!</p>
                    </td>
                </tr>
            `;
            return;
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-4 px-6">
                    <div class="font-medium text-gray-800">${product.name}</div>
                </td>
                <td class="py-4 px-6">
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${product.category}</span>
                </td>
                <td class="py-4 px-6 font-bold">₹${product.price.toFixed(2)}</td>
                <td class="py-4 px-6 text-gray-600">${product.description || '-'}</td>
                <td class="py-4 px-6">
                    <div class="flex space-x-2">
                        <button class="edit-product text-blue-500 hover:text-blue-700" data-id="${product.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-product text-red-500 hover:text-red-700" data-id="${product.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.edit-product').forEach(button => {
            button.addEventListener('click', function() {
                const productId = this.dataset.id;
                editProduct(productId);
            });
        });

        document.querySelectorAll('.delete-product').forEach(button => {
            button.addEventListener('click', function() {
                const productId = this.dataset.id;
                showDeleteModal(productId);
            });
        });
    }

    // Add product button
    document.getElementById('addProductBtn').addEventListener('click', function() {
        openProductModal();
    });

    // Open product modal
    function openProductModal(product = null) {
        const form = document.getElementById('productForm');
        const title = document.getElementById('modalTitle');
        
        form.reset();
        
        if (product) {
            title.textContent = 'Edit Product';
            document.getElementById('productId').value = product.id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productDescription').value = product.description || '';
        } else {
            title.textContent = 'Add New Product';
            document.getElementById('productId').value = '';
        }
        
        if (productModal) productModal.show();
    }

    // Close product modal
    window.closeProductModal = function() {
        if (productModal) productModal.hide();
    };

    // Edit product
    function editProduct(productId) {
        const product = products.find(p => p.id === productId);
        if (product) {
            openProductModal(product);
        }
    }

    // Show delete modal
    function showDeleteModal(productId) {
        productToDelete = productId;
        if (deleteModal) deleteModal.show();
    }

    // Close delete modal
    window.closeDeleteModal = function() {
        productToDelete = null;
        if (deleteModal) deleteModal.hide();
    };

    // Confirm delete
    document.getElementById('confirmDelete').addEventListener('click', function() {
        if (productToDelete) {
            deleteProduct(productToDelete);
        }
    });

    // Delete product
    function deleteProduct(productId) {
        db.collection('products').doc(productId).delete()
            .then(() => {
                showNotification('Product deleted successfully', 'success');
                products = products.filter(p => p.id !== productId);
                renderProductsTable();
                closeDeleteModal();
            })
            .catch(error => {
                showNotification('Error deleting product: ' + error.message, 'error');
            });
    }

    // Product form submission
    document.getElementById('productForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const user = auth.currentUser;
        const productId = document.getElementById('productId').value;
        const productData = {
            name: document.getElementById('productName').value.trim(),
            category: document.getElementById('productCategory').value,
            price: parseFloat(document.getElementById('productPrice').value),
            description: document.getElementById('productDescription').value.trim(),
            restaurantId: user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!productData.name || isNaN(productData.price) || productData.price < 0) {
            showNotification('Please fill all required fields correctly', 'error');
            return;
        }

        if (productId) {
            // Update existing product
            db.collection('products').doc(productId).update(productData)
                .then(() => {
                    showNotification('Product updated successfully', 'success');
                    loadProducts();
                    closeProductModal();
                })
                .catch(error => {
                    showNotification('Error updating product: ' + error.message, 'error');
                });
        } else {
            // Add new product
            productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            
            db.collection('products').add(productData)
                .then(() => {
                    showNotification('Product added successfully', 'success');
                    loadProducts();
                    closeProductModal();
                })
                .catch(error => {
                    showNotification('Error adding product: ' + error.message, 'error');
                });
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        auth.signOut().then(() => {
            window.location.href = 'index.html';
        });
    });

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if(notification.parentNode) notification.parentNode.removeChild(notification);
            }, 300);
        }, 3000);
    }
});
