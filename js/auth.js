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
            const icon = this.querySelector('i');
            if (password.type === 'password') {
                password.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                password.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
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
                    showMessage(error.message, 'danger');
                });
        });
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');
    const backToLogin = document.getElementById('backToLogin');

    if (registerBtn) {
        registerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('loginForm').classList.add('d-none');
            document.getElementById('registerForm').classList.remove('d-none');
        });
    }

    if (backToLogin) {
        backToLogin.addEventListener('click', function() {
            document.getElementById('registerForm').classList.add('d-none');
            document.getElementById('loginForm').classList.remove('d-none');
        });
    }

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
                    
                    // Save restaurant info to Firestore
                    return db.collection('restaurants').doc(user.uid).set({
                        name: restaurantName,
                        email: email,
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
                })
                .then(() => {
                    showMessage('Account created successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                })
                .catch(error => {
                    showMessage(error.message, 'danger');
                });
        });
    }

    function showMessage(text, type) {
        const messageDiv = document.getElementById('message');
        messageDiv.textContent = text;
        messageDiv.className = `alert alert-${type} mt-3`;
        messageDiv.classList.remove('d-none');
        
        setTimeout(() => {
            messageDiv.classList.add('d-none');
        }, 5000);
    }
});
