let isStaff = false;

auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            isStaff = userData.role === 'staff';
        }
        loadProducts();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let productToDelete = null;

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
        if (!user) return;

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
            })
            .catch(error => {
                console.error("Error loading products:", error);
            });
    }

    // Render products table
    function renderProductsTable() {
        const tbody = document.getElementById('productsTable');
        if (!tbody) return;
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
            // Safe check for getProductImage availability
            const imageUrl = typeof getProductImage === 'function' ? getProductImage(product.name) : null;
            
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-4 px-6">
                    <div class="flex items-center space-x-3">
                        ${imageUrl ? 
                            `<img src="${imageUrl}" alt="${product.name}" 
                                  class="w-10 h-10 object-cover rounded"
                                  onerror="this.style.display='none'">` : 
                            `<div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                                <i class="fas fa-hamburger text-gray-400"></i>
                             </div>`
                        }
                        <div class="font-medium text-gray-800">${product.name}</div>
                    </div>
                </td>
                <td class="py-4 px-6">
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${product.category}</span>
                </td>
                <td class="py-4 px-6 font-bold">₹${(product.price || 0).toFixed(2)}</td>
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
            <td class="py-4 px-6">
                <div class="flex space-x-2">
                    ${!isStaff ? `
                        <button class="edit-product text-blue-500 hover:text-blue-700" data-id="${product.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-product text-red-500 hover:text-red-700" data-id="${product.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : '<span class="text-gray-400 text-sm">View only</span>'}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

        // Add event listeners
        document.querySelectorAll('.edit-product').forEach(button => {
            button.addEventListener('click', function() {
                editProduct(this.dataset.id);
            });
        });

        document.querySelectorAll('.delete-product').forEach(button => {
            button.addEventListener('click', function() {
                showDeleteModal(this.dataset.id);
            });
        });
    }

    // Modal controls
    const addProductBtn = document.getElementById('addProductBtn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => openProductModal());
    }

    function openProductModal(product = null) {
        const modal = document.getElementById('productModal');
        const form = document.getElementById('productForm');
        const title = document.getElementById('modalTitle');
        
        if (!form) return;
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
        
        modal.classList.remove('hidden');
    }

    window.closeProductModal = function() {
        document.getElementById('productModal').classList.add('hidden');
    };

    function editProduct(productId) {
        const product = products.find(p => p.id === productId);
        if (product) openProductModal(product);
    }

    function showDeleteModal(productId) {
        productToDelete = productId;
        document.getElementById('deleteModal').classList.remove('hidden');
    }

    window.closeDeleteModal = function() {
        productToDelete = null;
        document.getElementById('deleteModal').classList.add('hidden');
    };

    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function() {
            if (productToDelete) {
                db.collection('products').doc(productToDelete).delete()
                    .then(() => {
                        showNotification('Product deleted', 'success');
                        products = products.filter(p => p.id !== productToDelete);
                        renderProductsTable();
                        closeDeleteModal();
                    });
            }
        });
    }

    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async function(e) {
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

            try {
                if (productId) {
                    await db.collection('products').doc(productId).update(productData);
                } else {
                    productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('products').add(productData);
                }
                showNotification('Product saved', 'success');
                loadProducts();
                closeProductModal();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    function showNotification(message, type) {
        const n = document.createElement('div');
        n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }
});

