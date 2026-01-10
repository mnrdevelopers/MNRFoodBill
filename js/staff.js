/**
 * js/staff.js
 * Logic for managing staff accounts and permissions
 */

let currentRestaurantId = null;
let editingStaffId = null;

document.addEventListener('DOMContentLoaded', () => {
    const staffTableBody = document.getElementById('staffTableBody');
    const staffForm = document.getElementById('staffForm');
    const addStaffBtn = document.getElementById('addStaffBtn');
    const staffModal = document.getElementById('staffModal');

    auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'owner') {
            currentRestaurantId = userDoc.data().restaurantId;
            loadStaff();
        } else {
            window.location.href = 'dashboard.html';
        }
    });

    function loadStaff() {
        db.collection('users')
            .where('restaurantId', '==', currentRestaurantId)
            .where('role', '==', 'staff')
            .onSnapshot(snapshot => {
                staffTableBody.innerHTML = '';
                if (snapshot.empty) {
                    staffTableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-gray-400">No staff accounts created yet.</td></tr>';
                    return;
                }

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const perms = data.permissions || [];
                    const row = `
                        <tr class="hover:bg-gray-50">
                            <td class="px-6 py-4">
                                <div class="font-bold text-gray-800">${data.name}</div>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-600">${data.email}</td>
                            <td class="px-6 py-4">
                                <div class="flex flex-wrap gap-1">
                                    ${perms.map(p => `<span class="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">${p}</span>`).join('')}
                                </div>
                            </td>
                            <td class="px-6 py-4 text-right">
                                <button onclick="editStaff('${doc.id}')" class="text-blue-500 hover:text-blue-700 mr-3"><i class="fas fa-edit"></i></button>
                                <button onclick="deleteStaff('${doc.id}')" class="text-red-400 hover:text-red-600"><i class="fas fa-trash"></i></button>
                            </td>
                        </tr>
                    `;
                    staffTableBody.innerHTML += row;
                });
            });
    }

    addStaffBtn.onclick = () => {
        editingStaffId = null;
        staffForm.reset();
        document.getElementById('modalTitle').textContent = 'Add New Staff';
        document.getElementById('passwordSection').classList.remove('hidden');
        document.getElementById('staffEmail').disabled = false;
        staffModal.classList.remove('hidden');
    };

    staffForm.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('staffName').value;
        const email = document.getElementById('staffEmail').value;
        const password = document.getElementById('staffPassword').value;
        const perms = Array.from(document.querySelectorAll('input[name="permissions"]:checked')).map(el => el.value);

        try {
            if (editingStaffId) {
                // Update Existing
                await db.collection('users').doc(editingStaffId).update({
                    name,
                    permissions: perms
                });
            } else {
                // Add New (Note: Firebase Auth creation requires a special approach to avoid logging out the owner)
                // In production, this should be done via Firebase Cloud Functions.
                // Here we use a temporary secondary app instance.
                const tempApp = firebase.initializeApp(firebaseConfig, "SecondaryApp");
                const tempAuth = tempApp.auth();
                
                const userCredential = await tempAuth.createUserWithEmailAndPassword(email, password);
                const uid = userCredential.user.uid;
                
                await db.collection('users').doc(uid).set({
                    name,
                    email,
                    role: 'staff',
                    restaurantId: currentRestaurantId,
                    permissions: perms,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                await tempAuth.signOut();
                await tempApp.delete();
            }
            closeModal();
            alert('Staff member saved successfully.');
        } catch (error) {
            alert(error.message);
        }
    };

    window.closeModal = () => staffModal.classList.add('hidden');

    window.editStaff = async (id) => {
        editingStaffId = id;
        const doc = await db.collection('users').doc(id).get();
        const data = doc.data();
        
        document.getElementById('staffName').value = data.name;
        document.getElementById('staffEmail').value = data.email;
        document.getElementById('staffEmail').disabled = true;
        document.getElementById('passwordSection').classList.add('hidden');
        document.getElementById('modalTitle').textContent = 'Edit Staff Permissions';
        
        document.querySelectorAll('input[name="permissions"]').forEach(el => {
            el.checked = data.permissions.includes(el.value);
        });
        
        staffModal.classList.remove('hidden');
    };

    window.deleteStaff = async (id) => {
        if (confirm('Are you sure you want to remove this staff member?')) {
            await db.collection('users').doc(id).delete();
        }
    };
});
