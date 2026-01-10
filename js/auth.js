document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    auth.onAuthStateChanged(async user => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });

    // Helper: Generate a unique 6-digit join code
    function generateJoinCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Toggle password visibility
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function() {
            const password = document.getElementById('password');
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
            password.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            showMessage('Signing in...', 'info');
            
            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
                })
                .catch(error => { showMessage(error.message, 'error'); });
        });
    }

    // Registration UI Toggles
    const showRegisterOwner = document.getElementById('registerBtn');
    const showJoinStaff = document.getElementById('joinStaffBtn');
    const backToLoginButtons = document.querySelectorAll('.backToLogin');

    showRegisterOwner?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllForms();
        document.getElementById('registerOwnerForm').classList.remove('hidden');
    });

    showJoinStaff?.addEventListener('click', (e) => {
        e.preventDefault();
        hideAllForms();
        document.getElementById('joinStaffForm').classList.remove('hidden');
    });

    backToLoginButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            hideAllForms();
            document.getElementById('loginForm').classList.remove('hidden');
        });
    });

    function hideAllForms() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerOwnerForm').classList.add('hidden');
        document.getElementById('joinStaffForm').classList.add('hidden');
    }

    // Register Owner Form
    const registerOwnerForm = document.getElementById('registerOwnerForm');
    if (registerOwnerForm) {
        registerOwnerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const restaurantName = document.getElementById('ownerRestaurantName').value;
            const email = document.getElementById('ownerEmail').value;
            const password = document.getElementById('ownerPassword').value;
            
            showMessage('Creating restaurant account...', 'info');
            
            try {
                const cred = await auth.createUserWithEmailAndPassword(email, password);
                const user = cred.user;
                const joinCode = generateJoinCode();

                // 1. Create Restaurant Profile (Shared Data Container)
                await db.collection('restaurants').doc(user.uid).set({
                    name: restaurantName,
                    ownerEmail: email,
                    ownerUid: user.uid,
                    joinCode: joinCode,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    settings: { gstRate: 18, serviceCharge: 5, currency: '₹' }
                });

                // 2. Create User Profile (User Metadata)
                await db.collection('users').doc(user.uid).set({
                    restaurantId: user.uid,
                    role: 'owner',
                    email: email,
                    name: restaurantName + " Owner"
                });

                showMessage('Restaurant registered! Join Code: ' + joinCode, 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 3000);
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    // Join as Staff Form
    const joinStaffForm = document.getElementById('joinStaffForm');
    if (joinStaffForm) {
        joinStaffForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const staffName = document.getElementById('staffName').value;
            const joinCode = document.getElementById('joinCode').value.toUpperCase();
            const email = document.getElementById('staffEmail').value;
            const password = document.getElementById('staffPassword').value;

            showMessage('Verifying join code...', 'info');

            try {
                // Verify join code exists
                const resQuery = await db.collection('restaurants').where('joinCode', '==', joinCode).get();
                if (resQuery.empty) {
                    throw new Error('Invalid Join Code. Please ask your manager for the correct code.');
                }

                const restaurantDoc = resQuery.docs[0];
                const restaurantId = restaurantDoc.id;

                const cred = await auth.createUserWithEmailAndPassword(email, password);
                const user = cred.user;

                // Create Staff User Profile
                await db.collection('users').doc(user.uid).set({
                    restaurantId: restaurantId,
                    role: 'staff',
                    email: email,
                    name: staffName,
                    ownerUid: restaurantId,
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                showMessage('Joined successfully!', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    function showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        if (!messageDiv) return;
        messageDiv.textContent = text;
        messageDiv.className = 'mt-4 p-3 rounded-lg text-sm font-medium transition-all';
        
        if (type === 'success') messageDiv.classList.add('bg-green-100', 'text-green-700', 'border', 'border-green-300');
        else if (type === 'error') messageDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
        else messageDiv.classList.add('bg-blue-100', 'text-blue-700', 'border', 'border-blue-300');
        
        messageDiv.classList.remove('hidden');
        setTimeout(() => { messageDiv.classList.add('hidden'); }, 6000);
    }
});
