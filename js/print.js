// Thermal printing functions
function prepareReceipt() {
    const subtotal = parseFloat(document.getElementById('subtotal').textContent.replace('₹', ''));
    const gstAmount = parseFloat(document.getElementById('gstAmount').textContent.replace('₹', ''));
    const serviceCharge = parseFloat(document.getElementById('serviceCharge').textContent.replace('₹', ''));
    const total = parseFloat(document.getElementById('totalAmount').textContent.replace('₹', ''));
    
    const customerName = document.getElementById('customerName').value || 'Walk-in Customer';
    const customerPhone = document.getElementById('customerPhone').value || '';
    
    let receipt = `
        ${'='.repeat(32)}
            FASTFOOD RESTAURANT
        ${'='.repeat(32)}
        Date: ${new Date().toLocaleDateString('en-IN')}
        Time: ${new Date().toLocaleTimeString('en-IN', {hour12: true})}
        ${'-'.repeat(32)}
        Customer: ${customerName}
        Phone: ${customerPhone || 'N/A'}
        ${'-'.repeat(32)}
        ITEM            QTY   AMOUNT
        ${'-'.repeat(32)}
    `;
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        receipt += `${item.name.substring(0, 16).padEnd(16)} ${item.quantity.toString().padStart(3)}   ₹${itemTotal.toFixed(2).padStart(7)}\n`;
    });
    
    receipt += `
        ${'-'.repeat(32)}
        Subtotal:        ₹${subtotal.toFixed(2).padStart(10)}
        GST (18%):       ₹${gstAmount.toFixed(2).padStart(10)}
        Service (5%):    ₹${serviceCharge.toFixed(2).padStart(10)}
        ${'-'.repeat(32)}
        TOTAL:          ₹${total.toFixed(2).padStart(10)}
        ${'='.repeat(32)}
        Thank you for your visit!
        Please come again :)
        ${'='.repeat(32)}
        Order ID: ${generateOrderId()}
    `;
    
    document.getElementById('printContent').textContent = receipt;
}

function printReceipt() {
    const printContent = document.getElementById('printContent').textContent;
    
    // Try to print using thermal printer via WebUSB (for compatible printers)
    if (navigator.usb) {
        printViaUSB(printContent);
    } 
    // Try to print via Web Serial API
    else if ('serial' in navigator) {
        printViaSerial(printContent);
    }
    // Fallback to browser print
    else {
        printViaBrowser(printContent);
    }
    
    // Save the order to database
    saveOrderAndClearCart();
}

async function printViaUSB(printContent) {
    try {
        const vendorId = 0x0416; // Star Micronics vendor ID
        const productId = 0x5011; // Common thermal printer product ID
        
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId, productId }]
        });
        
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        // Convert text to bytes (ESC/POS commands)
        const encoder = new TextEncoder();
        const data = encoder.encode(printContent + '\n\n\n\n'); // Add line feeds for paper cut
        
        await device.transferOut(1, data);
        await device.close();
        
        showNotification('Receipt printed successfully!', 'success');
        closePrintModal();
    } catch (error) {
        console.error('USB printing failed:', error);
        printViaBrowser(printContent);
    }
}

async function printViaSerial(printContent) {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        
        const encoder = new TextEncoder();
        const writer = port.writable.getWriter();
        
        // ESC/POS initialization commands
        const initCommands = new Uint8Array([0x1B, 0x40]); // ESC @ - Initialize printer
        
        // Write initialization
        await writer.write(initCommands);
        
        // Write receipt content
        await writer.write(encoder.encode(printContent));
        
        // Add line feeds and cut command
        const cutCommands = new Uint8Array([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x10]); // Paper cut
        await writer.write(cutCommands);
        
        writer.releaseLock();
        await port.close();
        
        showNotification('Receipt printed successfully!', 'success');
        closePrintModal();
    } catch (error) {
        console.error('Serial printing failed:', error);
        printViaBrowser(printContent);
    }
}

function printViaBrowser(printContent) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Print Receipt</title>
                <style>
                    body {
                        font-family: monospace;
                        font-size: 12px;
                        width: 58mm;
                        margin: 0;
                        padding: 5px;
                    }
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <pre>${printContent}</pre>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 1000);
                    }
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

function saveOrderAndClearCart() {
    const user = auth.currentUser;
    const orderData = {
        restaurantId: user.uid,
        items: [...cart],
        customerName: document.getElementById('customerName').value || 'Walk-in Customer',
        customerPhone: document.getElementById('customerPhone').value || '',
        subtotal: parseFloat(document.getElementById('subtotal').textContent.replace('₹', '')),
        gstAmount: parseFloat(document.getElementById('gstAmount').textContent.replace('₹', '')),
        serviceCharge: parseFloat(document.getElementById('serviceCharge').textContent.replace('₹', '')),
        total: parseFloat(document.getElementById('totalAmount').textContent.replace('₹', '')),
        status: 'completed',
        orderId: generateOrderId(),
        printedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection('orders').add(orderData)
        .then(() => {
            cart = [];
            renderCart();
            updateTotals();
            document.getElementById('customerName').value = '';
            document.getElementById('customerPhone').value = '';
        })
        .catch(error => {
            console.error('Error saving order:', error);
        });
}

function generateOrderId() {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000);
    return `ORD${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${random.toString().padStart(3, '0')}`;
}

function closePrintModal() {
    document.getElementById('printModal').classList.add('hidden');
}

// Make functions available globally
window.printReceipt = printReceipt;
window.closePrintModal = closePrintModal;