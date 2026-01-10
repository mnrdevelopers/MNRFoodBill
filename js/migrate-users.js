document.addEventListener('DOMContentLoaded', async function() {
    console.log('Migration script loaded...');
    
    // Check if migration is needed
    const user = auth.currentUser;
    if (!user) {
        console.log('No user logged in');
        return;
    }
    
    console.log('Checking user role for:', user.email);
    
    try {
        // Check if user already has a role
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            console.log('User already has role:', userDoc.data().role);
            return;
        }
        
        // User doesn't have role - migrate them
        console.log('Migrating user to role-based system...');
        
        // Check if they have a restaurant document
        const restaurantDoc = await db.collection('restaurants').doc(user.uid).get();
        
        if (restaurantDoc.exists) {
            // This is an existing owner
            const restaurantData = restaurantDoc.data();
            
            // Generate join code if not exists
            const joinCode = restaurantData.joinCode || generateJoinCode();
            
            // Update restaurant with join code
            if (!restaurantData.joinCode) {
                await db.collection('restaurants').doc(user.uid).update({
                    joinCode: joinCode,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            // Create user document
            await db.collection('users').doc(user.uid).set({
                email: user.email,
                role: 'owner',
                restaurantId: user.uid,
                name: restaurantData.name + ' Owner',
                joinCode: joinCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            console.log('✅ Migrated to OWNER with join code:', joinCode);
            alert('Migration complete! You are now an owner. Your staff join code is: ' + joinCode);
            
        } else {
            // This might be a staff member or needs manual setup
            console.log('No restaurant found. Manual setup required.');
            
            // Ask user if they are owner or staff
            const role = confirm('Are you the restaurant owner? Click OK for Owner, Cancel for Staff');
            
            if (role) {
                // Owner - need to create restaurant
                const restaurantName = prompt('Enter your restaurant name:');
                if (!restaurantName) return;
                
                const joinCode = generateJoinCode();
                
                // Create restaurant
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
                
                // Create user document
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    role: 'owner',
                    restaurantId: user.uid,
                    name: restaurantName + ' Owner',
                    joinCode: joinCode,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('✅ Created new OWNER with join code:', joinCode);
                alert('Account setup complete! You are now an owner. Your staff join code is: ' + joinCode);
                
            } else {
                // Staff - need join code
                const joinCode = prompt('Enter the join code from your restaurant owner:');
                if (!joinCode) return;
                
                // Check if join code is valid
                const restaurantQuery = await db.collection('restaurants')
                    .where('joinCode', '==', joinCode)
                    .limit(1)
                    .get();
                
                if (restaurantQuery.empty) {
                    alert('Invalid join code. Please contact your owner.');
                    return;
                }
                
                const restaurant = restaurantQuery.docs[0];
                const restaurantId = restaurant.id;
                const restaurantData = restaurant.data();
                
                // Create user document
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    role: 'staff',
                    restaurantId: restaurantId,
                    name: user.email.split('@')[0] + ' (Staff)',
                    joinCode: joinCode,
                    status: 'active',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                console.log('✅ Migrated to STAFF for restaurant:', restaurantData.name);
                alert('Account setup complete! You are now a staff member for ' + restaurantData.name);
            }
        }
        
        // Reload page to apply changes
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Migration error:', error);
        alert('Migration failed: ' + error.message);
    }
});

function generateJoinCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
