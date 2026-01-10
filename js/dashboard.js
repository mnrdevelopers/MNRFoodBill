document.addEventListener('DOMContentLoaded', function() {
    // Check auth and permissions
    auth.onAuthStateChanged(async user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // Get user role
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    
                    // Dashboard is accessible to both roles, but we load data here
                    updateGreeting(userData.name);
                    loadRestaurantInfo();
                    loadDashboardStats();
                    loadRecentOrders();
                } else {
                    auth.signOut();
                    window.location.href = 'index.html';
                }
            } catch (error) {
                console.error("Auth error:", error);
            }
        }
    });

    // Update greeting based on time
    function updateGreeting(userName) {
        const greetingEl = document.getElementById('welcomeGreeting');
        const dateTimeEl = document.getElementById('currentDateTime');
        if (!greetingEl) return;

        const hour = new Date().getHours();
        let greeting = "";
        
        if (hour < 12) greeting = "Good Morning";
        else if (hour < 17) greeting = "Good Afternoon";
        else greeting = "Good Evening";

        const name = userName ? userName.split(' ')[0] : 'User';
        greetingEl.textContent = `${greeting}, ${name}!`;

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateTimeEl.textContent = new Date().toLocaleDateString('en-IN', options);
    }

    // Load restaurant info
    function loadRestaurantInfo() {
        const user = auth.currentUser;
        if (!user) return;
        
        db.collection('restaurants').doc(user.uid).get()
            .then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    const nameEl = document.getElementById('dashboardRestaurantName');
                    if (nameEl) nameEl.textContent = data.name;
                }
            });
    }

    // Load dashboard stats
    function loadDashboardStats() {
        const user = auth.currentUser;
        // ... existing stats logic ...
        db.collection('orders')
            .where('restaurantId', '==', user.uid)
            .where('status', '==', 'completed')
            .get()
            .then(snapshot => {
                let totalRevenue = 0;
                let totalOrders = 0;
                snapshot.forEach(doc => {
                    const order = doc.data();
                    totalRevenue += order.total || 0;
                    totalOrders++;
                });
                if (document.getElementById('totalRevenue')) document.getElementById('totalRevenue').textContent = `₹${totalRevenue.toFixed(2)}`;
                if (document.getElementById('totalOrders')) document.getElementById('totalOrders').textContent = totalOrders;
            });

        db.collection('products')
            .where('restaurantId', '==', user.uid)
            .get()
            .then(snapshot => {
                if (document.getElementById('totalProducts')) document.getElementById('totalProducts').textContent = snapshot.size;
            });
    }

    // Load recent orders
    function loadRecentOrders() {
        const user = auth.currentUser;
        const tbody = document.getElementById('recentOrders');
        if (!tbody) return;
        
        db.collection('orders')
            .where('restaurantId', '==', user.uid)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get()
            .then(snapshot => {
                tbody.innerHTML = '';
                if (snapshot.empty) {
                    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No orders yet</td></tr>';
                    return;
                }
                snapshot.forEach(doc => {
                    const order = doc.data();
                    const orderDate = order.createdAt?.toDate() || new Date();
                    const itemCount = order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
                    const row = document.createElement('tr');
                    row.className = 'border-b hover:bg-gray-50';
                    row.innerHTML = `
                        <td class="py-3 px-4"><div class="font-mono text-sm">${order.orderId || doc.id.substring(0, 8)}</div></td>
                        <td class="py-3 px-4">${orderDate.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})}</td>
                        <td class="py-3 px-4">${itemCount} items</td>
                        <td class="py-3 px-4 font-bold">₹${order.total ? order.total.toFixed(2) : '0.00'}</td>
                        <td class="py-3 px-4"><span class="px-2 py-1 text-xs rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">${order.status}</span></td>
                    `;
                    tbody.appendChild(row);
                });
            });
    }
});
