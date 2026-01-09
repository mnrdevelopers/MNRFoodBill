/**
 * Professional Thermal Print Module
 * Standard 32-character width for 58mm thermal printers
 */

function prepareReceipt() {
    // Access global state from billing.js/orders.js
    const currency = (typeof restaurantSettings !== 'undefined' && restaurantSettings.currency) ? restaurantSettings.currency : '₹';
    const restaurantName = (typeof restaurantSettings !== 'undefined' && restaurantSettings.name) ? restaurantSettings.name.toUpperCase() : 'RESTAURANT';
    const restaurantAddress = (typeof restaurantSettings !== 'undefined' && restaurantSettings.address) ? restaurantSettings.address : '';
    
    // Values from UI elements
    const subtotal = parseFloat(document.getElementById('subtotal').textContent.replace(currency, '')) || 0;
    const gstAmount = parseFloat(document.getElementById('gstAmount').textContent.replace(currency, '')) || 0;
    const serviceCharge = parseFloat(document.getElementById('serviceCharge').textContent.replace(currency, '')) || 0;
    const total = parseFloat(document.getElementById('totalAmount').textContent.replace(currency, '')) || 0;
    
    const customerName = document.getElementById('customerName').value || 'Walk-in Customer';
    const customerPhone = document.getElementById('customerPhone').value || '';
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN');
    const timeStr = now.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' });
    
    // Build receipt string
    let receipt = "";
    
    // Header
    receipt += `${'='.repeat(32)}\n`;
    receipt += centerText(restaurantName, 32) + "\n";
    if (restaurantAddress) {
        receipt += centerText(restaurantAddress, 32) + "\n";
    }
    receipt += `${'='.repeat(32)}\n`;
    
    // Bill Info
    receipt += `Order: ${generateOrderId()}\n`;
    receipt += `Date : ${dateStr}  ${timeStr}\n`;
    receipt += `Cust : ${customerName}\n`;
    if (customerPhone) receipt += `Ph   : ${customerPhone}\n`;
    receipt += `${'-'.repeat(32)}\n`;
    
    // Table Header
    receipt += `ITEM            QTY   AMOUNT\n`;
    receipt += `${'-'.repeat(32)}\n`;
    
    // Items
    cart.forEach(item => {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        // Multiline name handling if name > 16 chars
        const name = item.name.substring(0, 16).padEnd(16);
        const qty = item.quantity.toString().padStart(3);
        const amt = `${currency}${itemTotal}`.padStart(9);
        receipt += `${name} ${qty} ${amt}\n`;
    });
    
    // Totals
    receipt += `${'-'.repeat(32)}\n`;
    receipt += `Subtotal:`.padEnd(20) + `${currency}${subtotal.toFixed(2)}`.padStart(12) + "\n";
    
    if (restaurantSettings.gstRate > 0) {
        receipt += `GST (${restaurantSettings.gstRate}%):`.padEnd(20) + `${currency}${gstAmount.toFixed(2)}`.padStart(12) + "\n";
    }
    
    if (restaurantSettings.serviceCharge > 0) {
        receipt += `Srv. Chg (${restaurantSettings.serviceCharge}%):`.padEnd(20) + `${currency}${serviceCharge.toFixed(2)}`.padStart(12) + "\n";
    }
    
    receipt += `${'-'.repeat(32)}\n`;
    receipt += `TOTAL:`.padEnd(15) + `${currency}${total.toFixed(2)}`.padStart(17) + "\n";
    receipt += `${'='.repeat(32)}\n`;
    
    // Footer
    receipt += centerText("THANK YOU FOR YOUR VISIT", 32) + "\n";
    receipt += centerText("Please come again!", 32) + "\n";
    receipt += `${'='.repeat(32)}\n`;
    receipt += centerText("MNRFoodBill System", 32) + "\n";

    document.getElementById('printContent').textContent = receipt;
}

/**
 * Helper to center text for thermal output
 */
function centerText(text, width) {
    if (text.length >= width) return text.substring(0, width);
    const leftPadding = Math.floor((width - text.length) / 2);
    return " ".repeat(leftPadding) + text;
}

function printReceipt() {
    const printContent = document.getElementById('printContent').textContent;
    
    // Check for browser print fallback (most common for thermal printers via drivers)
    printViaBrowser(printContent);
    
    // Save order to DB after trigger
    saveOrderAndClearCart();
}

function printViaBrowser(printContent) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Bill Receipt</title>
                <style>
                    @page {
                        margin: 0;
                    }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                        width: 58mm; /* Standard Thermal Width */
                        margin: 0;
                        padding: 10px;
                        background: white;
                    }
                    pre {
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                <pre>${printContent}</pre>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() { window.close(); };
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function saveOrderAndClearCart() {
    const user = auth.currentUser;
    if (!user) return;
    
    const currency = restaurantSettings.currency || '₹';
    
    const orderData = {
        restaurantId: user.uid,
        items: [...cart],
        customerName: document.getElementById('customerName').value || 'Walk-in Customer',
        customerPhone: document.getElementById('customerPhone').value || '',
        subtotal: parseFloat(document.getElementById('subtotal').textContent.replace(currency, '')),
        gstAmount: parseFloat(document.getElementById('gstAmount').textContent.replace(currency, '')),
        gstRate: restaurantSettings.gstRate || 0,
        serviceCharge: parseFloat(document.getElementById('serviceCharge').textContent.replace(currency, '')),
        serviceChargeRate: restaurantSettings.serviceCharge || 0,
        total: parseFloat(document.getElementById('totalAmount').textContent.replace(currency, '')),
        status: 'completed',
        orderId: generateOrderId(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('orders').add(orderData)
        .then(() => {
            cart = [];
            if (typeof renderCart === 'function') renderCart();
            if (typeof updateTotals === 'function') updateTotals();
            
            document.getElementById('customerName').value = '';
            document.getElementById('customerPhone').value = '';
            closePrintModal();
            showNotification('Order completed successfully.', 'success');
        })
        .catch(error => {
            console.error('Error saving order:', error);
            showNotification('Error saving order record.', 'error');
        });
}

function generateOrderId() {
    const d = new Date();
    return `INV-${d.getFullYear()}${(d.getMonth()+1).toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}-${Math.floor(100 + Math.random() * 900)}`;
}

function closePrintModal() {
    const modal = document.getElementById('printModal');
    if (modal) modal.classList.add('hidden');
}

window.prepareReceipt = prepareReceipt;
window.printReceipt = printReceipt;
window.closePrintModal = closePrintModal;
