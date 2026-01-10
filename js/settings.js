document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settingsForm');
    const passwordForm = document.getElementById('passwordForm');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const reauthForm = document.getElementById('reauthForm');
    
    let pendingAction = null; // 'password' or 'delete'

    // Check auth state
  auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        // Check permission for viewing settings
        const hasPermission = await RoleManager.hasPermission(PERMISSIONS.VIEW_SETTINGS);
        if (!hasPermission) {
            // Instead of redirecting, show read-only mode
            disableSettingsEditing();
            showNotification('You can view settings but not modify them', 'info');
        }
        loadSettings();
    }
});

    // Load existing settings
    async function loadSettings() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const doc = await db.collection('restaurants').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                
                if (document.getElementById('resName')) document.getElementById('resName').value = data.name || '';
                if (document.getElementById('resAddress')) document.getElementById('resAddress').value = data.address || '';
                if (document.getElementById('resPhone')) document.getElementById('resPhone').value = data.phone || '';
                
                const settings = data.settings || {};
                if (document.getElementById('resGst')) document.getElementById('resGst').value = settings.gstRate || 0;
                if (document.getElementById('resService')) document.getElementById('resService').value = settings.serviceCharge || 0;
                if (document.getElementById('resGSTIN')) document.getElementById('resGSTIN').value = settings.gstin || '';
                if (document.getElementById('resFSSAI')) document.getElementById('resFSSAI').value = settings.fssai || '';
                
                const navName = document.getElementById('restaurantName');
                if (navName && data.name) navName.textContent = data.name;
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            showNotification('Failed to load settings', 'error');
        }
    }

    // Save Settings
    if (settingsForm) {
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const user = auth.currentUser;
            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

            const updatedData = {
                name: document.getElementById('resName').value.trim(),
                address: document.getElementById('resAddress').value.trim(),
                phone: document.getElementById('resPhone').value.trim(),
                settings: {
                    currency: '₹', // Hardcoded as per request to remove field
                    gstRate: parseFloat(document.getElementById('resGst').value) || 0,
                    serviceCharge: parseFloat(document.getElementById('resService').value) || 0,
                    gstin: document.getElementById('resGSTIN').value.trim(),
                    fssai: document.getElementById('resFSSAI').value.trim()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('restaurants').doc(user.uid).set(updatedData, { merge: true });
                showNotification('Settings updated successfully', 'success');
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

    // Password Change Logic
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            if (newPass !== confirmPass) {
                showNotification('Passwords do not match', 'error');
                return;
            }

            pendingAction = 'password';
            openReauthModal();
        });
    }

    // Delete Account Button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            pendingAction = 'delete';
            openReauthModal();
        });
    }

    // Handle Re-authentication & Execute Actions
    if (reauthForm) {
        reauthForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const password = document.getElementById('reauthPassword').value;
            const user = auth.currentUser;
            
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            
            try {
                await user.reauthenticateWithCredential(credential);
                
                if (pendingAction === 'password') {
                    const newPass = document.getElementById('newPassword').value;
                    await user.updatePassword(newPass);
                    showNotification('Password updated successfully', 'success');
                    passwordForm.reset();
                } else if (pendingAction === 'delete') {
                    // Start deletion process
                    const uid = user.uid;
                    // Note: In a production app, you'd use a Cloud Function to clean up subcollections
                    // Here we delete the main restaurant doc and then the user
                    await db.collection('restaurants').doc(uid).delete();
                    await user.delete();
                    window.location.href = 'index.html';
                }
                
                closeReauthModal();
            } catch (error) {
                showNotification('Authentication failed: ' + error.message, 'error');
            }
        });
    }

    function openReauthModal() {
        document.getElementById('reauthModal').classList.remove('hidden');
    }

    window.closeReauthModal = function() {
        document.getElementById('reauthModal').classList.add('hidden');
        document.getElementById('reauthForm').reset();
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

function disableSettingsEditing() {
    const inputs = document.querySelectorAll('input, textarea, button[type="submit"]');
    inputs.forEach(input => {
        input.disabled = true;
        input.readOnly = true;
        input.classList.add('opacity-50', 'cursor-not-allowed');
    });
    
    // Hide delete account button for non-owners
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) deleteBtn.style.display = 'none';
}
