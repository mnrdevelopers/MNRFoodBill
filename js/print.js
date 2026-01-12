// Thermal printing functions - Professional Restaurant Bill Style
async function prepareReceipt() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        // Fetch restaurant details from Firestore
        const doc = await db.collection('restaurants').doc(user.uid).get();
        if (!doc.exists) {
            throw new Error('Restaurant settings not found');
        }
        
        const restaurantData = doc.data();
        const settings = restaurantData.settings || {};
        
        const restaurant = {
            name: restaurantData.name || 'Restaurant Name',
            address: settings.address || '',
            phone: settings.phone || '',
            gstin: settings.gstin || '',
            fssai: settings.fssai || ''
        };
        
        const currency = settings.currency || '₹';
        const gstRate = parseFloat(settings.gstRate) || 0;
        const serviceRate = parseFloat(settings.serviceCharge) || 0;
        
        const subtotal = parseFloat(document.getElementById('subtotal')?.textContent.replace(currency, '') || 0);
        const gstAmount = parseFloat(document.getElementById('gstAmount')?.textContent.replace(currency, '') || 0);
        const serviceCharge = parseFloat(document.getElementById('serviceCharge')?.textContent.replace(currency, '') || 0);
        const total = parseFloat(document.getElementById('totalAmount')?.textContent.replace(currency, '') || 0);
        
        const customerName = document.getElementById('customerName')?.value || 'Walk-in Customer';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const paymentMode = document.getElementById('paymentMode')?.value || 'cash';
        const cashReceived = parseFloat(document.getElementById('cashReceived')?.value || 0);
        const changeAmount = parseFloat(document.getElementById('changeAmount')?.textContent.replace(currency, '') || 0);
        
        // Calculate CGST/SGST if applicable
        const cgstAmount = gstRate > 0 ? gstAmount / 2 : 0;
        const sgstAmount = gstRate > 0 ? gstAmount / 2 : 0;
        
        const now = new Date();
        const billNo = generateOrderId();
        const tableNo = 'T01'; // Could be made dynamic from UI if needed
        
        // Professional Restaurant Bill Design
        let receipt = `
========================================
        ${centerText(restaurant.name.toUpperCase(), 40)}
========================================
`;
        
        // Restaurant details in compact format
        if (restaurant.address) receipt += `${centerText(restaurant.address, 40)}\n`;
        if (restaurant.phone) receipt += `${centerText('📞 ' + restaurant.phone, 40)}\n`;
        if (restaurant.gstin) receipt += `${centerText('GSTIN: ' + restaurant.gstin, 40)}\n`;
        if (restaurant.fssai) receipt += `${centerText('FSSAI: ' + restaurant.fssai, 40)}\n`;
        
        receipt += `
----------------------------------------
Date: ${now.toLocaleDateString('en-IN')}
Time: ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}
Bill No: ${billNo}
Table: ${tableNo}
----------------------------------------
Customer: ${customerName}
`;
        
        if (customerPhone) {
            receipt += `Phone: ${customerPhone}\n`;
        }
        
        receipt += `
----------------------------------------
SL  ITEM              QTY   RATE    AMOUNT
----------------------------------------
`;
        
        // Add cart items with proper numbering
        let slNo = 1;
        cart.forEach(item => {
            const itemName = item.name;
            const qty = item.quantity;
            const rate = item.price.toFixed(2);
            const amount = (item.price * item.quantity).toFixed(2);
            
            // Handle long item names
            let displayName = itemName;
            if (itemName.length > 16) {
                displayName = itemName.substring(0, 16);
            }
            
            receipt += `${slNo.toString().padStart(2)}. ${displayName.padEnd(17)} ${qty.toString().padStart(3)}  ${currency}${rate.padStart(6)}  ${currency}${amount.padStart(7)}\n`;
            slNo++;
        });
        
        receipt += `
----------------------------------------
              BILL SUMMARY
----------------------------------------
Sub Total:                  ${currency}${subtotal.toFixed(2).padStart(10)}
`;
        
        if (serviceCharge > 0) {
            receipt += `Service Charge ${serviceRate}%:   ${currency}${serviceCharge.toFixed(2).padStart(10)}\n`;
        }
        
        if (gstRate > 0) {
            receipt += `CGST ${(gstRate/2).toFixed(1)}%:                 ${currency}${cgstAmount.toFixed(2).padStart(10)}\n`;
            receipt += `SGST ${(gstRate/2).toFixed(1)}%:                 ${currency}${sgstAmount.toFixed(2).padStart(10)}\n`;
        }
        
        receipt += `
----------------------------------------
GRAND TOTAL:                ${currency}${total.toFixed(2).padStart(10)}
========================================
`;
        
        // Payment details
        const paymentModeDisplay = paymentMode.toUpperCase();
        receipt += `Payment Mode: ${paymentModeDisplay}\n`;
        
        if (paymentMode === 'cash') {
            receipt += `Amount Paid:  ${currency}${cashReceived.toFixed(2)}\n`;
            receipt += `Change:       ${currency}${changeAmount.toFixed(2)}\n`;
        } else {
            receipt += `Amount Paid:  ${currency}${total.toFixed(2)}\n`;
        }
        
        receipt += `
----------------------------------------
Thank you for dining with us!
Please visit again.
========================================
** Computer Generated Bill **
** No Signature Required **
`;
        
        // Add restaurant phone for feedback if available
        if (restaurant.phone) {
            receipt += `
For feedback: ${restaurant.phone}
`;
        }
        
        receipt += `
========================================
`;

        // DIRECT PRINTING - No preview, print immediately
        await printDirectToPrinter(receipt);
        
        // Save the order after printing
        await saveOrderAndClearCart();
        
    } catch (error) {
        console.error("Error preparing receipt:", error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Direct print function for USB thermal printer
async function printDirectToPrinter(receiptContent) {
    try {
        // For mobile browsers, we'll use Web USB API if available
        if ('usb' in navigator) {
            await printWithWebUSB(receiptContent);
        } else if (window.escpos && window.escpos.USB) {
            // If ESC/POS library is available
            await printWithESCPOS(receiptContent);
        } else {
            // Fallback: Use print dialog but auto-print
            await printViaBrowserAuto(receiptContent);
        }
    } catch (error) {
        console.error("Print failed, using fallback:", error);
        // Fallback to browser print with auto-print
        await printViaBrowserAuto(receiptContent);
    }
}

// Web USB printing (for mobile with USB thermal printer)
async function printWithWebUSB(receiptContent) {
    try {
        // Request access to USB device
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: 0x0416, productId: 0x5011 }] // Common thermal printer IDs
        });
        
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        // ESC/POS commands for thermal printer
        const encoder = new TextEncoder();
        const commands = [
            '\x1B\x40', // Initialize printer
            '\x1B\x61\x01', // Center alignment
            ...receiptContent.split('\n').map(line => encoder.encode(line + '\n')),
            '\x0A\x0A\x0A', // Line feeds
            '\x1D\x56\x00' // Cut paper
        ];
        
        for (const command of commands) {
            await device.transferOut(1, encoder.encode(command));
        }
        
        await device.close();
        showNotification('Receipt printed successfully!', 'success');
        
    } catch (error) {
        console.error("USB printing failed:", error);
        throw error;
    }
}

// ESC/POS library printing
async function printWithESCPOS(receiptContent) {
    try {
        const printer = new escpos.USB();
        const options = { encoding: "UTF-8" };
        const device = new escpos.Serial(printer);
        
        device.open(function(err) {
            if (err) throw err;
            
            const printer = new escpos.Printer(device, options);
            
            printer
                .align('ct')
                .style('b')
                .text(receiptContent)
                .cut()
                .close();
            
            showNotification('Receipt printed successfully!', 'success');
        });
    } catch (error) {
        console.error("ESC/POS printing failed:", error);
        throw error;
    }
}

// Auto-print via browser (fallback)
async function printViaBrowserAuto(receiptContent) {
    return new Promise((resolve) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showNotification('Please allow pop-ups for printing', 'error');
            resolve();
            return;
        }
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Receipt</title>
                <style>
                    @media print {
                        body { 
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 80mm !important;
                            font-size: 12pt !important;
                        }
                        @page {
                            margin: 0 !important;
                            size: 80mm auto !important;
                        }
                    }
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 12pt;
                        width: 80mm;
                        margin: 0 auto;
                        padding: 0;
                        line-height: 1;
                        white-space: pre;
                    }
                </style>
            </head>
            <body>
                <pre>${receiptContent}</pre>
                <script>
                    // Auto-print and close
                    window.onload = function() {
                        setTimeout(() => {
                            window.print();
                            setTimeout(() => {
                                window.close();
                            }, 100);
                        }, 50);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
        
        // Resolve after a short delay
        setTimeout(resolve, 1000);
    });
}

// Center text helper function
function centerText(text, width) {
    const padding = Math.max(0, width - text.length);
    const leftPadding = Math.floor(padding / 2);
    const rightPadding = padding - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
}

// Updated printReceipt function for direct printing
function printReceipt() {
    const printContent = document.getElementById('printContent').textContent;
    printDirectToPrinter(printContent)
        .then(() => {
            // Save order after successful print
            saveOrderAndClearCart();
        })
        .catch(error => {
            console.error("Print error:", error);
            showNotification('Print failed: ' + error.message, 'error');
        });
}

async function saveOrderAndClearCart() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        // Get restaurant settings for currency
        const doc = await db.collection('restaurants').doc(user.uid).get();
        const settings = doc.data()?.settings || {};
        const currency = settings.currency || '₹';
        
        const paymentMode = document.getElementById('paymentMode')?.value || 'cash';
        const cashReceived = parseFloat(document.getElementById('cashReceived')?.value || 0);
        const changeAmount = parseFloat(document.getElementById('changeAmount')?.textContent.replace(currency, '') || 0);
        
        const orderData = {
            restaurantId: user.uid,
            items: [...cart],
            customerName: document.getElementById('customerName')?.value || 'Walk-in Customer',
            customerPhone: document.getElementById('customerPhone')?.value || '',
            subtotal: parseFloat(document.getElementById('subtotal')?.textContent.replace(currency, '') || 0),
            gstRate: parseFloat(settings.gstRate) || 0,
            gstAmount: parseFloat(document.getElementById('gstAmount')?.textContent.replace(currency, '') || 0),
            serviceChargeRate: parseFloat(settings.serviceCharge) || 0,
            serviceCharge: parseFloat(document.getElementById('serviceCharge')?.textContent.replace(currency, '') || 0),
            total: parseFloat(document.getElementById('totalAmount')?.textContent.replace(currency, '') || 0),
            paymentMode: paymentMode,
            cashReceived: paymentMode === 'cash' ? cashReceived : 0,
            changeAmount: paymentMode === 'cash' ? changeAmount : 0,
            status: 'completed',
            orderId: generateOrderId(),
            billNo: generateOrderId(),
            printedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('orders').add(orderData);
        
        // Clear cart and reset UI
        cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        // Clear all form fields
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('paymentMode').value = 'cash';
        document.getElementById('cashReceived').value = '';
        document.getElementById('changeAmount').textContent = `${currency}0.00`;
        
        // Reset UI to show cash fields
        document.getElementById('cashPaymentFields').classList.remove('hidden');
        document.getElementById('nonCashPaymentFields').classList.add('hidden');
        
        closePrintModal();
        showNotification('Order completed and receipt printed!', 'success');
    } catch (error) {
        console.error('Error saving order:', error);
        showNotification('Order printed but failed to save.', 'error');
    }
}

function generateOrderId() {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BILL${year}${month}${day}${random}`;
}

function closePrintModal() {
    const modal = document.getElementById('printModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// Make functions available globally
window.prepareReceipt = prepareReceipt;
window.printReceipt = printReceipt;
window.closePrintModal = closePrintModal;
window.printDirectToPrinter = printDirectToPrinter;
