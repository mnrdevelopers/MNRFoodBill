document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settingsForm');
    const userEmail = document.getElementById('userEmail');

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            userEmail.textContent = user.email;
            loadCurrentSettings(user.uid);
        }
    });

    async function loadCurrentSettings(uid) {
        try {
            const doc = await db.collection('restaurants').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                document.getElementById('resName').value = data.name || '';
                if (data.settings) {
                    document.getElementById('resCurrency').value = data.settings.currency || '₹';
                    document.getElementById('resGst').value = data.settings.gstRate || 0;
                    document.getElementById('resService').value = data.settings.serviceCharge || 0;
                    document.getElementById('resAddress').value = data.settings.address || '';
                }
            }
        } catch (error) {
            console.error("Error loading settings:", error);
            showNotification('Failed to load settings', 'error');
        }
    }

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const name = document.getElementById('resName').value;
        const currency = document.getElementById('resCurrency').value;
        const gstRate = parseFloat(document.getElementById('resGst').value) || 0;
        const serviceCharge = parseFloat(document.getElementById('resService').value) || 0;
        const address = document.getElementById('resAddress').value;

        try {
            await db.collection('restaurants').doc(user.uid).set({
                name: name,
                settings: {
                    currency,
                    gstRate,
                    serviceCharge,
                    address,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            }, { merge: true });

            showNotification('Settings saved successfully!', 'success');
        } catch (error) {
            showNotification('Error saving settings: ' + error.message, 'error');
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'index.html');
    });
});

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300 ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white font-semibold`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
