// js/table-management.js
let tables = [];
let activeTable = null;
let tableOrders = {}; // {tableId: {orders: [], customer: {}, total: 0}}

class TableManager {
    constructor() {
        this.initializeTables();
    }

    initializeTables() {
        // Create 4 tables by default (can be extended)
        tables = [
            { id: 'table-1', name: 'Table 1', status: 'available', capacity: 4 },
            { id: 'table-2', name: 'Table 2', status: 'available', capacity: 4 },
            { id: 'table-3', name: 'Table 3', status: 'available', capacity: 4 },
            { id: 'table-4', name: 'Table 4', status: 'available', capacity: 4 }
        ];
        
        // Initialize table orders
        tables.forEach(table => {
            tableOrders[table.id] = {
                orders: [],
                customer: null,
                total: 0,
                subtotal: 0,
                gst: 0,
                service: 0
            };
        });
    }

    setActiveTable(tableId) {
        activeTable = tableId;
        // Load cart from this table's orders
        loadCartFromTable(tableId);
    }

    getActiveTable() {
        return activeTable;
    }

    getTableStatus(tableId) {
        const table = tables.find(t => t.id === tableId);
        return table ? table.status : 'available';
    }

    markTableOccupied(tableId, customerInfo = null) {
        const table = tables.find(t => t.id === tableId);
        if (table) {
            table.status = 'occupied';
            if (customerInfo) {
                tableOrders[tableId].customer = customerInfo;
            }
            saveTablesToLocalStorage();
        }
    }

    markTableAvailable(tableId) {
        const table = tables.find(t => t.id === tableId);
        if (table) {
            table.status = 'available';
            tableOrders[tableId] = {
                orders: [],
                customer: null,
                total: 0,
                subtotal: 0,
                gst: 0,
                service: 0
            };
            saveTablesToLocalStorage();
        }
    }

    addOrderToTable(tableId, orderItems, customerInfo = null) {
        if (!tableOrders[tableId]) {
            tableOrders[tableId] = {
                orders: [],
                customer: null,
                total: 0,
                subtotal: 0,
                gst: 0,
                service: 0
            };
        }

        // Create a new order group
        const orderGroup = {
            id: `order-${Date.now()}`,
            timestamp: new Date(),
            items: [...orderItems],
            subtotal: orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };

        tableOrders[tableId].orders.push(orderGroup);
        
        if (customerInfo && !tableOrders[tableId].customer) {
            tableOrders[tableId].customer = customerInfo;
        }

        this.updateTableTotal(tableId);
        saveTablesToLocalStorage();
        return orderGroup;
    }

    updateTableTotal(tableId) {
        const tableOrder = tableOrders[tableId];
        if (!tableOrder) return;

        // Calculate totals from all order groups
        const subtotal = tableOrder.orders.reduce((sum, order) => sum + order.subtotal, 0);
        const gst = subtotal * (restaurantSettings.gstRate / 100);
        const service = subtotal * (restaurantSettings.serviceCharge / 100);
        const total = subtotal + gst + service;

        tableOrder.subtotal = subtotal;
        tableOrder.gst = gst;
        tableOrder.service = service;
        tableOrder.total = total;

        saveTablesToLocalStorage();
    }

    getTableOrders(tableId) {
        return tableOrders[tableId] || { orders: [], customer: null, total: 0 };
    }

    getAllTables() {
        return tables;
    }

    getTableById(tableId) {
        return tables.find(t => t.id === tableId);
    }

    clearTableOrder(tableId) {
        tableOrders[tableId] = {
            orders: [],
            customer: null,
            total: 0,
            subtotal: 0,
            gst: 0,
            service: 0
        };
        this.markTableAvailable(tableId);
        saveTablesToLocalStorage();
    }

    mergeTables(sourceTableId, targetTableId) {
        // Merge orders from source table to target table
        const sourceOrders = tableOrders[sourceTableId];
        const targetOrders = tableOrders[targetTableId];

        if (sourceOrders && targetOrders) {
            targetOrders.orders = [...targetOrders.orders, ...sourceOrders.orders];
            this.updateTableTotal(targetTableId);
            this.clearTableOrder(sourceTableId);
        }
    }

    splitTableBill(tableId, splitWays = 2) {
        const tableOrder = tableOrders[tableId];
        if (!tableOrder || tableOrder.orders.length === 0) return [];

        const splitAmounts = [];
        const perPerson = tableOrder.total / splitWays;

        for (let i = 0; i < splitWays; i++) {
            splitAmounts.push({
                person: i + 1,
                amount: perPerson,
                items: tableOrder.orders.flatMap(order => order.items)
            });
        }

        return splitAmounts;
    }
}

// Load cart from table's orders
function loadCartFromTable(tableId) {
    const tableOrder = tableOrders[tableId];
    if (!tableOrder) {
        cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        return;
    }

    // Combine all items from all order groups
    cart = [];
    tableOrder.orders.forEach(orderGroup => {
        orderGroup.items.forEach(item => {
            const existingItem = cart.find(cartItem => cartItem.id === item.id);
            if (existingItem) {
                existingItem.quantity += item.quantity;
            } else {
                cart.push({...item});
            }
        });
    });

    if (typeof renderCart === 'function') renderCart();
    if (typeof updateTotals === 'function') updateTotals();

    // Set customer info if available
    if (tableOrder.customer) {
        document.getElementById('customerName').value = tableOrder.customer.name || '';
        document.getElementById('customerPhone').value = tableOrder.customer.phone || '';
    }
}

function saveTablesToLocalStorage() {
    localStorage.setItem('restaurantTables', JSON.stringify(tables));
    localStorage.setItem('tableOrders', JSON.stringify(tableOrders));
}

function loadTablesFromLocalStorage() {
    const savedTables = localStorage.getItem('restaurantTables');
    const savedOrders = localStorage.getItem('tableOrders');

    if (savedTables) {
        tables = JSON.parse(savedTables);
    }

    if (savedOrders) {
        tableOrders = JSON.parse(savedOrders);
    }
}

// Initialize global TableManager
window.TableManager = new TableManager();
window.loadTablesFromLocalStorage = loadTablesFromLocalStorage;
window.loadCartFromTable = loadCartFromTable;
