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
                
                // Populate basic info
                if (document.getElementById('restaurantName')) {
                    document.getElementById('restaurantName').value = data.name || '';
                }
                if (document.getElementById('restaurantAddress')) {
                    document.getElementById('restaurantAddress').value = data.address || '';
                }
                if (document.getElementById('restaurantPhone')) {
                    document.getElementById('restaurantPhone').value = data.phone || '';
                }
                if (document.getElementById('restaurantEmail')) {
                    document.getElementById('restaurantEmail').value = data.email || '';
                }

                // Populate settings object fields
                const settings = data.settings || {};
                if (document.getElementById('currency')) {
                    document.getElementById('currency').value = settings.currency || '₹';
                }
                if (document.getElementById('gstRate')) {
                    document.getElementById('gstRate').value = settings.gstRate || 0;
                }
                if (document.getElementById('serviceCharge')) {
                    document.getElementById('serviceCharge').value = settings.serviceCharge || 0;
                }
                if (document.getElementById('footerMessage')) {
                    document.getElementById('footerMessage').value = settings.footerMessage || 'Thank you for visiting!';
                }
                
                // Update UI elements that show the name
                const navName = document.getElementById('navRestaurantName');
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

            const updatedData = {
                name: document.getElementById('restaurantName').value,
                address: document.getElementById('restaurantAddress').value,
                phone: document.getElementById('restaurantPhone').value,
                email: document.getElementById('restaurantEmail').value,
                settings: {
                    currency: document.getElementById('currency').value,
                    gstRate: parseFloat(document.getElementById('gstRate').value) || 0,
                    serviceCharge: parseFloat(document.getElementById('serviceCharge').value) || 0,
                    footerMessage: document.getElementById('footerMessage').value
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            try {
                await db.collection('restaurants').doc(user.uid).set(updatedData, { merge: true });
                showNotification('Settings saved successfully!', 'success');
                
                // Update nav name immediately
                const navName = document.getElementById('navRestaurantName');
                if (navName) navName.textContent = updatedData.name;
                
            } catch (error) {
                console.error("Error saving settings:", error);
                showNotification('Failed to save settings', 'error');
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
