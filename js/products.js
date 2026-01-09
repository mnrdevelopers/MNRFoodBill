document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let productToDelete = null;

    // Check auth and setup
    setupAuthAndLogout();
    
    // Load products
    loadProducts();
    
    // Setup event listeners
    setupEventListeners();
});

function setupAuthAndLogout() {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadUserInfo();
            setupLogoutButton();
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
            <td class="fw-bold">₹${product.price.toFixed(2)}</td>
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

function openProductModal(product = null) {
    const modal = new bootstrap.Modal(document.getElementById('productModal'));
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
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
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
    db.collection('products').doc(productId).delete()
        .then(() => {
            showNotification('Product deleted successfully', 'success');
            products = products.filter(p => p.id !== productId);
            renderProductsTable();
            closeDeleteModal();
        })
        .catch(error => {
            showNotification('Error deleting product: ' + error.message, 'danger');
        });
}

function saveProduct() {
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

    if (!productData.name || productData.price < 0) {
        showNotification('Please fill all required fields correctly', 'danger');
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
