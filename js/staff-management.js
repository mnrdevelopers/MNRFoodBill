document.addEventListener('DOMContentLoaded', function() {
    let staffMembers = [];
    let selectedStaffId = null;
    let restaurantJoinCode = '';
    let userRole = '';
    let restaurantId = '';

    // Check auth and permissions
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // Get user role
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userRole = userData.role;
                restaurantId = userData.restaurantId || user.uid;
                
                if (userRole !== 'owner') {
                    // Redirect staff to dashboard (they shouldn't access this page)
                    showNotification('Access denied. Owners only.', 'error');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 2000);
                    return;
                }
                
                loadStaffData();
                loadJoinCode();
            }
        }
    });

    // Load join code
    async function loadJoinCode() {
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        if (restaurantDoc.exists) {
            const data = restaurantDoc.data();
            restaurantJoinCode = data.joinCode || '';
            document.getElementById('joinCodeDisplay').textContent = restaurantJoinCode;
        }
    }

    // Load staff data
    async function loadStaffData() {
        const querySnapshot = await db.collection('users')
            .where('restaurantId', '==', restaurantId)
            .where('role', '==', 'staff')
            .orderBy('createdAt', 'desc')
            .get();
        
        staffMembers = [];
        querySnapshot.forEach(doc => {
            staffMembers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderStaffTable();
    }

    // Render staff table
    function renderStaffTable() {
        const tbody = document.getElementById('staffTable');
        if (!tbody) return;
        
        if (staffMembers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-gray-500">
                        <i class="fas fa-users text-3xl mb-2"></i>
                        <p>No staff members yet</p>
                        <p class="text-sm mt-2">Click "Add Staff" to invite your first staff member</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        staffMembers.forEach(staff => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-4 px-6">
                    <div class="flex items-center">
                        <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-blue-500"></i>
                        </div>
                        <div>
                            <div class="font-medium text-gray-800">${staff.name || 'Unnamed Staff'}</div>
                            <div class="text-xs text-gray-500">ID: ${staff.id.substring(0, 8)}</div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-6">${staff.email}</td>
                <td class="py-4 px-6">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        Staff
                    </span>
                </td>
                <td class="py-4 px-6">
                    ${staff.createdAt ? staff.createdAt.toDate().toLocaleDateString('en-IN') : 'N/A'}
                </td>
                <td class="py-4 px-6">
                    <span class="px-2 py-1 text-xs rounded-full ${staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${staff.status || 'active'}
                    </span>
                </td>
                <td class="py-4 px-6">
                    <div class="flex space-x-2">
                        <button class="edit-staff text-blue-500 hover:text-blue-700" data-id="${staff.id}" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="reset-password text-yellow-500 hover:text-yellow-700" data-id="${staff.id}" title="Reset Password">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="delete-staff text-red-500 hover:text-red-700" data-id="${staff.id}" title="Remove">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add event listeners
        document.querySelectorAll('.edit-staff').forEach(btn => {
            btn.addEventListener('click', () => openEditStaffModal(btn.dataset.id));
        });

        document.querySelectorAll('.reset-password').forEach(btn => {
            btn.addEventListener('click', () => openResetPasswordModal(btn.dataset.id));
        });

        document.querySelectorAll('.delete-staff').forEach(btn => {
            btn.addEventListener('click', () => openDeleteStaffModal(btn.dataset.id));
        });
    }

    // Modal Functions
    window.closeAddStaffModal = function() {
        document.getElementById('addStaffModal').classList.add('hidden');
        document.getElementById('addStaffForm').reset();
    };

    window.closeEditStaffModal = function() {
        document.getElementById('editStaffModal').classList.add('hidden');
        selectedStaffId = null;
    };

    window.closeResetPasswordModal = function() {
        document.getElementById('resetPasswordModal').classList.add('hidden');
        selectedStaffId = null;
    };

    window.closeDeleteStaffModal = function() {
        document.getElementById('deleteStaffModal').classList.add('hidden');
        selectedStaffId = null;
    };

    function openEditStaffModal(staffId) {
        const staff = staffMembers.find(s => s.id === staffId);
        if (!staff) return;
        
        selectedStaffId = staffId;
        document.getElementById('editStaffId').value = staffId;
        document.getElementById('editStaffName').value = staff.name || '';
        document.getElementById('editStaffEmail').value = staff.email;
        document.getElementById('editStaffStatus').value = staff.status || 'active';
        
        document.getElementById('editStaffModal').classList.remove('hidden');
    }

    function openResetPasswordModal(staffId) {
        const staff = staffMembers.find(s => s.id === staffId);
        if (!staff) return;
        
        selectedStaffId = staffId;
        document.getElementById('resetStaffId').value = staffId;
        document.getElementById('resetPasswordModal').classList.remove('hidden');
    }

    function openDeleteStaffModal(staffId) {
        const staff = staffMembers.find(s => s.id === staffId);
        if (!staff) return;
        
        selectedStaffId = staffId;
        document.getElementById('deleteStaffMessage').textContent = 
            `Are you sure you want to remove ${staff.name || 'this staff member'}?`;
        document.getElementById('deleteStaffModal').classList.remove('hidden');
    }

    // Add Staff Button
    document.getElementById('addStaffBtn').addEventListener('click', function() {
        document.getElementById('addStaffModal').classList.remove('hidden');
    });

    // Copy Join Code
    document.getElementById('copyJoinCode').addEventListener('click', function() {
        navigator.clipboard.writeText(restaurantJoinCode).then(() => {
            showNotification('Join code copied to clipboard!', 'success');
        });
    });

    // Regenerate Join Code
    document.getElementById('regenerateCode').addEventListener('click', async function() {
        if (confirm('Are you sure you want to regenerate the join code? Existing staff will need the new code.')) {
            const newCode = generateJoinCode();
            
            try {
                await db.collection('restaurants').doc(restaurantId).update({
                    joinCode: newCode,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Update all staff users with new join code
                const batch = db.batch();
                staffMembers.forEach(staff => {
                    const staffRef = db.collection('users').doc(staff.id);
                    batch.update(staffRef, { joinCode: newCode });
                });
                await batch.commit();
                
                restaurantJoinCode = newCode;
                document.getElementById('joinCodeDisplay').textContent = newCode;
                showNotification('Join code regenerated successfully!', 'success');
            } catch (error) {
                showNotification('Error regenerating code: ' + error.message, 'error');
            }
        }
    });

    // Add Staff Form
    document.getElementById('addStaffForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('staffName').value.trim();
        const email = document.getElementById('staffEmail').value.trim();
        const password = document.getElementById('staffPassword').value;
        
        try {
            showNotification('Creating staff account...', 'info');
            
            // Note: In production, you should use Firebase Admin SDK via Cloud Functions
            // to create staff accounts securely. This is a simplified version.
            
            // Create auth account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const staffUserId = userCredential.user.uid;
            
            // Add to users collection
            await db.collection('users').doc(staffUserId).set({
                email: email,
                name: name,
                role: 'staff',
                restaurantId: restaurantId,
                joinCode: restaurantJoinCode,
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: auth.currentUser.uid
            });
            
            // Send password reset email
            await auth.sendPasswordResetEmail(email);
            
            showNotification('Staff account created! Password reset email sent.', 'success');
            closeAddStaffModal();
            loadStaffData();
            
            // Sign back in as owner
            const ownerEmail = auth.currentUser.email;
            // You'll need to handle re-authentication properly
            // For now, just reload the page
            window.location.reload();
            
        } catch (error) {
            showNotification('Error creating staff: ' + error.message, 'error');
        }
    });

    // Edit Staff Form
    document.getElementById('editStaffForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const staffId = document.getElementById('editStaffId').value;
        const name = document.getElementById('editStaffName').value.trim();
        const email = document.getElementById('editStaffEmail').value.trim();
        const status = document.getElementById('editStaffStatus').value;
        
        try {
            await db.collection('users').doc(staffId).update({
                name: name,
                email: email,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            showNotification('Staff updated successfully!', 'success');
            closeEditStaffModal();
            loadStaffData();
        } catch (error) {
            showNotification('Error updating staff: ' + error.message, 'error');
        }
    });

    // Reset Password Form
    document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const staffId = document.getElementById('resetStaffId').value;
        const staff = staffMembers.find(s => s.id === staffId);
        
        if (!staff) return;
        
        try {
            // Send password reset email
            await auth.sendPasswordResetEmail(staff.email);
            showNotification('Password reset email sent to staff member.', 'success');
            
            closeResetPasswordModal();
        } catch (error) {
            showNotification('Error resetting password: ' + error.message, 'error');
        }
    });

    // Delete Staff
    document.getElementById('confirmDeleteStaff').addEventListener('click', async function() {
        if (!selectedStaffId) return;
        
        const staff = staffMembers.find(s => s.id === selectedStaffId);
        if (!staff) return;
        
        try {
            // Delete from users collection
            await db.collection('users').doc(selectedStaffId).delete();
            
            // Note: In production, you should also delete the auth account
            // using Firebase Admin SDK via Cloud Functions
            
            showNotification('Staff member removed successfully!', 'success');
            closeDeleteStaffModal();
            loadStaffData();
        } catch (error) {
            showNotification('Error removing staff: ' + error.message, 'error');
        }
    });

    // Helper Functions
    function generateJoinCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    function showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white text-sm font-medium`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
});
