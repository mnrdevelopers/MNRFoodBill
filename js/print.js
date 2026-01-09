// Direct thermal printing via WebUSB/WebSerial
let printerConnected = false;
let printerType = null; // 'usb' or 'serial'

// Try to auto-connect to printer on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check for printer availability
    if (navigator.usb) {
        console.log('WebUSB available for thermal printer');
    }
    if ('serial' in navigator) {
        console.log('WebSerial available for thermal printer');
    }
});

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
            name: restaurantData.name || '',
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
        const tableNo = 'T01';
        
        let receipt = '';
        
        // Add ESC/POS commands for thermal printer
        receipt += '\x1B\x40'; // Initialize printer
        receipt += '\x1B\x61\x01'; // Center alignment
        
        // Restaurant name (bold, centered, double height)
        receipt += '\x1B\x21\x30'; // Double height and width
        receipt += `\n${restaurant.name.toUpperCase()}\n`;
        receipt += '\x1B\x21\x00'; // Normal text
        
        receipt += '\x1B\x61\x00'; // Left alignment
        
        // Add restaurant details only if they exist
        if (restaurant.address) receipt += `${restaurant.address}\n`;
        if (restaurant.phone) receipt += `${restaurant.phone}\n`;
        if (restaurant.gstin) receipt += `${restaurant.gstin}\n`;
        if (restaurant.fssai) receipt += `${restaurant.fssai}\n`;
        
        receipt += '------------------------------------------\n';
        receipt += `Date: ${now.toLocaleDateString('en-IN')}\n`;
        receipt += `Time: ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
        receipt += `Bill No: ${billNo}\n`;
        receipt += `Table: ${tableNo}\n`;
        receipt += '------------------------------------------\n';
        receipt += `Customer: ${customerName}\n`;
        
        if (customerPhone) {
            receipt += `Phone: ${customerPhone}\n`;
        }
        
        receipt += '------------------------------------------\n';
        receipt += 'SL  ITEM              QTY   RATE    AMOUNT\n';
        receipt += '------------------------------------------\n';
        
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
        
        receipt += '------------------------------------------\n';
        receipt += '                BILL SUMMARY\n';
        receipt += '------------------------------------------\n';
        receipt += `Sub Total:                  ${currency}${subtotal.toFixed(2).padStart(10)}\n`;
        
        if (serviceCharge > 0) {
            receipt += `Service Charge ${serviceRate}%:   ${currency}${serviceCharge.toFixed(2).padStart(10)}\n`;
        }
        
        if (gstRate > 0) {
            receipt += `CGST ${(gstRate/2).toFixed(1)}%:                 ${currency}${cgstAmount.toFixed(2).padStart(10)}\n`;
            receipt += `SGST ${(gstRate/2).toFixed(1)}%:                 ${currency}${sgstAmount.toFixed(2).padStart(10)}\n`;
        }
        
        receipt += '------------------------------------------\n';
        receipt += `GRAND TOTAL:                ${currency}${total.toFixed(2).padStart(10)}\n`;
        receipt += '==========================================\n';
        
        // Payment details
        const paymentModeDisplay = paymentMode.toUpperCase();
        receipt += `Payment Mode: ${paymentModeDisplay}\n`;
        
        if (paymentMode === 'cash') {
            receipt += `Amount Paid:  ${currency}${cashReceived.toFixed(2)}\n`;
            receipt += `Change:       ${currency}${changeAmount.toFixed(2)}\n`;
        } else {
            receipt += `Amount Paid:  ${currency}${total.toFixed(2)}\n`;
        }
        
        receipt += '==========================================\n';
        receipt += 'Thank you for dining with us!\n';
        receipt += 'Please visit again.\n';
        receipt += '------------------------------------------\n';
        receipt += '** This is a computer generated bill **\n';
        receipt += '** No signature required **\n';
        
        // Add restaurant phone for feedback if available
        if (restaurant.phone) {
            receipt += `\nFor feedback: ${restaurant.phone}\n`;
        }
        
        receipt += '------------------------------------------\n';
        
        // Add paper cut commands
        receipt += '\n\n\n\n\x1D\x56\x41\x10'; // Paper cut
        
        // Store receipt for printing
        window.currentReceipt = receipt;
        
        // Display for preview
        document.getElementById('printContent').textContent = formatForDisplay(receipt);
    } catch (error) {
        console.error("Error preparing receipt:", error);
        showNotification('Error loading restaurant details', 'error');
    }
}

// Format receipt for display (remove ESC/POS commands)
function formatForDisplay(receipt) {
    // Remove ESC/POS commands for display
    let displayText = receipt.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
    displayText = displayText.replace(/\x1B\x40/g, '');
    displayText = displayText.replace(/\x1B\x61/g, '');
    displayText = displayText.replace(/\x1B\x21/g, '');
    displayText = displayText.replace(/\x1D\x56\x41\x10/g, '');
    return displayText;
}

async function printReceipt() {
    try {
        // Try direct thermal printing first
        const printed = await tryDirectPrinting();
        
        if (!printed) {
            // Fallback to browser print
            printViaBrowser();
        } else {
            // If printed successfully, save order and close modal
            await saveOrderAndClearCart();
            closePrintModal();
        }
    } catch (error) {
        console.error("Printing error:", error);
        showNotification('Printing failed. Using browser print.', 'error');
        printViaBrowser();
    }
}

async function tryDirectPrinting() {
    // Try WebUSB first
    if (navigator.usb) {
        try {
            const printed = await printViaWebUSB();
            if (printed) {
                printerType = 'usb';
                printerConnected = true;
                return true;
            }
        } catch (error) {
            console.error('WebUSB printing failed:', error);
        }
    }
    
    // Try WebSerial second
    if ('serial' in navigator) {
        try {
            const printed = await printViaWebSerial();
            if (printed) {
                printerType = 'serial';
                printerConnected = true;
                return true;
            }
        } catch (error) {
            console.error('WebSerial printing failed:', error);
        }
    }
    
    return false;
}

async function printViaWebUSB() {
    try {
        // Common thermal printer vendor/product IDs
        const printerFilters = [
            { vendorId: 0x0416, productId: 0x5011 }, // Star Micronics
            { vendorId: 0x0416, productId: 0x5012 }, // Star Micronics
            { vendorId: 0x04B8, productId: 0x0202 }, // Epson
            { vendorId: 0x04B8, productId: 0x0E15 }, // Epson
            { vendorId: 0x067B, productId: 0x2305 }, // Prolific
            { vendorId: 0x0483, productId: 0x5740 }  // STMicroelectronics
        ];
        
        const device = await navigator.usb.requestDevice({ filters: printerFilters });
        
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);
        
        // Convert receipt text to bytes
        const encoder = new TextEncoder();
        const data = encoder.encode(window.currentReceipt);
        
        // Send to printer
        await device.transferOut(1, data);
        
        // Add small delay for paper cut
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await device.close();
        
        showNotification('Receipt printed successfully via USB!', 'success');
        return true;
    } catch (error) {
        if (error.name === 'NotFoundError') {
            console.log('USB printer not found');
            return false;
        }
        throw error;
    }
}

async function printViaWebSerial() {
    try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
        
        const encoder = new TextEncoder();
        const writer = port.writable.getWriter();
        
        // Send receipt data
        await writer.write(encoder.encode(window.currentReceipt));
        
        // Release writer and close port
        writer.releaseLock();
        await port.close();
        
        showNotification('Receipt printed successfully via Serial!', 'success');
        return true;
    } catch (error) {
        if (error.name === 'NotFoundError') {
            console.log('Serial printer not found');
            return false;
        }
        throw error;
    }
}

function printViaBrowser() {
    const printContent = formatForDisplay(window.currentReceipt);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showNotification('Please allow popups to print receipt', 'error');
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
                        width: 58mm !important;
                        font-size: 10pt !important;
                    }
                    @page {
                        margin: 0 !important;
                        size: 58mm auto !important;
                    }
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 10pt;
                    width: 58mm;
                    margin: 0 auto;
                    padding: 2mm;
                    line-height: 1.1;
                    white-space: pre;
                }
            </style>
        </head>
        <body>
            <pre>${printContent}</pre>
            <script>
                window.onload = function() {
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => {
                            window.close();
                        }, 1000);
                    }, 100);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
    
    // Save order after browser print window opens
    setTimeout(() => {
        saveOrderAndClearCart();
        closePrintModal();
    }, 500);
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
        
        // Clear cart and form
        cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('paymentMode').value = 'cash';
        document.getElementById('cashReceived').value = '';
        document.getElementById('changeAmount').textContent = `${currency}0.00`;
        
        // Reset UI to show cash fields
        document.getElementById('cashPaymentFields').classList.remove('hidden');
        document.getElementById('nonCashPaymentFields').classList.add('hidden');
        
        showNotification('Order saved successfully!', 'success');
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

// Make functions available globally
window.prepareReceipt = prepareReceipt;
window.printReceipt = printReceipt;
