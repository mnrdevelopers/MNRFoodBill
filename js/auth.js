// auth.js - Authentication with Role-Based Redirection
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    auth.onAuthStateChanged(async user => {
        if (user) {
            try {
                // Fetch user data to determine redirection
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // ROLE-BASED REDIRECTION LOGIC
                    if (userData.role === 'staff') {
                        // Staff always goes to Dashboard or Billing (based on their permissions)
                        const permissions = userData.permissions || [];
                        if (permissions.includes('billing')) {
                            window.location.href = 'billing.html';
                        } else {
                            window.location.href = 'dashboard.html';
                        }
                    } else {
                        // Owner logic: Check if restaurant is configured
                        const restaurantDoc = await db.collection('restaurants').doc(userData.restaurantId).get();
                        
                        if (!restaurantDoc.exists || !restaurantDoc.data().name) {
                            // First time login for owner - send to settings
                            window.location.href = 'settings.html?setup=true';
                        } else {
                            window.location.href = 'dashboard.html';
                        }
                    }
                } else {
                    // If no user document exists, redirect to dashboard (will handle there)
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                console.error("Auto-redirect error:", error);
                window.location.href = 'dashboard.html';
            }
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

    // Toggle forms
    const registerBtn = document.getElementById('registerBtn');
    const backToLogin = document.getElementById('backToLogin');
    
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Register as Owner';
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', () => {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('loginTypeTitle').textContent = 'Owner Login';
        });
    }

    // Login logic with role-based redirection
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Signing in...';
            showMessage('Signing in...', 'info');

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // Fetch user role and restaurant info immediately after login
                const userDoc = await db.collection('users').doc(user.uid).get();
                
                if (!userDoc.exists) {
                    throw new Error("User profile not found. Please contact support.");
                }

                const userData = userDoc.data();
                
                // ROLE-BASED REDIRECTION LOGIC
                let redirectUrl = 'dashboard.html';
                
                if (userData.role === 'staff') {
                    // Staff always goes to Dashboard or Billing (based on their permissions)
                    const permissions = userData.permissions || [];
                    if (permissions.includes('billing')) {
                        redirectUrl = 'billing.html';
                    }
                } else {
                    // Owner logic: Check if restaurant is configured
                    const restaurantDoc = await db.collection('restaurants').doc(userData.restaurantId).get();
                    
                    if (!restaurantDoc.exists || !restaurantDoc.data().name) {
                        // First time login for owner - send to settings
                        redirectUrl = 'settings.html?setup=true';
                    }
                }

                showMessage('Login successful! Redirecting...', 'success');
                setTimeout(() => window.location.href = redirectUrl, 1000);
                
            } catch (error) {
                console.error("Login error:", error);
                showMessage(error.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Sign In';
            }
        });
    }

    // Registration logic (for owners only)
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const resName = document.getElementById('restaurantName').value.trim();
            const ownerName = document.getElementById('regOwnerName').value.trim();
            const ownerPhone = document.getElementById('regOwnerPhone').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            
            showMessage('Creating account...', 'info');
            const joinCode = generateJoinCode();
            
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    
                    return Promise.all([
                        db.collection('restaurants').doc(user.uid).set({
                            name: resName,
                            ownerName: ownerName,
                            phone: ownerPhone,
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
                            name: ownerName,
                            phone: ownerPhone,
                            role: 'owner',
                            restaurantId: user.uid,
                            joinCode: joinCode,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        })
                    ]);
                })
                .then(() => {
                    showMessage(`Account created! Your staff join code: ${joinCode}`, 'success');
                    setTimeout(() => window.location.href = 'settings.html?setup=true', 2500);
                })
                .catch(error => {
                    showMessage(error.message, 'error');
                    const submitBtn = registerForm.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Register';
                    }
                });
        });
    }

    function generateJoinCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    function showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = text;
        messageDiv.className = `mt-4 p-3 rounded-lg text-sm font-medium ${
            type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 
            type === 'error' ? 'bg-red-100 text-red-700 border border-red-200' : 
            'bg-blue-100 text-blue-700 border border-blue-200'
        }`;
        messageDiv.classList.remove('hidden');
        setTimeout(() => messageDiv.classList.add('hidden'), 5000);
    }

    function showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        } else {
            alert(message);
        }
    }
});
