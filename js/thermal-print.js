class ThermalPrinter {
    constructor() {
        this.printer = null;
        this.isConnected = false;
        this.encoding = 'UTF-8';
        this.maxChars = 42; // 80mm paper width
    }

    // Initialize printer connection
    async init() {
        try {
            // Check available interfaces
            if (navigator.usb) {
                await this.connectUSB();
            } else if (navigator.bluetooth) {
                await this.connectBluetooth();
            } else if (window.escpos) {
                await this.connectESCPOS();
            }
        } catch (error) {
            console.warn('No direct printer found, using browser print');
        }
    }

    // Connect to USB thermal printer
    async connectUSB() {
        try {
            const device = await navigator.usb.requestDevice({
                filters: [
                    { vendorId: 0x0416, productId: 0x5011 }, // Citizen
                    { vendorId: 0x0483, productId: 0x5740 }, // STMicro
                    { vendorId: 0x067B, productId: 0x2303 }, // Prolific
                    { vendorId: 0x1A86, productId: 0x7584 }  // CH340
                ]
            });

            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);
            
            this.printer = device;
            this.isConnected = true;
            this.interface = 'usb';
            
            console.log('USB Printer connected');
            return true;
        } catch (error) {
            console.error('USB connection failed:', error);
            return false;
        }
    }

    // Connect to Bluetooth printer
    async connectBluetooth() {
        try {
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'POS' }, { namePrefix: 'BT' }, { namePrefix: 'Printer' }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            
            this.printer = characteristic;
            this.isConnected = true;
            this.interface = 'bluetooth';
            
            console.log('Bluetooth Printer connected');
            return true;
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            return false;
        }
    }

    // ESC/POS commands
    getCommands() {
        return {
            INIT: '\x1B\x40',           // Initialize printer
            ALIGN_LEFT: '\x1B\x61\x00', // Left alignment
            ALIGN_CENTER: '\x1B\x61\x01', // Center alignment
            ALIGN_RIGHT: '\x1B\x61\x02', // Right alignment
            BOLD_ON: '\x1B\x45\x01',    // Bold on
            BOLD_OFF: '\x1B\x45\x00',   // Bold off
            DOUBLE_HEIGHT: '\x1B\x21\x10', // Double height
            DOUBLE_WIDTH: '\x1B\x21\x20',  // Double width
            NORMAL_TEXT: '\x1B\x21\x00',   // Normal text
            UNDERLINE_ON: '\x1B\x2D\x01',  // Underline on
            UNDERLINE_OFF: '\x1B\x2D\x00', // Underline off
            LINE_SPACING: '\x1B\x33',      // Set line spacing
            CUT_PAPER: '\x1D\x56\x00',     // Cut paper
            FEED_LINES: '\x1B\x64'         // Feed lines
        };
    }

    // Send raw data to printer
    async send(data) {
        if (!this.isConnected) {
            throw new Error('Printer not connected');
        }

        const encoder = new TextEncoder();
        
        if (this.interface === 'usb') {
            await this.printer.transferOut(1, encoder.encode(data));
        } else if (this.interface === 'bluetooth') {
            const buffer = encoder.encode(data);
            await this.printer.writeValue(buffer);
        }
    }

    // Format text for thermal printer
    formatText(text, options = {}) {
        const { 
            align = 'left', 
            bold = false, 
            size = 'normal',
            underline = false 
        } = options;
        
        let formatted = '';
        const cmd = this.getCommands();
        
        // Set alignment
        if (align === 'center') formatted += cmd.ALIGN_CENTER;
        else if (align === 'right') formatted += cmd.ALIGN_RIGHT;
        else formatted += cmd.ALIGN_LEFT;
        
        // Set text style
        if (bold) formatted += cmd.BOLD_ON;
        if (underline) formatted += cmd.UNDERLINE_ON;
        
        // Set text size
        if (size === 'double') formatted += cmd.DOUBLE_HEIGHT + cmd.DOUBLE_WIDTH;
        else if (size === 'large') formatted += cmd.DOUBLE_HEIGHT;
        
        formatted += text;
        
        // Reset styles
        if (bold) formatted += cmd.BOLD_OFF;
        if (underline) formatted += cmd.UNDERLINE_OFF;
        if (size !== 'normal') formatted += cmd.NORMAL_TEXT;
        
        return formatted;
    }

    // Print receipt directly (Vyapar style)
    async printReceipt(receiptData) {
        const cmd = this.getCommands();
        let output = cmd.INIT;
        
        try {
            // Header
            output += this.formatText(receiptData.restaurant.name.toUpperCase(), 
                { align: 'center', bold: true, size: 'double' }) + '\n';
            
            output += cmd.LINE_SPACING + '\x18'; // Line spacing
            
            // Restaurant details
            if (receiptData.restaurant.address) {
                output += this.formatText(receiptData.restaurant.address, 
                    { align: 'center' }) + '\n';
            }
            
            if (receiptData.restaurant.phone) {
                output += this.formatText(`📞 ${receiptData.restaurant.phone}`, 
                    { align: 'center' }) + '\n';
            }
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Bill info
            output += this.formatText(`Date: ${receiptData.date}`, { bold: true }) + '\n';
            output += this.formatText(`Time: ${receiptData.time}`, { bold: true }) + '\n';
            output += this.formatText(`Bill No: ${receiptData.billNo}`, { bold: true }) + '\n';
            
            if (receiptData.tableNo) {
                output += this.formatText(`Table: ${receiptData.tableNo}`, { bold: true }) + '\n';
            }
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Customer info
            output += this.formatText(`Customer: ${receiptData.customer.name}`, { bold: true }) + '\n';
            if (receiptData.customer.phone) {
                output += this.formatText(`Phone: ${receiptData.customer.phone}`, { bold: true }) + '\n';
            }
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Items header
            output += this.formatText('SL  Item                Qty   Amount', { bold: true, underline: true }) + '\n';
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Items list
            receiptData.items.forEach((item, index) => {
                const sl = (index + 1).toString().padStart(2);
                const name = item.name.length > 18 ? item.name.substring(0, 18) + '...' : item.name.padEnd(20);
                const qty = item.quantity.toString().padStart(3);
                const amount = receiptData.currency + item.total.toFixed(2).padStart(8);
                
                output += `${sl}. ${name} ${qty}  ${amount}\n`;
                
                // Print variations if any
                if (item.variations && item.variations.length > 0) {
                    item.variations.forEach(variation => {
                        output += `   ${variation.name}: ${variation.value}\n`;
                    });
                }
            });
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Bill summary
            output += this.formatText('BILL SUMMARY', { align: 'center', bold: true, size: 'large' }) + '\n';
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            output += this.formatText(
                `Sub Total:${' '.repeat(20)}${receiptData.currency}${receiptData.subtotal.toFixed(2).padStart(10)}`, 
                { bold: true }) + '\n';
            
            if (receiptData.discount > 0) {
                output += this.formatText(
                    `Discount:${' '.repeat(21)}${receiptData.currency}${receiptData.discount.toFixed(2).padStart(10)}`, 
                    { bold: true }) + '\n';
            }
            
            if (receiptData.tax > 0) {
                output += this.formatText(
                    `Tax (${receiptData.taxRate}%):${' '.repeat(15)}${receiptData.currency}${receiptData.tax.toFixed(2).padStart(10)}`, 
                    { bold: true }) + '\n';
            }
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Grand Total
            output += this.formatText(
                `GRAND TOTAL:${' '.repeat(17)}${receiptData.currency}${receiptData.grandTotal.toFixed(2).padStart(10)}`, 
                { align: 'center', bold: true, size: 'large' }) + '\n';
            
            output += this.formatText('='.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Payment details
            output += this.formatText('PAYMENT DETAILS', { align: 'center', bold: true }) + '\n';
            output += this.formatText(
                `Mode: ${receiptData.payment.mode.toUpperCase()}`, 
                { bold: true }) + '\n';
            
            if (receiptData.payment.mode === 'cash') {
                output += this.formatText(
                    `Received: ${receiptData.currency}${receiptData.payment.received.toFixed(2)}`, 
                    { bold: true }) + '\n';
                output += this.formatText(
                    `Change: ${receiptData.currency}${receiptData.payment.change.toFixed(2)}`, 
                    { bold: true }) + '\n';
            }
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Footer
            output += this.formatText('Thank you for your visit!', { align: 'center', bold: true }) + '\n';
            output += this.formatText('Please visit again', { align: 'center' }) + '\n';
            
            if (receiptData.restaurant.phone) {
                output += this.formatText(`For feedback: ${receiptData.restaurant.phone}`, { align: 'center' }) + '\n';
            }
            
            output += this.formatText('*' + '-'.repeat(this.maxChars - 2) + '*', { align: 'center' }) + '\n';
            output += this.formatText('** COMPUTER GENERATED BILL **', { align: 'center' }) + '\n';
            output += this.formatText('** NO SIGNATURE REQUIRED **', { align: 'center' }) + '\n';
            output += this.formatText('='.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            // Feed and cut
            output += cmd.FEED_LINES + '\x03'; // Feed 3 lines
            output += cmd.CUT_PAPER;
            
            // Send to printer
            await this.send(output);
            
            console.log('Receipt printed successfully');
            return true;
            
        } catch (error) {
            console.error('Print error:', error);
            throw error;
        }
    }

    // Print kitchen order (KOT)
    async printKOT(orderData) {
        const cmd = this.getCommands();
        let output = cmd.INIT;
        
        try {
            output += this.formatText('KITCHEN ORDER TICKET', 
                { align: 'center', bold: true, size: 'double' }) + '\n';
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            output += this.formatText(`Order No: ${orderData.orderId}`, { bold: true }) + '\n';
            output += this.formatText(`Time: ${new Date().toLocaleTimeString()}`, { bold: true }) + '\n';
            output += this.formatText(`Table: ${orderData.tableNo || 'Take Away'}`, { bold: true }) + '\n';
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            
            output += this.formatText('Items:', { bold: true, underline: true }) + '\n';
            
            orderData.items.forEach((item, index) => {
                output += this.formatText(`${item.quantity}x ${item.name}`, { bold: true }) + '\n';
                
                if (item.instructions) {
                    output += this.formatText(`  Note: ${item.instructions}`, {}) + '\n';
                }
                
                if (item.variations && item.variations.length > 0) {
                    item.variations.forEach(variation => {
                        output += this.formatText(`  ${variation.name}: ${variation.value}`, {}) + '\n';
                    });
                }
            });
            
            output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
            output += this.formatText('*** KITCHEN COPY ***', { align: 'center', bold: true }) + '\n';
            output += cmd.FEED_LINES + '\x02';
            output += cmd.CUT_PAPER;
            
            await this.send(output);
            return true;
            
        } catch (error) {
            console.error('KOT print error:', error);
            throw error;
        }
    }

    // Print test page
    async printTest() {
        const cmd = this.getCommands();
        let output = cmd.INIT;
        
        output += this.formatText('PRINTER TEST PAGE', { align: 'center', bold: true, size: 'double' }) + '\n';
        output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
        output += this.formatText('Vyapar Style Thermal Printing', { align: 'center' }) + '\n';
        output += this.formatText(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' }) + '\n';
        output += this.formatText(`Time: ${new Date().toLocaleTimeString()}`, { align: 'center' }) + '\n';
        output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
        output += this.formatText('ABCDEFGHIJKLMNOPQRSTUVWXYZ', {}) + '\n';
        output += this.formatText('abcdefghijklmnopqrstuvwxyz', {}) + '\n';
        output += this.formatText('1234567890!@#$%^&*()', {}) + '\n';
        output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
        output += this.formatText('Normal Text', {}) + '\n';
        output += this.formatText('Bold Text', { bold: true }) + '\n';
        output += this.formatText('Large Text', { size: 'large' }) + '\n';
        output += this.formatText('Double Size', { size: 'double' }) + '\n';
        output += this.formatText('-'.repeat(this.maxChars), { align: 'center' }) + '\n';
        output += this.formatText('*** TEST COMPLETE ***', { align: 'center', bold: true }) + '\n';
        output += cmd.FEED_LINES + '\x03';
        output += cmd.CUT_PAPER;
        
        await this.send(output);
    }

    // Disconnect printer
    async disconnect() {
        if (this.printer) {
            if (this.interface === 'usb') {
                await this.printer.close();
            } else if (this.interface === 'bluetooth') {
                const server = await this.printer.service.device.gatt;
                if (server.connected) {
                    server.disconnect();
                }
            }
        }
        this.printer = null;
        this.isConnected = false;
    }
}

// Global printer instance
window.thermalPrinter = new ThermalPrinter();

// Simplified printing function for billing page
async function printBillDirect() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        // Get restaurant data
        const restaurantDoc = await db.collection('restaurants').doc(user.uid).get();
        if (!restaurantDoc.exists) {
            throw new Error('Restaurant not found');
        }
        
        const restaurantData = restaurantDoc.data();
        const settings = restaurantData.settings || {};
        
        // Calculate totals from cart
        const currency = settings.currency || '₹';
        const gstRate = parseFloat(settings.gstRate) || 0;
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gstAmount = subtotal * (gstRate / 100);
        const grandTotal = subtotal + gstAmount;
        
        // Get customer details
        const customerName = document.getElementById('customerName')?.value || 'Walk-in Customer';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const paymentMode = document.getElementById('paymentMode')?.value || 'cash';
        const cashReceived = parseFloat(document.getElementById('cashReceived')?.value || 0);
        const changeAmount = cashReceived - grandTotal;
        
        // Prepare receipt data
        const receiptData = {
            restaurant: {
                name: restaurantData.name || 'Restaurant',
                address: settings.address || '',
                phone: settings.phone || '',
                gstin: settings.gstin || '',
                fssai: settings.fssai || ''
            },
            date: new Date().toLocaleDateString('en-IN'),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            billNo: generateOrderId(),
            tableNo: 'T01',
            customer: {
                name: customerName,
                phone: customerPhone
            },
            items: cart.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity
            })),
            currency: currency,
            subtotal: subtotal,
            discount: 0,
            tax: gstAmount,
            taxRate: gstRate,
            grandTotal: grandTotal,
            payment: {
                mode: paymentMode,
                received: paymentMode === 'cash' ? cashReceived : grandTotal,
                change: paymentMode === 'cash' ? Math.max(0, changeAmount) : 0
            }
        };
        
        // Initialize printer if not already done
        if (!window.thermalPrinter.isConnected) {
            await window.thermalPrinter.init();
        }
        
        // Print receipt
        await window.thermalPrinter.printReceipt(receiptData);
        
        // Save order
        await saveOrderAfterPrint(receiptData);
        
        // Clear cart
        cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        // Reset form
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('paymentMode').value = 'cash';
        document.getElementById('cashReceived').value = '';
        document.getElementById('changeAmount').textContent = `${currency}0.00`;
        
        showNotification('Bill printed successfully!', 'success');
        
    } catch (error) {
        console.error('Print error:', error);
        
        // Fallback to browser print
        await printFallbackReceipt();
        showNotification('Printed via fallback method', 'info');
    }
}

// Fallback browser printing
async function printFallbackReceipt() {
    // Prepare simple receipt for browser print
    const receiptContent = generateSimpleReceipt();
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Receipt</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0; width: 80mm; }
                    @page { size: 80mm auto; margin: 0; }
                }
                body {
                    font-family: monospace;
                    font-size: 12px;
                    width: 80mm;
                    margin: 0;
                    padding: 5mm;
                    line-height: 1;
                    white-space: pre;
                }
            </style>
        </head>
        <body>
            <pre>${receiptContent}</pre>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 100);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Save order after printing
async function saveOrderAfterPrint(receiptData) {
    const user = auth.currentUser;
    if (!user) return;
    
    const orderData = {
        restaurantId: user.uid,
        items: [...cart],
        customerName: receiptData.customer.name,
        customerPhone: receiptData.customer.phone,
        subtotal: receiptData.subtotal,
        gstRate: receiptData.taxRate,
        gstAmount: receiptData.tax,
        grandTotal: receiptData.grandTotal,
        paymentMode: receiptData.payment.mode,
        cashReceived: receiptData.payment.mode === 'cash' ? receiptData.payment.received : 0,
        changeAmount: receiptData.payment.change,
        status: 'completed',
        orderId: receiptData.billNo,
        billNo: receiptData.billNo,
        printedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('orders').add(orderData);
}

// Generate simple receipt for fallback
function generateSimpleReceipt() {
    const restaurantName = document.getElementById('restaurantName')?.textContent || 'Restaurant';
    const now = new Date();
    
    return `
${'='.repeat(42)}
        ${restaurantName.toUpperCase()}
${'='.repeat(42)}
Date: ${now.toLocaleDateString('en-IN')}
Time: ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}
Bill No: ${generateOrderId()}
${'-'.repeat(42)}
Customer: ${document.getElementById('customerName')?.value || 'Walk-in Customer'}
${'-'.repeat(42)}
ITEMS                QTY   AMOUNT
${'-'.repeat(42)}
${cart.map(item => {
    const name = item.name.length > 18 ? item.name.substring(0, 18) + '...' : item.name.padEnd(20);
    const qty = item.quantity.toString().padStart(3);
    const amount = `₹${(item.price * item.quantity).toFixed(2).padStart(8)}`;
    return `${name} ${qty}  ${amount}`;
}).join('\n')}
${'-'.repeat(42)}
Total: ₹${cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
${'='.repeat(42)}
Thank you for your visit!
Please visit again.
${'='.repeat(42)}
`;
}

// Generate order ID
function generateOrderId() {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BILL${year}${month}${day}${random}`;
}

// Initialize printer on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check if we're on billing page
    if (window.location.pathname.includes('billing.html')) {
        // Initialize thermal printer
        await window.thermalPrinter.init();
        
        // Add printer status indicator
        addPrinterStatus();
    }
});

// Add printer status to UI
function addPrinterStatus() {
    const statusHtml = `
        <div id="printerStatus" class="fixed bottom-4 right-4 z-50">
            <div class="bg-white rounded-lg shadow-lg p-3 flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full ${window.thermalPrinter.isConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
                <span class="text-sm font-medium">${window.thermalPrinter.isConnected ? 'Printer Connected' : 'Printer Offline'}</span>
                ${!window.thermalPrinter.isConnected ? 
                    '<button onclick="connectPrinter()" class="text-blue-500 text-sm ml-2">Connect</button>' : 
                    '<button onclick="printTestPage()" class="text-gray-500 text-sm ml-2">Test</button>'
                }
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', statusHtml);
}

// Connect printer manually
async function connectPrinter() {
    showNotification('Connecting to printer...', 'info');
    await window.thermalPrinter.init();
    
    const statusDiv = document.getElementById('printerStatus');
    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-3 flex items-center space-x-2">
                <div class="w-3 h-3 rounded-full ${window.thermalPrinter.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}"></div>
                <span class="text-sm font-medium">${window.thermalPrinter.isConnected ? 'Printer Connected' : 'Connection Failed'}</span>
            </div>
        `;
    }
    
    if (window.thermalPrinter.isConnected) {
        showNotification('Printer connected successfully!', 'success');
    } else {
        showNotification('Could not connect to printer', 'error');
    }
}

// Print test page
async function printTestPage() {
    try {
        await window.thermalPrinter.printTest();
        showNotification('Test page printed', 'success');
    } catch (error) {
        showNotification('Test print failed', 'error');
    }
}

// Make functions globally available
window.printBillDirect = printBillDirect;
window.connectPrinter = connectPrinter;
window.printTestPage = printTestPage;
