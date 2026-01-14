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
        await loadProducts();
        refreshResponsiveTables();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    let products = [];
    let productToDelete = null;

    // Check auth
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            await loadProducts();
            refreshResponsiveTables();
        }
    });

    // Load products - now returns a Promise
    function loadProducts() {
        return new Promise((resolve, reject) => {
            const user = auth.currentUser;
            if (!user) {
                reject("No user logged in");
                return;
            }

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
                    resolve(products);
                })
                .catch(error => {
                    console.error("Error loading products:", error);
                    reject(error);
                });
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
                    <td colspan="7" class="py-8 text-center text-gray-500">
                        <i class="fas fa-box-open text-3xl mb-2"></i>
                        <p>No products found. Add your first product!</p>
                    </td>
                </tr>
            `;
            return;
        }

        products.forEach(product => {
            const imageUrl = product.imageUrl;
            const foodTypeColor = product.foodType === 'veg' ? 'text-green-500' : 'text-red-500';
            const foodTypeIcon = product.foodType === 'veg' ? 'leaf' : 'drumstick-bite';
            
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
                                <i class="fas fa-utensils text-gray-400"></i>
                             </div>`
                        }
                        <div>
                            <div class="font-medium text-gray-800">${product.name}</div>
                            <div class="flex items-center text-xs text-gray-500">
                                <i class="fas fa-${foodTypeIcon} ${foodTypeColor} mr-1"></i>
                                ${product.foodType === 'veg' ? 'Veg' : 'Non-Veg'}
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6">
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${product.category}</span>
                </td>
                <td class="py-4 px-6">
                    <div class="font-bold">₹${(product.price || 0).toFixed(2)}</div>
                </td>
                <td class="py-4 px-6 text-sm text-gray-600">
                    ${product.baseQuantity || 1} ${product.quantityType || 'plate'}
                </td>
                <td class="py-4 px-6">
                    <span class="px-2 py-1 ${product.foodType === 'veg' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} rounded-full text-xs">
                        ${product.foodType === 'veg' ? 'Veg' : 'Non-Veg'}
                    </span>
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
        if (product) {
            openProductModal(product);
            
            // Set food type radio button
            const foodTypeRadio = document.querySelector(`input[name="foodType"][value="${product.foodType || 'veg'}"]`);
            if (foodTypeRadio) foodTypeRadio.checked = true;
            
            // Set other fields
            document.getElementById('quantityType').value = product.quantityType || 'plate';
            document.getElementById('baseQuantity').value = product.baseQuantity || 1;
            
            // Load existing image
            if (product.imageUrl) {
                window.ImageUpload?.setImageForEdit(product.imageUrl);
            }
        }
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
        confirmDeleteBtn.addEventListener('click', async function() {
            if (productToDelete) {
                try {
                    await db.collection('products').doc(productToDelete).delete();
                    showNotification('Product deleted', 'success');
                    products = products.filter(p => p.id !== productToDelete);
                    renderProductsTable();
                    refreshResponsiveTables();
                    closeDeleteModal();
                } catch (error) {
                    showNotification(error.message, 'error');
                }
            }
        });
    }

    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = auth.currentUser;
            const productId = document.getElementById('productId').value;
            
            // Get uploaded image URL
            const uploadedImage = window.ImageUpload?.getUploadedImage();
            const imageUrl = uploadedImage?.url || '';
            
            // Get food type
            const foodType = document.querySelector('input[name="foodType"]:checked')?.value || 'veg';
            
            const productData = {
                name: document.getElementById('productName').value.trim(),
                category: document.getElementById('productCategory').value,
                foodType: foodType,
                quantityType: document.getElementById('quantityType').value,
                baseQuantity: parseFloat(document.getElementById('baseQuantity').value) || 1,
                price: parseFloat(document.getElementById('productPrice').value),
                description: document.getElementById('productDescription').value.trim(),
                restaurantId: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add image URL if available
            if (imageUrl) {
                productData.imageUrl = imageUrl;
                productData.imageThumb = uploadedImage.thumb;
            }
            
            // If editing and image was removed, clear image field
            if (productId && !imageUrl) {
                const existingProduct = products.find(p => p.id === productId);
                if (existingProduct?.imageUrl) {
                    productData.imageUrl = firebase.firestore.FieldValue.delete();
                    productData.imageThumb = firebase.firestore.FieldValue.delete();
                }
            }

            try {
                if (productId) {
                    await db.collection('products').doc(productId).update(productData);
                } else {
                    productData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('products').add(productData);
                }
                showNotification('Product saved', 'success');
                await loadProducts();
                refreshResponsiveTables();
                closeProductModal();
                window.ImageUpload?.resetImageUpload();
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

    // Make loadProducts globally accessible if needed
    window.loadProducts = loadProducts;
});

// After loading products in products.js, refresh responsive tables
function refreshResponsiveTables() {
    if (window.ResponsiveTables && window.ResponsiveTables.refresh) {
        setTimeout(() => {
            window.ResponsiveTables.refresh();
        }, 100);
    }
}

// Make refreshResponsiveTables globally accessible
window.refreshResponsiveTables = refreshResponsiveTables;

// Add to products.js (at the end or after DOMContentLoaded)
window.editProduct = function(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        openProductModal(product);
        
        // Set food type radio button
        const foodTypeRadio = document.querySelector(`input[name="foodType"][value="${product.foodType || 'veg'}"]`);
        if (foodTypeRadio) foodTypeRadio.checked = true;
        
        // Set other fields
        document.getElementById('quantityType').value = product.quantityType || 'plate';
        document.getElementById('baseQuantity').value = product.baseQuantity || 1;
        
        // Load existing image
        if (product.imageUrl && window.ImageUpload?.setImageForEdit) {
            window.ImageUpload.setImageForEdit(product.imageUrl);
        }
    }
};

window.showDeleteModal = function(productId) {
    productToDelete = productId;
    document.getElementById('deleteModal').classList.remove('hidden');
};

    // Make functions globally accessible
    window.editProduct = editProduct;
    window.showDeleteModal = showDeleteModal;
    
    // Also expose the functions
    if (!window.ProductsManager) {
        window.ProductsManager = {};
    }
    window.ProductsManager.editProduct = editProduct;
    window.ProductsManager.showDeleteModal = showDeleteModal;


