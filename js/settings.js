document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settingsForm');
    const passwordForm = document.getElementById('passwordForm');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const reauthForm = document.getElementById('reauthForm');
    
    let pendingAction = null;

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadSettings();
        }
    });

    async function loadSettings() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const resDoc = await db.collection('restaurants').doc(user.uid).get();
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (resDoc.exists) {
                const data = resDoc.data();
                const settings = data.settings || {};
                
                // Restaurant info
                if (document.getElementById('resName')) document.getElementById('resName').value = data.name || '';
                if (document.getElementById('resAddress')) document.getElementById('resAddress').value = data.address || '';
                if (document.getElementById('resPhone')) document.getElementById('resPhone').value = data.phone || '';
                
                // Tax settings
                if (document.getElementById('resGst')) document.getElementById('resGst').value = settings.gstRate || 0;
                if (document.getElementById('resService')) document.getElementById('resService').value = settings.serviceCharge || 0;
                if (document.getElementById('resGSTIN')) document.getElementById('resGSTIN').value = settings.gstin || '';
                if (document.getElementById('resFSSAI')) document.getElementById('resFSSAI').value = settings.fssai || '';
                
                // Owner info (can come from restaurant or users doc)
                if (document.getElementById('ownerName')) document.getElementById('ownerName').value = data.ownerName || '';
                if (document.getElementById('ownerPhone')) document.getElementById('ownerPhone').value = data.ownerPhone || data.phone || '';
            }
            
            // Fallback owner info check from users collection
            if (userDoc.exists && !document.getElementById('ownerName').value) {
                const userData = userDoc.data();
                document.getElementById('ownerName').value = userData.name || '';
                document.getElementById('ownerPhone').value = userData.phone || '';
            }

        } catch (error) {
            console.error("Error loading settings:", error);
            showNotification('Failed to load settings', 'error');
        }
    }

    if (settingsForm) {
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = auth.currentUser;
            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

            const ownerName = document.getElementById('ownerName').value.trim();
            const ownerPhone = document.getElementById('ownerPhone').value.trim();

            const updatedData = {
                name: document.getElementById('resName').value.trim(),
                ownerName: ownerName,
                ownerPhone: ownerPhone,
                address: document.getElementById('resAddress').value.trim(),
                phone: document.getElementById('resPhone').value.trim(),
                settings: {
                    currency: '₹',
                    gstRate: parseFloat(document.getElementById('resGst').value) || 0,
                    serviceCharge: parseFloat(document.getElementById('resService').value) || 0,
                    gstin: document.getElementById('resGSTIN').value.trim(),
                    fssai: document.getElementById('resFSSAI').value.trim()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                // Update both restaurant and user docs
                await Promise.all([
                    db.collection('restaurants').doc(user.uid).set(updatedData, { merge: true }),
                    db.collection('users').doc(user.uid).update({
                        name: ownerName,
                        phone: ownerPhone
                    })
                ]);
                
                showNotification('All settings updated successfully', 'success');
                const navName = document.getElementById('restaurantName');
                if (navName) navName.textContent = updatedData.name;
            } catch (error) {
                showNotification(error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (document.getElementById('newPassword').value !== document.getElementById('confirmPassword').value) {
                return showNotification('Passwords do not match', 'error');
            }
            pendingAction = 'password';
            openReauthModal();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            pendingAction = 'delete';
            openReauthModal();
        });
    }

    if (reauthForm) {
        reauthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('reauthPassword').value;
            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            
            try {
                await user.reauthenticateWithCredential(credential);
                if (pendingAction === 'password') {
                    await user.updatePassword(document.getElementById('newPassword').value);
                    showNotification('Password updated!', 'success');
                    passwordForm.reset();
                } else if (pendingAction === 'delete') {
                    await db.collection('restaurants').doc(user.uid).delete();
                    await db.collection('users').doc(user.uid).delete();
                    await user.delete();
                    window.location.href = 'index.html';
                }
                closeReauthModal();
            } catch (error) {
                showNotification('Auth failed: ' + error.message, 'error');
            }
        });
    }

    function openReauthModal() { document.getElementById('reauthModal').classList.remove('hidden'); }
    window.closeReauthModal = function() { 
        document.getElementById('reauthModal').classList.add('hidden');
        reauthForm.reset();
        pendingAction = null;
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
