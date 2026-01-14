// js/table-management.js
class TableManager {
    constructor() {
        this.tables = [];
        this.activeTableId = null;
        this.tableOrders = {};
        this.initializeTables();
    }

    initializeTables() {
        // Try to load from localStorage first
        const savedTables = localStorage.getItem('restaurantTables');
        const savedOrders = localStorage.getItem('tableOrders');
        const savedActive = localStorage.getItem('activeTableId');

        if (savedTables) {
            this.tables = JSON.parse(savedTables);
        } else {
            // Create default tables
            this.tables = [
                { id: 'table-1', name: 'Table 1', status: 'available', capacity: 4 },
                { id: 'table-2', name: 'Table 2', status: 'available', capacity: 4 },
                { id: 'table-3', name: 'Table 3', status: 'available', capacity: 4 },
                { id: 'table-4', name: 'Table 4', status: 'available', capacity: 4 }
            ];
        }

        if (savedOrders) {
            this.tableOrders = JSON.parse(savedOrders);
        } else {
            // Initialize empty orders for each table
            this.tables.forEach(table => {
                this.tableOrders[table.id] = {
                    orders: [],
                    customer: null,
                    subtotal: 0,
                    gst: 0,
                    service: 0,
                    total: 0
                };
            });
        }

        if (savedActive) {
            this.activeTableId = savedActive;
        }

        this.saveToStorage();
    }

    saveToStorage() {
        localStorage.setItem('restaurantTables', JSON.stringify(this.tables));
        localStorage.setItem('tableOrders', JSON.stringify(this.tableOrders));
        localStorage.setItem('activeTableId', this.activeTableId);
    }

    getAllTables() {
        return this.tables;
    }

    getTableById(tableId) {
        return this.tables.find(t => t.id === tableId);
    }

    setActiveTable(tableId) {
        this.activeTableId = tableId;
        this.saveToStorage();
        
        // Dispatch event for other components to listen
        document.dispatchEvent(new CustomEvent('tableChanged', {
            detail: { tableId }
        }));
    }

    getActiveTable() {
        return this.activeTableId;
    }

    occupyTable(tableId, customerInfo = null) {
        const table = this.getTableById(tableId);
        if (table) {
            table.status = 'occupied';
            
            if (customerInfo) {
                this.tableOrders[tableId].customer = {
                    name: customerInfo.name || '',
                    phone: customerInfo.phone || '',
                    guests: customerInfo.guests || 1
                };
            }
            
            this.setActiveTable(tableId);
            this.saveToStorage();
            return true;
        }
        return false;
    }

    clearTable(tableId) {
        const table = this.getTableById(tableId);
        if (table) {
            table.status = 'available';
            this.tableOrders[tableId] = {
                orders: [],
                customer: null,
                subtotal: 0,
                gst: 0,
                service: 0,
                total: 0
            };
            
            if (this.activeTableId === tableId) {
                this.activeTableId = null;
            }
            
            this.saveToStorage();
            return true;
        }
        return false;
    }

    addOrderToTable(tableId, orderItems, customerInfo = null) {
        if (!this.tableOrders[tableId]) {
            this.tableOrders[tableId] = {
                orders: [],
                customer: null,
                subtotal: 0,
                gst: 0,
                service: 0,
                total: 0
            };
        }

        // Create order group
        const orderGroup = {
            id: `order-${Date.now()}`,
            timestamp: new Date().toISOString(),
            items: JSON.parse(JSON.stringify(orderItems)), // Deep copy
            subtotal: orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };

        // Add to table's orders
        this.tableOrders[tableId].orders.push(orderGroup);
        
        // Update customer info if provided
        if (customerInfo && !this.tableOrders[tableId].customer) {
            this.tableOrders[tableId].customer = {
                name: customerInfo.name || '',
                phone: customerInfo.phone || '',
                guests: customerInfo.guests || 1
            };
        }

        // Update totals
        this.updateTableTotal(tableId);
        
        // Save to storage
        this.saveToStorage();
        
        return orderGroup;
    }

    updateTableTotal(tableId) {
        const tableOrder = this.tableOrders[tableId];
        if (!tableOrder) return;

        // Get restaurant settings
        const gstRate = window.restaurantSettings?.gstRate || 0;
        const serviceRate = window.restaurantSettings?.serviceCharge || 0;

        // Calculate from all orders
        const subtotal = tableOrder.orders.reduce((sum, order) => sum + order.subtotal, 0);
        const gst = subtotal * (gstRate / 100);
        const service = subtotal * (serviceRate / 100);
        const total = subtotal + gst + service;

        tableOrder.subtotal = subtotal;
        tableOrder.gst = gst;
        tableOrder.service = service;
        tableOrder.total = total;

        this.saveToStorage();
    }

    getTableOrders(tableId) {
        return this.tableOrders[tableId] || {
            orders: [],
            customer: null,
            subtotal: 0,
            gst: 0,
            service: 0,
            total: 0
        };
    }

    getTableCartItems(tableId) {
        const tableOrder = this.getTableOrders(tableId);
        const cartItems = [];
        
        tableOrder.orders.forEach(order => {
            order.items.forEach(item => {
                const existingItem = cartItems.find(ci => ci.id === item.id);
                if (existingItem) {
                    existingItem.quantity += item.quantity;
                } else {
                    cartItems.push({...item});
                }
            });
        });
        
        return cartItems;
    }

    splitTableBill(tableId, splitWays = 2) {
        const tableOrder = this.getTableOrders(tableId);
        if (!tableOrder || tableOrder.total === 0) return [];

        const perPerson = tableOrder.total / splitWays;
        const splitAmounts = [];

        for (let i = 0; i < splitWays; i++) {
            splitAmounts.push({
                person: i + 1,
                amount: perPerson,
                items: []
            });
        }

        return splitAmounts;
    }

    mergeTables(sourceTableId, targetTableId) {
        const sourceOrders = this.tableOrders[sourceTableId];
        const targetOrders = this.tableOrders[targetTableId];

        if (sourceOrders && targetOrders) {
            // Merge orders
            targetOrders.orders = [...targetOrders.orders, ...sourceOrders.orders];
            
            // Clear source table
            this.clearTable(sourceTableId);
            
            // Update target table totals
            this.updateTableTotal(targetTableId);
            
            return true;
        }
        return false;
    }
}

// Initialize global TableManager
window.TableManager = new TableManager();

// Helper functions
window.getStatusClass = function(status) {
    switch(status) {
        case 'available': return 'bg-green-100 text-green-800';
        case 'occupied': return 'bg-yellow-100 text-yellow-800';
        case 'reserved': return 'bg-blue-100 text-blue-800';
        case 'cleaning': return 'bg-pink-100 text-pink-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};
