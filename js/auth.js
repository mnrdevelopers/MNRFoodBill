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

    // Login logic
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
                    setTimeout(() => window.location.href = 'dashboard.html', 1000);
                })
                .catch(error => showMessage(error.message, 'error'));
        });
    }

    // Registration logic
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
                    setTimeout(() => window.location.href = 'dashboard.html', 2500);
                })
                .catch(error => showMessage(error.message, 'error'));
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
});
