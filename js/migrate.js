document.addEventListener('DOMContentLoaded', async function() {
    // Check if user is logged in
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    // Check if user already has a role
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            // User already has role, redirect to dashboard
            window.location.href = 'dashboard.html';
            return;
        }
    } catch (error) {
        console.error('Error checking user:', error);
    }
    
    // Setup event listeners
    setupEventListeners();
    
    function setupEventListeners() {
        // Role selection
        document.getElementById('selectOwner').addEventListener('click', function() {
            document.getElementById('roleSelection').classList.add('hidden');
            document.getElementById('ownerSetup').classList.remove('hidden');
            
            // Generate join code
            const joinCode = generateJoinCode();
            document.getElementById('generatedJoinCode').textContent = joinCode;
        });
        
        document.getElementById('selectStaff').addEventListener('click', function() {
            document.getElementById('roleSelection').classList.add('hidden');
            document.getElementById('staffSetup').classList.remove('hidden');
        });
        
        // Owner setup form
        document.getElementById('ownerSetupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const restaurantName = document.getElementById('newRestaurantName').value.trim();
            const joinCode = document.getElementById('generatedJoinCode').textContent;
            
            if (!restaurantName) {
                showMessage('Please enter restaurant name', 'error');
                return;
            }
            
            try {
                showMessage('Setting up owner account...', 'info');
                
                // Check if restaurant already exists for this user
                const restaurantDoc = await db.collection('restaurants').doc(user.uid).get();
                
                if (restaurantDoc.exists) {
                    // Update existing restaurant
                    await db.collection('restaurants').doc(user.uid).update({
                        name: restaurantName,
                        joinCode: joinCode,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else {
                    // Create new restaurant
                    await db.collection('restaurants').doc(user.uid).set({
                        name: restaurantName,
                        email: user.email,
                        ownerId: user.uid,
                        joinCode: joinCode,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        settings: {
                            gstRate: 18,
                            serviceCharge: 5,
                            currency: '₹'
                        }
                    });
                }
                
                // Create user document
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    role: 'owner',
                    restaurantId: user.uid,
                    name: restaurantName + ' Owner',
                    joinCode: joinCode,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showMessage('Owner account setup complete! Your join code: ' + joinCode, 'success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 3000);
                
            } catch (error) {
                showMessage('Setup failed: ' + error.message, 'error');
            }
        });
        
        // Staff setup form
        document.getElementById('staffSetupForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const staffName = document.getElementById('staffUserName').value.trim();
            const joinCode = document.getElementById('staffJoinCode').value.trim().toUpperCase();
            
            if (!staffName) {
                showMessage('Please enter your name', 'error');
                return;
            }
            
            if (!joinCode || joinCode.length !== 6) {
                showMessage('Please enter a valid 6-character join code', 'error');
                return;
            }
            
            try {
                showMessage('Verifying join code...', 'info');
                
                // Find restaurant with this join code
                const restaurantQuery = await db.collection('restaurants')
                    .where('joinCode', '==', joinCode)
                    .limit(1)
                    .get();
                
                if (restaurantQuery.empty) {
                    showMessage('Invalid join code. Please check with your owner.', 'error');
                    return;
                }
                
                const restaurantDoc = restaurantQuery.docs[0];
                const restaurantId = restaurantDoc.id;
                const restaurantData = restaurantDoc.data();
                
                // Create user document
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    role: 'staff',
                    restaurantId: restaurantId,
                    name: staffName,
                    joinCode: joinCode,
                    status: 'active',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showMessage(`Success! You've joined ${restaurantData.name} as staff`, 'success');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 3000);
                
            } catch (error) {
                showMessage('Setup failed: ' + error.message, 'error');
            }
        });
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', function() {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });
    }
    
    function generateJoinCode() {
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
