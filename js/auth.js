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

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            showMessage('Signing in...', 'info');
            
            auth.signInWithEmailAndPassword(email, password)
                .then(userCredential => {
                    showMessage('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1000);
                })
                .catch(error => {
                    showMessage(error.message, 'error');
                });
        });
    }

    // Toggle Register UI
    const registerBtn = document.getElementById('registerBtn');
    const backToLogin = document.getElementById('backToLogin');

    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', function() {
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('loginForm').classList.remove('hidden');
        });
    }

    // Register form logic - storing email in Firestore
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const restaurantName = document.getElementById('restaurantName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            showMessage('Creating account...', 'info');
            
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    const user = userCredential.user;
                    
                    // Save restaurant info AND email to Firestore
                    return db.collection('restaurants').doc(user.uid).set({
                        name: restaurantName,
                        email: email, // Store email explicitly
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        settings: {
                            gstRate: 18,
                            serviceCharge: 5,
                            currency: '₹'
                        }
                    });
                })
                .then(() => {
                    showMessage('Account created successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                })
                .catch(error => {
                    showMessage(error.message, 'error');
                });
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
