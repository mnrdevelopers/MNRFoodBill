document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settingsForm');
    const passwordForm = document.getElementById('passwordForm');
    const deleteBtn = document.getElementById('deleteAccountBtn');
    const reauthForm = document.getElementById('reauthForm');
    
    // Logo upload elements
    const logoUploadArea = document.getElementById('logoUploadArea');
    const logoImageInput = document.getElementById('logoImageInput');
    const logoPreview = document.getElementById('logoPreview');
    const logoPreviewContainer = document.getElementById('logoPreviewContainer');
    const logoUploadContent = document.getElementById('logoUploadContent');
    const removeLogo = document.getElementById('removeLogo');
    const restaurantLogoUrl = document.getElementById('restaurantLogoUrl');
    
    let pendingAction = null;

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadSettings();
        }
    });

    // Helper function to safely get input values
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    };

    // Helper function to safely set input values
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    // Initialize logo upload functionality
    if (logoUploadArea && logoImageInput) {
        // Trigger file input when clicking upload area
        logoUploadArea.addEventListener('click', () => logoImageInput.click());
        
        logoImageInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.match('image.*')) {
                showNotification('Please select an image file', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showNotification('Image size should be less than 5MB', 'error');
                return;
            }
            
            // Show preview
            const reader = new FileReader();
            reader.onload = function(e) {
                logoPreview.src = e.target.result;
                logoPreviewContainer.classList.remove('hidden');
                logoUploadContent.classList.add('hidden');
            };
            reader.readAsDataURL(file);
            
            // Upload to Firebase Storage
            try {
                const user = auth.currentUser;
                const storageRef = firebase.storage().ref();
                const logoRef = storageRef.child(`restaurants/${user.uid}/logo/${Date.now()}_${file.name}`);
                
                // Show upload progress
                showNotification('Uploading logo...', 'info');
                
                const snapshot = await logoRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                
                // Save URL to hidden input
                restaurantLogoUrl.value = downloadURL;
                
                showNotification('Logo uploaded successfully', 'success');
                
            } catch (error) {
                console.error('Error uploading logo:', error);
                showNotification('Error uploading logo: ' + error.message, 'error');
            }
        });
        
        // Remove logo
        if (removeLogo) {
            removeLogo.addEventListener('click', function(e) {
                e.stopPropagation();
                logoPreview.src = '';
                logoPreviewContainer.classList.add('hidden');
                logoUploadContent.classList.remove('hidden');
                restaurantLogoUrl.value = '';
                logoImageInput.value = '';
            });
        }
    }

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
                setVal('resName', data.name);
                setVal('resAddress', data.address);
                setVal('resPhone', data.phone);
                
                // Tax settings
                setVal('resGst', settings.gstRate);
                setVal('resService', settings.serviceCharge);
                setVal('resGSTIN', settings.gstin);
                setVal('resFSSAI', settings.fssai);
                
                // Owner info
                setVal('ownerName', data.ownerName);
                setVal('ownerPhone', data.ownerPhone || data.phone);
                
                // Logo
                if (settings.logoUrl && logoPreview && restaurantLogoUrl) {
                    restaurantLogoUrl.value = settings.logoUrl;
                    logoPreview.src = settings.logoUrl;
                    logoPreviewContainer.classList.remove('hidden');
                    logoUploadContent.classList.add('hidden');
                }
            }
            
            // Fallback owner info check from users collection
            if (userDoc.exists && !getVal('ownerName')) {
                const userData = userDoc.data();
                setVal('ownerName', userData.name);
                setVal('ownerPhone', userData.phone);
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

            const ownerName = getVal('ownerName');
            const ownerPhone = getVal('ownerPhone');

            const updatedData = {
                name: getVal('resName'),
                ownerName: ownerName,
                ownerPhone: ownerPhone,
                address: getVal('resAddress'),
                phone: getVal('resPhone'),
                settings: {
                    currency: '₹',
                    gstRate: parseFloat(getVal('resGst')) || 0,
                    serviceCharge: parseFloat(getVal('resService')) || 0,
                    gstin: getVal('resGSTIN'),
                    fssai: getVal('resFSSAI'),
                    logoUrl: getVal('restaurantLogoUrl') // Add logo URL
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
            if (getVal('newPassword') !== getVal('confirmPassword')) {
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
            const password = getVal('reauthPassword');
            const user = auth.currentUser;
            const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
            
            try {
                await user.reauthenticateWithCredential(credential);
                if (pendingAction === 'password') {
                    await user.updatePassword(getVal('newPassword'));
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

    function openReauthModal() { 
        const modal = document.getElementById('reauthModal');
        if (modal) modal.classList.remove('hidden'); 
    }
    
    window.closeReauthModal = function() { 
        const modal = document.getElementById('reauthModal');
        if (modal) modal.classList.add('hidden');
        if (reauthForm) reauthForm.reset();
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
