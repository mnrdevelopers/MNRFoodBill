document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    auth.onAuthStateChanged(user => {
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

    // Toggle staff join code visibility
    const toggleJoinCodeBtn = document.getElementById('toggleJoinCodeBtn');
    if (toggleJoinCodeBtn) {
        toggleJoinCodeBtn.addEventListener('click', function() {
            const joinCode = document.getElementById('joinCode');
            const type = joinCode.getAttribute('type') === 'password' ? 'text' : 'password';
            joinCode.setAttribute('type', type);
            this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
        });
    }

    // Show/Hide staff login form
    const showStaffLoginBtn = document.getElementById('showStaffLoginBtn');
    const showOwnerLoginBtn = document.getElementById('showOwnerLoginBtn');
    
    if (showStaffLoginBtn) {
        showStaffLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('staffLoginForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Staff Login';
        });
    }

    if (showOwnerLoginBtn) {
        showOwnerLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('staffLoginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Owner Login';
        });
    }

    // Login form (Owner)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            showMessage('Signing in as Owner...', 'info');
            
            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // Check user role
                    return db.collection('users').doc(userCredential.user.uid).get();
                })
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        if (userData.role === 'owner') {
                            showMessage('Login successful! Redirecting...', 'success');
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 1000);
                        } else {
                            auth.signOut();
                            showMessage('This account is not an owner account', 'error');
                        }
                    } else {
                        showMessage('User data not found', 'error');
                    }
                })
                .catch(error => {
                    showMessage(error.message, 'error');
                });
        });
    }

    // Staff Login form
    const staffLoginForm = document.getElementById('staffLoginForm');
    if (staffLoginForm) {
        staffLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('staffEmail').value;
            const password = document.getElementById('staffPassword').value;
            const joinCode = document.getElementById('joinCode').value;
            
            showMessage('Signing in as Staff...', 'info');
            
            // First authenticate
            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    // Verify staff credentials and join code
                    return db.collection('users').doc(userCredential.user.uid).get();
                })
                .then(doc => {
                    if (doc.exists) {
                        const userData = doc.data();
                        if (userData.role === 'staff' && userData.joinCode === joinCode) {
                            showMessage('Staff login successful! Redirecting...', 'success');
                            setTimeout(() => {
                                window.location.href = 'dashboard.html';
                            }, 1000);
                        } else {
                            auth.signOut();
                            showMessage('Invalid join code or account type', 'error');
                        }
                    } else {
                        showMessage('Staff account not found', 'error');
                    }
                })
                .catch(error => {
                    showMessage(error.message, 'error');
                });
        });
    }

    // Register form (Owner registration)
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const backToLogin = document.getElementById('backToLogin');

    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('staffLoginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Register as Owner';
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', function() {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Owner Login';
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const restaurantName = document.getElementById('restaurantName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            showMessage('Creating owner account...', 'info');
            
            // Generate unique join code for staff
            const joinCode = generateJoinCode();
            
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    
                    // Save restaurant info to Firestore
                    return Promise.all([
                        db.collection('restaurants').doc(user.uid).set({
                            name: restaurantName,
                            email: email,
                            ownerId: user.uid,
                            joinCode: joinCode,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            settings: {
                                gstRate: 18,
                                serviceCharge: 5,
                                currency: '₹'
                            }
                        }),
                        db.collection('users').doc(user.uid).set({
                            email: email,
                            role: 'owner',
                            restaurantId: user.uid,
                            name: restaurantName + ' Owner',
                            joinCode: joinCode,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        })
                    ]);
                })
                .then(() => {
                    showMessage(`Account created! Your staff join code is: ${joinCode}`, 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 3000);
                })
                .catch(error => {
                    showMessage(error.message, 'error');
                });
        });
    }

    function generateJoinCode() {
        // Generate a 6-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
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
