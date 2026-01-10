document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    auth.onAuthStateChanged(async user => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });

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

    // Toggle join code visibility
    const toggleJoinCodeBtn = document.getElementById('toggleJoinCodeBtn');
    if (toggleJoinCodeBtn) {
        toggleJoinCodeBtn.addEventListener('click', function() {
            const joinCode = document.getElementById('joinCode');
            const type = joinCode.getAttribute('type') === 'password' ? 'text' : 'password';
            joinCode.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }

    // Show/Hide login forms
    const showStaffLoginBtn = document.getElementById('showStaffLoginBtn');
    const showOwnerLoginBtn = document.getElementById('showOwnerLoginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const backToLogin = document.getElementById('backToLogin');

    if (showStaffLoginBtn) {
        showStaffLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('staffLoginForm').classList.remove('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Staff Login';
        });
    }

    if (showOwnerLoginBtn) {
        showOwnerLoginBtn.addEventListener('click', function() {
            document.getElementById('staffLoginForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Owner Login';
        });
    }

    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('staffLoginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Register Restaurant';
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', function() {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('staffLoginForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Owner Login';
        });
    }

    // Owner Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            showMessage('Signing in as Owner...', 'info');
            
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Check if user exists in users collection
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    // First time login, create user document
                    await db.collection('users').doc(user.uid).set({
                        email: email,
                        role: ROLES.OWNER,
                        restaurantId: user.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        isActive: true
                    });
                    
                    // Also create/update restaurant document
                    const restaurantDoc = await db.collection('restaurants').doc(user.uid).get();
                    if (!restaurantDoc.exists) {
                        await db.collection('restaurants').doc(user.uid).set({
                            name: 'My Restaurant',
                            email: email,
                            ownerId: user.uid,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            settings: {
                                gstRate: 18,
                                serviceCharge: 5,
                                currency: '₹'
                            }
                        });
                    }
                } else {
                    // Existing user, verify role
                    const userData = userDoc.data();
                    if (userData.role !== ROLES.OWNER) {
                        showMessage('This account is not an owner account', 'error');
                        await auth.signOut();
                        return;
                    }
                }
                
                showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    // Staff Login form
    const staffLoginForm = document.getElementById('staffLoginForm');
    if (staffLoginForm) {
        staffLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('staffEmail').value;
            const password = document.getElementById('staffPassword').value;
            const joinCode = document.getElementById('joinCode').value;
            
            showMessage('Signing in as Staff...', 'info');
            
            try {
                // First, sign in with email/password
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Check user document
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (!userDoc.exists) {
                    showMessage('Staff account not found. Please ask owner to create account.', 'error');
                    await auth.signOut();
                    return;
                }
                
                const userData = userDoc.data();
                
                // Verify join code with restaurant
                const joinResult = await RoleManager.verifyJoinCode(joinCode, userData.restaurantId);
                
                if (!joinResult.valid) {
                    showMessage('Invalid join code', 'error');
                    await auth.signOut();
                    return;
                }
                
                // Verify this staff member matches the join code
                if (joinResult.staff.staffId !== user.uid) {
                    showMessage('Join code does not match this account', 'error');
                    await auth.signOut();
                    return;
                }
                
                // Check if account is active
                if (!userData.isActive) {
                    showMessage('Account is deactivated. Contact owner.', 'error');
                    await auth.signOut();
                    return;
                }
                
                showMessage('Staff login successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    // Owner Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const restaurantName = document.getElementById('restaurantName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            showMessage('Creating restaurant account...', 'info');
            
            try {
                // Create user in Firebase Auth
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Create user document with owner role
                await db.collection('users').doc(user.uid).set({
                    email: email,
                    role: ROLES.OWNER,
                    restaurantId: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    isActive: true
                });
                
                // Create restaurant document
                await db.collection('restaurants').doc(user.uid).set({
                    name: restaurantName,
                    email: email,
                    ownerId: user.uid,
                    ownerEmail: email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    settings: {
                        gstRate: 18,
                        serviceCharge: 5,
                        currency: '₹',
                        address: '',
                        phone: '',
                        gstin: '',
                        fssai: ''
                    }
                });
                
                showMessage('Restaurant created successfully!', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1500);
                
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    function showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = text;
        messageDiv.className = 'mt-4 p-3 rounded-lg';
        
        if (type === 'success') {
            messageDiv.classList.add('bg-green-100', 'text-green-700', 'border', 'border-green-300');
        } else if (type === 'error') {
            messageDiv.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
        } else {
            messageDiv.classList.add('bg-blue-100', 'text-blue-700', 'border', 'border-blue-300');
        }
        
        messageDiv.classList.remove('hidden');
        
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);
    }
});
