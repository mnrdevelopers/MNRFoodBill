document.addEventListener('DOMContentLoaded', function() {
    const staffTable = document.getElementById('staffTable');
    const staffForm = document.getElementById('staffForm');
    const addStaffBtn = document.getElementById('addStaffBtn');
    const staffModal = document.getElementById('staffModal');
    
    let currentRestaurantId = null;
    let isEditing = false;
    let editingStaffId = null;

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Only owners can manage staff
        db.collection('users').doc(user.uid).get().then(doc => {
            if (doc.exists && doc.data().role !== 'owner') {
                window.location.href = 'dashboard.html';
                return;
            }
            currentRestaurantId = doc.data().restaurantId;
            loadStaffList();
        });
    });

    function loadStaffList() {
        if (!currentRestaurantId) return;

        db.collection('users')
            .where('restaurantId', '==', currentRestaurantId)
            .where('role', '==', 'staff')
            .onSnapshot(snapshot => {
                staffTable.innerHTML = '';
                if (snapshot.empty) {
                    staffTable.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-gray-400 italic">No staff members found.</td></tr>';
                    return;
                }

                snapshot.forEach(doc => {
                    const staff = doc.data();
                    const permissions = staff.permissions || [];
                    
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 transition-colors';
                    row.innerHTML = `
                        <td class="py-4 px-6">
                            <div class="flex items-center">
                                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mr-3">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-gray-800">${staff.name}</p>
                                    <p class="text-xs text-gray-500">${staff.email}</p>
                                </div>
                            </div>
                        </td>
                        <td class="py-4 px-6">
                            <span class="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-md tracking-wider">Active</span>
                        </td>
                        <td class="py-4 px-6">
                            <div class="flex flex-wrap gap-1">
                                ${permissions.map(p => `<span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200 capitalize">${p}</span>`).join('') || '<span class="text-gray-400 text-xs">No access</span>'}
                            </div>
                        </td>
                        <td class="py-4 px-6">
                            <div class="flex space-x-3">
                                <button onclick="editStaff('${doc.id}')" class="text-blue-500 hover:text-blue-700" title="Edit Permissions">
                                    <i class="fas fa-shield-alt"></i>
                                </button>
                                <button onclick="deleteStaff('${doc.id}')" class="text-red-400 hover:text-red-600" title="Remove Staff">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    staffTable.appendChild(row);
                });
            });
    }

    if (addStaffBtn) {
        addStaffBtn.addEventListener('click', () => {
            isEditing = false;
            editingStaffId = null;
            document.getElementById('staffModalTitle').textContent = 'Add New Staff';
            document.getElementById('passwordField').classList.remove('hidden');
            document.getElementById('staffEmail').disabled = false;
            staffForm.reset();
            staffModal.classList.remove('hidden');
        });
    }

    staffForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('saveStaffBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

        const name = document.getElementById('staffName').value.trim();
        const email = document.getElementById('staffEmail').value.trim();
        const password = document.getElementById('staffPassword').value;
        const selectedPermissions = Array.from(document.querySelectorAll('input[name="permission"]:checked')).map(cb => cb.value);

        try {
            if (isEditing) {
                // Update permissions for existing staff
                await db.collection('users').doc(editingStaffId).update({
                    name: name,
                    permissions: selectedPermissions,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showNotification('Staff permissions updated!', 'success');
            } else {
                // To create a new user without logging out the owner, we use a cloud function or 
                // perform a secondary login approach. Here we use a simpler approach: 
                // Use a temporary firebase app instance to create the user.
                
                const tempApp = firebase.initializeApp(firebaseConfig, 'tempApp');
                const tempAuth = tempApp.auth();
                
                const userCredential = await tempAuth.createUserWithEmailAndPassword(email, password);
                const newStaffUid = userCredential.user.uid;

                await db.collection('users').doc(newStaffUid).set({
                    name: name,
                    email: email,
                    role: 'staff',
                    restaurantId: currentRestaurantId,
                    permissions: selectedPermissions,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await tempAuth.signOut();
                await tempApp.delete();
                
                showNotification('Staff account created successfully!', 'success');
            }
            closeStaffModal();
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save Staff';
        }
    });

    window.editStaff = async (id) => {
        isEditing = true;
        editingStaffId = id;
        document.getElementById('staffModalTitle').textContent = 'Update Permissions';
        document.getElementById('passwordField').classList.add('hidden');
        document.getElementById('staffEmail').disabled = true;

        const doc = await db.collection('users').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('staffName').value = data.name;
            document.getElementById('staffEmail').value = data.email;
            
            // Clear checks
            document.querySelectorAll('input[name="permission"]').forEach(cb => cb.checked = false);
            
            // Apply checks
            (data.permissions || []).forEach(p => {
                const cb = document.querySelector(`input[value="${p}"]`);
                if (cb) cb.checked = true;
            });
            
            staffModal.classList.remove('hidden');
        }
    };

    window.deleteStaff = (id) => {
        if (confirm('Are you sure you want to remove this staff member? They will lose access immediately.')) {
            // Note: This only deletes from Firestore. In production, you'd also delete from Auth via Cloud Function.
            db.collection('users').doc(id).delete()
                .then(() => showNotification('Staff member removed', 'success'))
                .catch(err => showNotification(err.message, 'error'));
        }
    };

    window.closeStaffModal = () => {
        staffModal.classList.add('hidden');
    };

    function showNotification(message, type) {
        const n = document.createElement('div');
        n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[9999] text-white text-sm font-medium transition-all duration-300 ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
        n.textContent = message;
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.opacity = '0';
            n.style.transform = 'translateY(-20px)';
            setTimeout(() => n.remove(), 300);
        }, 3000);
    }
});
