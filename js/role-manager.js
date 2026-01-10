// Role-based Access Control System

const ROLES = {
    OWNER: 'owner',
    STAFF: 'staff',
    ADMIN: 'admin'
};

const PERMISSIONS = {
    // Dashboard
    VIEW_DASHBOARD: 'view_dashboard',
    
    // Billing
    CREATE_BILL: 'create_bill',
    PRINT_BILL: 'print_bill',
    
    // Products
    VIEW_PRODUCTS: 'view_products',
    MANAGE_PRODUCTS: 'manage_products',
    
    // Orders
    VIEW_ORDERS: 'view_orders',
    MANAGE_ORDERS: 'manage_orders',
    
    // Settings
    VIEW_SETTINGS: 'view_settings',
    MANAGE_SETTINGS: 'manage_settings',
    
    // Staff Management
    MANAGE_STAFF: 'manage_staff'
};

// Role permission mappings
const ROLE_PERMISSIONS = {
    [ROLES.OWNER]: [
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.CREATE_BILL,
        PERMISSIONS.PRINT_BILL,
        PERMISSIONS.VIEW_PRODUCTS,
        PERMISSIONS.MANAGE_PRODUCTS,
        PERMISSIONS.VIEW_ORDERS,
        PERMISSIONS.MANAGE_ORDERS,
        PERMISSIONS.VIEW_SETTINGS,
        PERMISSIONS.MANAGE_SETTINGS,
        PERMISSIONS.MANAGE_STAFF
    ],
    
    [ROLES.STAFF]: [
        PERMISSIONS.CREATE_BILL,
        PERMISSIONS.PRINT_BILL,
        PERMISSIONS.VIEW_PRODUCTS,
        PERMISSIONS.VIEW_ORDERS
        PERMISSIONS.VIEW_SETTINGS
    ],
    
    [ROLES.ADMIN]: [
        PERMISSIONS.VIEW_DASHBOARD,
        PERMISSIONS.CREATE_BILL,
        PERMISSIONS.PRINT_BILL,
        PERMISSIONS.VIEW_PRODUCTS,
        PERMISSIONS.MANAGE_PRODUCTS,
        PERMISSIONS.VIEW_ORDERS,
        PERMISSIONS.MANAGE_ORDERS,
        PERMISSIONS.MANAGE_STAFF
    ]
};

// User role management
const RoleManager = {
    // Get current user's role
    async getCurrentUserRole() {
        const user = auth.currentUser;
        if (!user) return null;
        
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                return doc.data().role || ROLES.STAFF;
            }
            return ROLES.STAFF; // Default to staff if no role set
        } catch (error) {
            console.error("Error getting user role:", error);
            return ROLES.STAFF;
        }
    },
    
    // Check if user has permission
    async hasPermission(permission) {
        const role = await this.getCurrentUserRole();
        if (!role) return false;
        
        return ROLE_PERMISSIONS[role]?.includes(permission) || false;
    },
    
    // Get user's restaurant ID (for staff, it's the restaurant they work at)
    async getRestaurantId() {
        const user = auth.currentUser;
        if (!user) return null;
        
        try {
            const doc = await db.collection('users').doc(user.uid).get();
            if (doc.exists) {
                return doc.data().restaurantId || user.uid; // Owner's restaurantId is their own UID
            }
            return user.uid;
        } catch (error) {
            console.error("Error getting restaurant ID:", error);
            return user.uid;
        }
    },
    
    // Redirect if user doesn't have permission
    async redirectIfUnauthorized(requiredPermission, redirectTo = 'dashboard.html') {
        const hasPerm = await this.hasPermission(requiredPermission);
        if (!hasPerm) {
            showNotification('You do not have permission to access this page', 'error');
            setTimeout(() => {
                window.location.href = redirectTo;
            }, 2000);
            return false;
        }
        return true;
    },
    
    // Initialize role-based UI
    async initRoleBasedUI() {
        const role = await this.getCurrentUserRole();
        
        // Update UI based on role
        this.updateSidebar(role);
        this.updatePageTitle(role);
        this.updateWelcomeMessage(role);
    },
    
    // Update sidebar based on role
    updateSidebar(role) {
        // Hide/show sidebar items based on permissions
        const sidebarItems = {
            'dashboard.html': PERMISSIONS.VIEW_DASHBOARD,
            'billing.html': PERMISSIONS.CREATE_BILL,
            'products.html': PERMISSIONS.VIEW_PRODUCTS,
            'orders.html': PERMISSIONS.VIEW_ORDERS,
            'settings.html': PERMISSIONS.VIEW_SETTINGS
        };
        
        Object.entries(sidebarItems).forEach(([page, permission]) => {
            const link = document.querySelector(`a[href="${page}"]`);
            if (link) {
                const shouldShow = ROLE_PERMISSIONS[role]?.includes(permission);
                if (!shouldShow) {
                    link.style.display = 'none';
                }
            }
        });
    },
    
    updatePageTitle(role) {
        const roleTitles = {
            [ROLES.OWNER]: 'Owner',
            [ROLES.STAFF]: 'Staff',
            [ROLES.ADMIN]: 'Admin'
        };
        
        const title = document.title;
        if (!title.includes('-')) return;
        
        document.title = title.replace('MNRFoodBill', `MNRFoodBill - ${roleTitles[role] || 'Staff'}`);
    },
    
    updateWelcomeMessage(role) {
        const greetingEl = document.getElementById('welcomeGreeting');
        if (!greetingEl) return;
        
        const roleGreetings = {
            [ROLES.OWNER]: 'Welcome back, Owner!',
            [ROLES.STAFF]: 'Welcome, Staff Member!',
            [ROLES.ADMIN]: 'Welcome, Administrator!'
        };
        
        if (greetingEl.textContent.includes('!')) {
            greetingEl.textContent = roleGreetings[role] || 'Welcome!';
        }
    },
    
    // Create staff account
    async createStaffAccount(email, password, name, restaurantId, role = ROLES.STAFF) {
        try {
            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await db.collection('users').doc(user.uid).set({
                email: email,
                name: name,
                role: role,
                restaurantId: restaurantId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                isActive: true
            });
            
            // Generate join code
            const joinCode = this.generateJoinCode();
            
            // Store join code in restaurant's staff list
            await db.collection('restaurants').doc(restaurantId).update({
                staff: firebase.firestore.FieldValue.arrayUnion({
                    staffId: user.uid,
                    email: email,
                    name: name,
                    role: role,
                    joinCode: joinCode,
                    addedAt: firebase.firestore.FieldValue.serverTimestamp()
                })
            });
            
            return {
                success: true,
                userId: user.uid,
                joinCode: joinCode
            };
            
        } catch (error) {
            console.error("Error creating staff account:", error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    generateJoinCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    },
    
    // Verify join code
    async verifyJoinCode(joinCode, restaurantId) {
        try {
            const doc = await db.collection('restaurants').doc(restaurantId).get();
            if (doc.exists) {
                const restaurant = doc.data();
                const staff = restaurant.staff || [];
                const validStaff = staff.find(s => s.joinCode === joinCode);
                return {
                    valid: !!validStaff,
                    staff: validStaff
                };
            }
            return { valid: false };
        } catch (error) {
            console.error("Error verifying join code:", error);
            return { valid: false, error: error.message };
        }
    },
    
    // Get all staff for a restaurant
    async getStaffList(restaurantId) {
        try {
            const doc = await db.collection('restaurants').doc(restaurantId).get();
            if (doc.exists) {
                return doc.data().staff || [];
            }
            return [];
        } catch (error) {
            console.error("Error getting staff list:", error);
            return [];
        }
    },
    
    // Remove staff member
    async removeStaff(staffId, restaurantId) {
        try {
            // Get staff details
            const doc = await db.collection('restaurants').doc(restaurantId).get();
            if (doc.exists) {
                const restaurant = doc.data();
                const staff = restaurant.staff || [];
                const updatedStaff = staff.filter(s => s.staffId !== staffId);
                
                // Update restaurant document
                await db.collection('restaurants').doc(restaurantId).update({
                    staff: updatedStaff
                });
                
                // Deactivate user
                await db.collection('users').doc(staffId).update({
                    isActive: false,
                    deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                return { success: true };
            }
            return { success: false, error: 'Restaurant not found' };
        } catch (error) {
            console.error("Error removing staff:", error);
            return { success: false, error: error.message };
        }
    }
};

// Make globally available
window.RoleManager = RoleManager;
window.ROLES = ROLES;
window.PERMISSIONS = PERMISSIONS;
