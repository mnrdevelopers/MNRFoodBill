document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('settingsForm');

    // Check auth and setup
    setupAuthAndLogout();
    
    // Load current settings
    loadCurrentSettings();
    
    // Setup form submission
    if (settingsForm) {
        settingsForm.addEventListener('submit', saveSettings);
    }
});

function setupAuthAndLogout() {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadUserInfo();
            setupLogoutButton();
        }
    });
}

function loadUserInfo() {
    const user = auth.currentUser;
    if (!user) return;
    
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.signOut().then(() => window.location.href = 'index.html');
        });
    }
}

async function loadCurrentSettings() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const doc = await db.collection('restaurants').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // Set restaurant name
            const resNameInput = document.getElementById('resName');
            if (resNameInput) {
                resNameInput.value = data.name || '';
            }
            
            // Set settings if they exist
            if (data.settings) {
                const settings = data.settings;
                
                const resCurrency = document.getElementById('resCurrency');
                const resGst = document.getElementById('resGst');
                const resService = document.getElementById('resService');
                const resAddress = document.getElementById('resAddress');
                const resPhone = document.getElementById('resPhone');
                const resGSTIN = document.getElementById('resGSTIN');
                const resFSSAI = document.getElementById('resFSSAI');
                
                if (resCurrency) resCurrency.value = settings.currency || '₹';
                if (resGst) resGst.value = settings.gstRate || 0;
                if (resService) resService.value = settings.serviceCharge || 0;
                if (resAddress) resAddress.value = settings.address || '';
                if (resPhone) resPhone.value = settings.phone || '';
                if (resGSTIN) resGSTIN.value = settings.gstin || '';
                if (resFSSAI) resFSSAI.value = settings.fssai || '';
            }
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        showNotification('Failed to load settings', 'danger');
    }
}

async function saveSettings(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const name = document.getElementById('resName').value.trim();
    const currency = document.getElementById('resCurrency').value.trim();
    const gstRate = parseFloat(document.getElementById('resGst').value) || 0;
    const serviceCharge = parseFloat(document.getElementById('resService').value) || 0;
    const address = document.getElementById('resAddress').value.trim();
    const phone = document.getElementById('resPhone').value.trim();
    const gstin = document.getElementById('resGSTIN').value.trim().toUpperCase();
    const fssai = document.getElementById('resFSSAI').value.trim();

    // Validate required fields
    if (!name) {
        showNotification('Restaurant name is required', 'danger');
        return;
    }

    try {
        await db.collection('restaurants').doc(user.uid).set({
            name: name,
            settings: {
                currency: currency || '₹',
                gstRate: gstRate || 0,
                serviceCharge: serviceCharge || 0,
                address: address || '',
                phone: phone || '',
                gstin: gstin || '',
                fssai: fssai || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showNotification('Settings saved successfully!', 'success');
        
        // Update restaurant name in other pages if needed
        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error("Error saving settings:", error);
        showNotification('Error saving settings: ' + error.message, 'danger');
    }
}

function showNotification(message, type) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification-toast position-fixed top-0 end-0 m-3 toast show`;
    notification.setAttribute('role', 'alert');
    notification.innerHTML = `
        <div class="toast-header bg-${type} text-white">
            <strong class="me-auto">${type === 'success' ? 'Success' : type === 'danger' ? 'Error' : 'Info'}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
