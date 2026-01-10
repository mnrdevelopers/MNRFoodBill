// Staff Management Module

const StaffManager = {
    // Initialize staff management
    async init() {
        await this.loadStaffList();
        await this.loadStaffStats();
        this.setupEventListeners();
    },
    
    // Load staff list for current restaurant
    async loadStaffList() {
        const user = auth.currentUser;
        const restaurantId = await RoleManager.getRestaurantId();
        
        try {
            const staffList = await RoleManager.getStaffList(restaurantId);
            this.renderStaffList(staffList);
        } catch (error) {
            console.error("Error loading staff list:", error);
            showNotification('Failed to load staff list', 'error');
        }
    },
    
    // Render staff list in table
    renderStaffList(staff) {
        const container = document.getElementById('staffListContainer');
        if (!container) return;
        
        if (staff.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-users text-3xl mb-2"></i>
                    <p>No staff members yet</p>
                    <p class="text-sm mt-2">Add your first staff member to get started</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="py-3 px-6 text-left">Name</th>
                            <th class="py-3 px-6 text-left">Email</th>
                            <th class="py-3 px-6 text-left">Role</th>
                            <th class="py-3 px-6 text-left">Join Code</th>
                            <th class="py-3 px-6 text-left">Added On</th>
                            <th class="py-3 px-6 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        staff.forEach((staffMember, index) => {
            const date = staffMember.addedAt?.toDate() || new Date();
            const formattedDate = date.toLocaleDateString('en-IN');
            
            html += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-3">
                            <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <i class="fas fa-user text-blue-500"></i>
                            </div>
                            <span class="font-medium">${staffMember.name}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6">${staffMember.email}</td>
                    <td class="py-4 px-6">
                        <span class="px-3 py-1 rounded-full text-sm ${this.getRoleBadgeClass(staffMember.role)}">
                            ${staffMember.role}
                        </span>
                    </td>
                    <td class="py-4 px-6 font-mono">${staffMember.joinCode}</td>
                    <td class="py-4 px-6">${formattedDate}</td>
                    <td class="py-4 px-6">
                        <div class="flex space-x-2">
                            <button class="copy-join-code text-blue-500 hover:text-blue-700" data-code="${staffMember.joinCode}" title="Copy Join Code">
                                <i class="fas fa-copy"></i>
                            </button>
                            <button class="resend-join-code text-green-500 hover:text-green-700" data-email="${staffMember.email}" title="Resend Credentials">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                            <button class="remove-staff text-red-500 hover:text-red-700" data-id="${staffMember.staffId}" title="Remove Staff">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        this.attachStaffActions();
    },
    
    getRoleBadgeClass(role) {
        const classes = {
            [ROLES.STAFF]: 'bg-blue-100 text-blue-800',
            [ROLES.ADMIN]: 'bg-purple-100 text-purple-800',
            [ROLES.OWNER]: 'bg-green-100 text-green-800'
        };
        return classes[role] || 'bg-gray-100 text-gray-800';
    },
    
    attachStaffActions() {
        // Copy join code
        document.querySelectorAll('.copy-join-code').forEach(button => {
            button.addEventListener('click', function() {
                const joinCode = this.dataset.code;
                navigator.clipboard.writeText(joinCode)
                    .then(() => {
                        showNotification('Join code copied to clipboard', 'success');
                    })
                    .catch(err => {
                        console.error('Failed to copy: ', err);
                    });
            });
        });
        
        // Remove staff
        document.querySelectorAll('.remove-staff').forEach(button => {
            button.addEventListener('click', async function() {
                const staffId = this.dataset.id;
                const staffName = this.closest('tr').querySelector('td:first-child span').textContent;
                
                if (confirm(`Are you sure you want to remove ${staffName}?`)) {
                    try {
                        const restaurantId = await RoleManager.getRestaurantId();
                        const result = await RoleManager.removeStaff(staffId, restaurantId);
                        
                        if (result.success) {
                            showNotification('Staff member removed successfully', 'success');
                            await this.loadStaffList();
                        } else {
                            showNotification(result.error, 'error');
                        }
                    } catch (error) {
                        showNotification('Error removing staff', 'error');
                    }
                }
            });
        });
    },
    
    setupEventListeners() {
        const addStaffBtn = document.getElementById('addStaffBtn');
        const staffModal = document.getElementById('staffModal');
        const staffForm = document.getElementById('staffForm');
        const closeStaffModalBtn = document.getElementById('closeStaffModal');
        
        if (addStaffBtn) {
            addStaffBtn.addEventListener('click', () => {
                this.openAddStaffModal();
            });
        }
        
        if (closeStaffModalBtn) {
            closeStaffModalBtn.addEventListener('click', () => {
                staffModal.classList.add('hidden');
            });
        }
        
        if (staffForm) {
            staffForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleAddStaff();
            });
        }
    },
    
    openAddStaffModal() {
        const modal = document.getElementById('staffModal');
        const form = document.getElementById('staffForm');
        
        if (!modal || !form) return;
        
        form.reset();
        modal.classList.remove('hidden');
        
        // Generate random password
        const password = this.generateRandomPassword();
        document.getElementById('staffPassword').value = password;
        document.getElementById('showPassword').textContent = password;
    },
    
    async handleAddStaff() {
        const name = document.getElementById('staffName').value.trim();
        const email = document.getElementById('staffEmail').value.trim();
        const password = document.getElementById('staffPassword').value;
        const role = document.getElementById('staffRole').value;
        
        if (!name || !email || !password) {
            showNotification('Please fill all required fields', 'error');
            return;
        }
        
        try {
            const restaurantId = await RoleManager.getRestaurantId();
            const result = await RoleManager.createStaffAccount(email, password, name, restaurantId, role);
            
            if (result.success) {
                showNotification('Staff account created successfully! Join code: ' + result.joinCode, 'success');
                document.getElementById('staffModal').classList.add('hidden');
                await this.loadStaffList();
            } else {
                showNotification('Error: ' + result.error, 'error');
            }
        } catch (error) {
            showNotification('Error creating staff account: ' + error.message, 'error');
        }
    },
    
    generateRandomPassword() {
        const length = 8;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is owner and on staff management page
    auth.onAuthStateChanged(async user => {
        if (user) {
            const role = await RoleManager.getCurrentUserRole();
            if (role === ROLES.OWNER) {
                // Initialize staff manager if on staff page
                if (window.location.pathname.includes('staff.html') && StaffManager.init) {
                    await StaffManager.init();
                }
            }
        }
    });
});

async loadStaffStats() {
    const restaurantId = await RoleManager.getRestaurantId();
    try {
        const staffList = await RoleManager.getStaffList(restaurantId);
        
        // Calculate stats
        const totalStaff = staffList.length;
        const activeStaff = staffList.filter(s => s.isActive !== false).length;
        const adminStaff = staffList.filter(s => s.role === ROLES.ADMIN).length;
        
        // Update DOM
        const totalEl = document.getElementById('totalStaff');
        const activeEl = document.getElementById('activeStaff');
        const adminEl = document.getElementById('adminStaff');
        
        if (totalEl) totalEl.textContent = totalStaff;
        if (activeEl) activeEl.textContent = activeStaff;
        if (adminEl) adminEl.textContent = adminStaff;
        
    } catch (error) {
        console.error("Error loading staff stats:", error);
    }
}

// Make globally available
window.StaffManager = StaffManager;
