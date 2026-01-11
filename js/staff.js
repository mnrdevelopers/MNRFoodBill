// js/staff.js - Staff Management with proper cleanup
document.addEventListener('DOMContentLoaded', function() {
    const staffList = document.getElementById('staffList');
    const addStaffForm = document.getElementById('addStaffForm');
    let restaurantId = null;

    auth.onAuthStateChanged(user => {
        if (user) {
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    if (userData.role !== 'owner') {
                        window.location.href = 'dashboard.html';
                        return;
                    }
                    restaurantId = userData.restaurantId || user.uid;
                    loadStaffMembers();
                }
            });
        }
    });

    function loadStaffMembers() {
        if (!restaurantId) return;

        db.collection('users')
            .where('restaurantId', '==', restaurantId)
            .where('role', '==', 'staff')
            .onSnapshot(snapshot => {
                staffList.innerHTML = '';
                if (snapshot.empty) {
                    staffList.innerHTML = `
                        <tr>
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">No staff members added yet.</td>
                        </tr>
                    `;
                    return;
                }

                snapshot.forEach(doc => {
                    const staff = doc.data();
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-gray-50 border-b border-gray-100';
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900">${staff.name}</div>
                            <div class="text-xs text-gray-500">${staff.email}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="flex flex-wrap gap-1">
                                ${(staff.permissions || []).map(p => `
                                    <span class="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs capitalize">${p}</span>
                                `).join('')}
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Active</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button onclick="deleteStaff('${doc.id}', '${staff.email}')" class="text-red-600 hover:text-red-900">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    staffList.appendChild(tr);
                });
            });
    }

    if (addStaffForm) {
        addStaffForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('staffName').value.trim();
            const email = document.getElementById('staffEmail').value.trim().toLowerCase();
            const password = document.getElementById('staffPassword').value;
            const permissions = Array.from(document.querySelectorAll('input[name="permissions"]:checked')).map(cb => cb.value);

            if (permissions.length === 0) {
                showToast('Please select at least one permission', 'error');
                return;
            }

            const submitBtn = addStaffForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Adding...';

            try {
                // 1. Check if user already exists in Firestore users collection
                const existingUserQuery = await db.collection('users').where('email', '==', email).get();
                
                if (!existingUserQuery.empty) {
                    // Check if this user belongs to the same restaurant but was "removed" (role changed or something)
                    // Or if they exist as a standalone user.
                    throw new Error("A user with this email already exists in the system.");
                }

                // 2. Create the user in Firebase Auth
                // Note: This requires the owner to be logged in. 
                // Since Firebase Auth doesn't allow creating another user while logged in without Admin SDK,
                // we'll use a secondary firebase app instance or suggest using the Join Code system.
                
                // RECOMMENDED APPROACH: For client-side only, we use the Join Code system 
                // where staff registers themselves using a code, OR the owner creates a placeholder.
                
                // If you are using a Cloud Function to create users, call it here.
                // Assuming client-side creation for this POC:
                const tempApp = firebase.initializeApp(firebaseConfig, "TempApp");
                const userCredential = await tempApp.auth().createUserWithEmailAndPassword(email, password);
                const newUser = userCredential.user;
                
                await db.collection('users').doc(newUser.uid).set({
                    name: name,
                    email: email,
                    role: 'staff',
                    restaurantId: restaurantId,
                    permissions: permissions,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await tempApp.auth().signOut();
                await tempApp.delete();

                showToast('Staff added successfully!', 'success');
                addStaffForm.reset();
                closeModal('addStaffModal');
            } catch (error) {
                console.error("Error adding staff:", error);
                showToast(error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Add Staff Member';
            }
        });
    }
});

async function deleteStaff(staffId, email) {
    if (!confirm(`Are you sure you want to remove ${email}? They will lose all access.`)) return;

    try {
        // To truly "re-add" later without "Already exists" errors:
        // 1. Remove from Firestore
        await db.collection('users').doc(staffId).delete();
        
        // Note: We cannot delete the user from Firebase Auth from the client side 
        // without the Admin SDK or the user being logged in.
        // FIX: Instead of checking Auth, we check Firestore in the 'add' logic.
        // If the user is deleted from Firestore, the owner can "re-add" them 
        // but the Auth account will still technically exist.
        
        showToast('Staff removed successfully', 'success');
    } catch (error) {
        console.error("Error deleting staff:", error);
        showToast('Failed to remove staff', 'error');
    }
}

function showToast(message, type = 'success') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white z-50 transition-opacity duration-500 ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('hidden');
}
