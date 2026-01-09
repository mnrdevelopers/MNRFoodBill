document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let productToDelete = null;
    let currentUser = null;

    // Check auth and setup
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            currentUser = user;
            loadUserInfo();
            setupLogoutButton();
            loadProducts();
        }
    });
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Add product button
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', function() {
            openProductModal();
        });
    }

    // Product form submission
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveProduct();
        });
    }

    // Confirm delete
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (productToDelete) {
                deleteProduct(productToDelete);
            }
        });
    }
}

function loadUserInfo() {
    if (!currentUser) return;
    
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = currentUser.email;
    }
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

function loadProducts() {
    if (!currentUser) return;
    
    db.collection('products')
        .where('restaurantId', '==', currentUser.uid)
        .orderBy('name')
        .get()
        .then(snapshot => {
            products = [];
            snapshot.forEach(doc => {
                products.push({ id: doc.id, ...doc.data() });
            });
            renderProductsTable();
        })
        .catch(error => {
            console.error("Error loading products:", error);
            showNotification('Error loading products', 'danger');
        });
}

function renderProductsTable() {
    const tbody = document.getElementById('productsTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-5 text-muted">
                    <i class="fas fa-box-open fs-1 mb-3 d-block"></i>
                    <p>No products found. Add your first product!</p>
                </td>
            </tr>
        `;
        return;
    }

    products.forEach(product => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="fw-medium">${product.name}</div>
            </td>
            <td>
                <span class="badge bg-primary">${product.category}</span>
            </td>
            <td class="fw-bold">₹${product.price ? product.price.toFixed(2) : '0.00'}</td>
            <td class="text-muted">${product.description || '-'}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-product" data-id="${product.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-product" data-id="${product.id}" title="Delete">
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

function openProductModal(product = null) {
    const modalElement = document.getElementById('productModal');
    if (!modalElement) return;
    
    const modal = new bootstrap.Modal(modalElement);
    const form = document.getElementById('productForm');
    const title = document.getElementById('modalTitle');
    
    if (form) form.reset();
    
    if (product) {
        if (title) title.textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productPrice').value = product.price || 0;
        document.getElementById('productDescription').value = product.description || '';
    } else {
        if (title) title.textContent = 'Add New Product';
        const productIdInput = document.getElementById('productId');
        if (productIdInput) productIdInput.value = '';
    }
    
    modal.show();
}

function closeProductModal() {
    const modalElement = document.getElementById('productModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
}

function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        openProductModal(product);
    }
}

function showDeleteModal(productId) {
    productToDelete = productId;
    const modalElement = document.getElementById('deleteModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

function closeDeleteModal() {
    productToDelete = null;
    const modalElement = document.getElementById('deleteModal');
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
}

function deleteProduct(productId) {
    if (!productId) return;
    
    db.collection('products').doc(productId).delete()
        .then(() => {
            showNotification('Product deleted successfully', 'success');
            products = products.filter(p => p.id !== productId);
            renderProductsTable();
            closeDeleteModal();
        })
        .catch(error => {
            console.error("Error deleting product:", error);
            showNotification('Error deleting product: ' + error.message, 'danger');
        });
}

function saveProduct() {
    if (!currentUser) return;
    
    const productId = document.getElementById('productId')?.value;
    const productName = document.getElementById('productName')?.value;
    const productPrice = document.getElementById('productPrice')?.value;
    
    if (!productName || !productPrice) {
        showNotification('Please fill all required fields correctly', 'danger');
        return;
    }

    const productData = {
        name: productName.trim(),
        category: document.getElementById('productCategory').value,
        price: parseFloat(productPrice),
        description: document.getElementById('productDescription')?.value.trim() || '',
        restaurantId: currentUser.uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (productData.price < 0) {
        showNotification('Price cannot be negative', 'danger');
        return;
    }

    if (productId) {
        // Update existing product
        db.collection('products').doc(productId).update(productData)
            .then(() => {
                showNotification('Product updated successfully', 'success');
                loadProducts(); // Reload products
                closeProductModal();
            })
            .catch(error => {
                console.error("Error updating product:", error);
                showNotification('Error updating product: ' + error.message, 'danger');
            });
    } else {
        // Add new product
        productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        
        db.collection('products').add(productData)
            .then(() => {
                showNotification('Product added successfully', 'success');
                loadProducts(); // Reload products
                closeProductModal();
            })
            .catch(error => {
                console.error("Error adding product:", error);
                showNotification('Error adding product: ' + error.message, 'danger');
            });
    }
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

// Make functions available globally
window.closeProductModal = closeProductModal;
window.closeDeleteModal = closeDeleteModal;
