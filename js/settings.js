document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settingsForm');
    
    // Check auth state
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadSettings();
        }
    });

    // Load existing settings from Firestore
    async function loadSettings() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const doc = await db.collection('restaurants').doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                
                // Populate basic info - Matching IDs in settings.html
                if (document.getElementById('resName')) {
                    document.getElementById('resName').value = data.name || '';
                }
                if (document.getElementById('resAddress')) {
                    document.getElementById('resAddress').value = data.address || '';
                }
                if (document.getElementById('resPhone')) {
                    document.getElementById('resPhone').value = data.phone || '';
                }
                
                // Populate settings object fields
                const settings = data.settings || {};
                if (document.getElementById('resCurrency')) {
                    document.getElementById('resCurrency').value = settings.currency || '₹';
                }
                if (document.getElementById('resGst')) {
                    document.getElementById('resGst').value = settings.gstRate || 0;
                }
                if (document.getElementById('resService')) {
                    document.getElementById('resService').value = settings.serviceCharge || 0;
                }
                if (document.getElementById('resGSTIN')) {
                    document.getElementById('resGSTIN').value = settings.gstin || '';
                }
                if (document.getElementById('resFSSAI')) {
                    document.getElementById('resFSSAI').value = settings.fssai || '';
                }
                
                // Update navigation/header name if element exists
                const navName = document.getElementById('restaurantName');
                if (navName && data.name) navName.textContent = data.name;
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            showNotification('Failed to load settings', 'error');
        }
    }

    // Handle form submission
    if (settingsForm) {
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const user = auth.currentUser;
            if (!user) return;

            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';

            // Gather data using IDs present in settings.html
            const updatedData = {
                name: document.getElementById('resName').value.trim(),
                address: document.getElementById('resAddress').value.trim(),
                phone: document.getElementById('resPhone').value.trim(),
                settings: {
                    currency: document.getElementById('resCurrency').value.trim(),
                    gstRate: parseFloat(document.getElementById('resGst').value) || 0,
                    serviceCharge: parseFloat(document.getElementById('resService').value) || 0,
                    gstin: document.getElementById('resGSTIN').value.trim(),
                    fssai: document.getElementById('resFSSAI').value.trim()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                // Use set with merge: true to avoid overwriting email or other root fields
                await db.collection('restaurants').doc(user.uid).set(updatedData, { merge: true });
                showNotification('Settings saved successfully!', 'success');
                
                // Update nav name immediately
                const navName = document.getElementById('restaurantName');
                if (navName) navName.textContent = updatedData.name;
                
            } catch (error) {
                console.error("Error saving settings:", error);
                showNotification('Failed to save settings: ' + error.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }
});

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white text-sm font-medium`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        n.style.transform = 'translateX(20px)';
        setTimeout(() => n.remove(), 300);
    }, 3000);
}
