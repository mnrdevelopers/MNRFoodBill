// Direct thermal printing via WebUSB/WebSerial
let printerConnected = false;
let printerType = null; // 'usb' or 'serial'

// Try to auto-connect to printer on page load
document.addEventListener('DOMContentLoaded', function() {
    if (navigator.usb) {
        console.log('WebUSB available');
    }
    if ('serial' in navigator) {
        console.log('WebSerial available');
    }
});

async function prepareReceipt() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const doc = await db.collection('restaurants').doc(user.uid).get();
        if (!doc.exists) throw new Error('Restaurant settings not found');
        
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
        
        const cgstAmount = gstRate > 0 ? gstAmount / 2 : 0;
        const sgstAmount = gstRate > 0 ? gstAmount / 2 : 0;
        
        const now = new Date();
        const billNo = generateOrderId();
        
        let receipt = '';
        receipt += '\x1B\x40\x1B\x61\x01\x1B\x21\x30'; // Init, Center, Double
        receipt += `\n${restaurant.name.toUpperCase()}\n`;
        receipt += '\x1B\x21\x00\x1B\x61\x00'; // Normal, Left
        
        if (restaurant.address) receipt += `${restaurant.address}\n`;
        if (restaurant.phone) receipt += `Ph: ${restaurant.phone}\n`;
        if (restaurant.gstin) receipt += `GST: ${restaurant.gstin}\n`;
        
        receipt += '------------------------------------------\n';
        receipt += `Date: ${now.toLocaleDateString('en-IN')}  Time: ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
        receipt += `Bill No: ${billNo}\n`;
        receipt += '------------------------------------------\n';
        receipt += `Customer: ${customerName}\n`;
        receipt += '------------------------------------------\n';
        receipt += 'SL ITEM             QTY    RATE   AMOUNT\n';
        receipt += '------------------------------------------\n';
        
        cart.forEach((item, i) => {
            const name = item.name.substring(0, 16).padEnd(16);
            const qty = item.quantity.toString().padStart(3);
            const rate = item.price.toFixed(0).padStart(6);
            const amt = (item.price * item.quantity).toFixed(0).padStart(7);
            receipt += `${(i+1).toString().padStart(2)}. ${name} ${qty}  ${rate}  ${amt}\n`;
        });
        
        receipt += '------------------------------------------\n';
        receipt += `Sub Total:                ${currency}${subtotal.toFixed(2).padStart(10)}\n`;
        if (serviceCharge > 0) receipt += `Service ${serviceRate}%:           ${currency}${serviceCharge.toFixed(2).padStart(10)}\n`;
        if (gstRate > 0) receipt += `GST ${gstRate}%:               ${currency}${gstAmount.toFixed(2).padStart(10)}\n`;
        receipt += '------------------------------------------\n';
        receipt += `GRAND TOTAL:              ${currency}${total.toFixed(2).padStart(10)}\n`;
        receipt += '==========================================\n';
        receipt += `Payment: ${paymentMode.toUpperCase()}\n`;
        if (paymentMode === 'cash') {
            receipt += `Paid: ${currency}${cashReceived.toFixed(2)}  Change: ${currency}${changeAmount.toFixed(2)}\n`;
        }
        receipt += '==========================================\n';
        receipt += '\x1B\x61\x01Thank You! Visit Again\x1B\x61\x00\n\n\n\n\x1D\x56\x41\x10'; 
        
        window.currentReceipt = receipt;
        document.getElementById('printContent').textContent = formatForDisplay(receipt);
    } catch (error) {
        console.error("Prep Error:", error);
        showNotification('Error preparing bill data', 'error');
    }
}

function formatForDisplay(receipt) {
    return receipt.replace(/[\x00-\x1F\x7F-\x9F]/g, "").replace(/\[\d+m/g, "");
}

async function printReceipt() {
    // Show a loading state on the button
    const printBtn = document.getElementById('printNowBtn');
    const originalText = printBtn.innerHTML;
    printBtn.disabled = true;
    printBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';

    try {
        // Step 1: Attempt direct hardware printing
        const hardwarePrinted = await tryDirectPrinting();
        
        if (hardwarePrinted) {
            await saveOrderAndClearCart();
            closePrintModal();
        } else {
            // Step 2: Fallback to browser printing
            // We save the order FIRST so if the user cancels the print dialog, the data is already in DB
            await saveOrderAndClearCart(); 
            printViaBrowser();
            closePrintModal();
        }
    } catch (error) {
        console.error("Print Flow Error:", error);
        showNotification('Process failed. Check console.', 'error');
    } finally {
        printBtn.disabled = false;
        printBtn.innerHTML = originalText;
    }
}

async function tryDirectPrinting() {
    if (navigator.usb) {
        try {
            const printerFilters = [{ vendorId: 0x0416 }, { vendorId: 0x04B8 }, { vendorId: 0x067B }];
            const device = await navigator.usb.requestDevice({ filters: printerFilters });
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);
            const encoder = new TextEncoder();
            await device.transferOut(1, encoder.encode(window.currentReceipt));
            await device.close();
            return true;
        } catch (e) { return false; }
    }
    return false;
}

function printViaBrowser() {
    const printContent = document.getElementById('printContent').textContent;
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) {
        showNotification('Popup blocked! Enable popups to print.', 'error');
        return;
    }
    printWindow.document.write(`<html><head><style>body{font-family:monospace;white-space:pre;width:58mm;font-size:10pt;}</style></head><body>${printContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

async function saveOrderAndClearCart() {
    const user = auth.currentUser;
    if (!user || cart.length === 0) return;
    
    try {
        const settingsDoc = await db.collection('restaurants').doc(user.uid).get();
        const settings = settingsDoc.data()?.settings || {};
        const currency = settings.currency || '₹';
        
        const paymentMode = document.getElementById('paymentMode')?.value || 'cash';
        const subtotal = parseFloat(document.getElementById('subtotal')?.textContent.replace(currency, '') || 0);
        const total = parseFloat(document.getElementById('totalAmount')?.textContent.replace(currency, '') || 0);

        const orderData = {
            restaurantId: user.uid,
            items: JSON.parse(JSON.stringify(cart)),
            customerName: document.getElementById('customerName')?.value || 'Walk-in Customer',
            customerPhone: document.getElementById('customerPhone')?.value || '',
            subtotal: subtotal,
            total: total,
            paymentMode: paymentMode,
            status: 'completed',
            orderId: generateOrderId(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('orders').add(orderData);
        
        // Reset Local State
        cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        // Reset Inputs
        const fields = ['customerName', 'customerPhone', 'cashReceived'];
        fields.forEach(f => { if(document.getElementById(f)) document.getElementById(f).value = ''; });
        
        showNotification('Order completed and saved!', 'success');
    } catch (error) {
        console.error('Firestore Error:', error);
        throw error;
    }
}

function generateOrderId() {
    return `BILL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
}

window.prepareReceipt = prepareReceipt;
window.printReceipt = printReceipt;
