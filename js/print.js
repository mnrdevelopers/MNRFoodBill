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
            ownerName: restaurantData.ownerName || '',
            ownerPhone: restaurantData.ownerPhone || '',
            address: settings.address || restaurantData.address || '',
            phone: settings.phone || restaurantData.phone || '',
            gstin: settings.gstin || '',
            fssai: settings.fssai || ''
        };
        
        const MAX_WIDTH = 42;
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
        
        // Build receipt for RawBT
        let receipt = buildRawBTReceipt(
            restaurant, 
            customerName, 
            customerPhone,
            subtotal, gstRate, gstAmount, serviceRate, serviceCharge, total,
            paymentMode, cashReceived, changeAmount,
            billNo, now, currency,
            cgstAmount, sgstAmount
        );
        
        // Show print options
        showRawBTOptions(receipt, restaurant.name, billNo);
        
    } catch (error) {
        console.error("Error preparing receipt:", error);
        showNotification('Error loading restaurant details', 'error');
    }
}

function buildRawBTReceipt(restaurant, customerName, customerPhone, 
                          subtotal, gstRate, gstAmount, serviceRate, serviceCharge, total,
                          paymentMode, cashReceived, changeAmount,
                          billNo, now, currency, cgstAmount, sgstAmount) {
    
    const MAX_WIDTH = 42;
    
    function centerText(text) {
        const padding = Math.max(0, Math.floor((MAX_WIDTH - text.length) / 2));
        return ' '.repeat(padding) + text;
    }
    
    function formatLine(label, value) {
        const availableSpace = MAX_WIDTH - label.length - value.length;
        const dots = '.'.repeat(Math.max(3, availableSpace));
        return label + dots + value;
    }
    
    // Build receipt text
    let receipt = '';
    
    // HEADER
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    receipt += centerText(restaurant.name.toUpperCase()) + '\n';
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    if (restaurant.address) receipt += centerText(restaurant.address) + '\n';
    if (restaurant.phone) receipt += centerText('Ph: ' + restaurant.phone) + '\n';
    if (restaurant.gstin) receipt += centerText('GSTIN: ' + restaurant.gstin) + '\n';
    if (restaurant.fssai) receipt += centerText('FSSAI: ' + restaurant.fssai) + '\n';
    
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // BILL INFO
    receipt += `Date    : ${now.toLocaleDateString('en-IN')}\n`;
    receipt += `Time    : ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
    receipt += `Bill No : ${billNo}\n`;
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += `Customer: ${customerName}\n`;
    if (customerPhone) receipt += `Phone   : ${customerPhone}\n`;
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ITEMS HEADER
    receipt += 'Sl  Item'.padEnd(18) + 'Qty  Price'.padStart(10) + 'Amount'.padStart(10) + '\n';
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ITEMS
    let slNo = 1;
    if (cart && cart.length > 0) {
        cart.forEach(item => {
            const itemName = item.name;
            const qty = item.quantity;
            const rate = item.price.toFixed(2);
            const amount = (item.price * item.quantity).toFixed(2);
            
            let displayName = itemName;
            if (itemName.length > 15) displayName = itemName.substring(0, 13) + '..';
            
            receipt += `${slNo.toString().padStart(2)}. ${displayName.padEnd(15)} ${qty.toString().padStart(3)} ${currency}${rate.padStart(6)} ${currency}${amount.padStart(7)}\n`;
            slNo++;
        });
    } else {
        receipt += 'No items\n';
    }
    
    // BILL SUMMARY
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += centerText('BILL SUMMARY') + '\n';
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += formatLine('Sub Total', `${currency}${subtotal.toFixed(2)}`) + '\n';
    if (serviceCharge > 0) receipt += formatLine(`Service Charge ${serviceRate}%`, `${currency}${serviceCharge.toFixed(2)}`) + '\n';
    if (gstRate > 0) {
        receipt += formatLine(`CGST ${(gstRate/2).toFixed(1)}%`, `${currency}${cgstAmount.toFixed(2)}`) + '\n';
        receipt += formatLine(`SGST ${(gstRate/2).toFixed(1)}%`, `${currency}${sgstAmount.toFixed(2)}`) + '\n';
    }
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += formatLine('GRAND TOTAL', `${currency}${total.toFixed(2)}`) + '\n';
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    // PAYMENT
    const paymentModeDisplay = paymentMode.toUpperCase();
    receipt += `Payment Mode: ${paymentModeDisplay}\n`;
    if (paymentMode === 'cash') {
        receipt += `Cash Received: ${currency}${cashReceived.toFixed(2)}\n`;
        receipt += `Change       : ${currency}${changeAmount.toFixed(2)}\n`;
    } else {
        receipt += `Paid Amount  : ${currency}${total.toFixed(2)}\n`;
    }
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    // FOOTER
    receipt += centerText('Thank you for dining with us!') + '\n';
    receipt += centerText('Please visit again.') + '\n';
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += centerText('** Computer Generated Bill **') + '\n';
    receipt += centerText('** No Signature Required **') + '\n';
    if (restaurant.ownerPhone) {
        receipt += '-'.repeat(MAX_WIDTH) + '\n';
        receipt += centerText('For feedback/complaints:') + '\n';
        receipt += centerText(restaurant.ownerPhone) + '\n';
    }
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    receipt += '\n\n\n'; // Feed paper
    
    return receipt;
}

function showRawBTOptions(receipt, restaurantName, billNo) {
    const printContent = document.getElementById('printContent');
    const modal = document.getElementById('printModal');
    
    // Store receipt
    printContent.setAttribute('data-receipt-text', receipt);
    printContent.setAttribute('data-bill-no', billNo);
    
    // Update modal
    printContent.innerHTML = `
        <div class="space-y-4">
            <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-print text-green-500 text-2xl"></i>
                    <div>
                        <h4 class="font-bold text-green-800">Ready to Print</h4>
                        <p class="text-sm text-green-600">${restaurantName} • Bill: ${billNo}</p>
                        <p class="text-xs text-green-500 mt-1">${cart.length} items • Total: ₹${document.getElementById('totalAmount')?.textContent.replace('₹', '') || '0.00'}</p>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
                <button onclick="directRawBTPrint()" 
                        class="bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition flex items-center justify-center">
                    <i class="fas fa-bolt mr-2"></i> DIRECT PRINT (Fastest)
                </button>
                
                <button onclick="downloadAndPrint()" 
                        class="bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition flex items-center justify-center">
                    <i class="fas fa-download mr-2"></i> DOWNLOAD & PRINT
                </button>
            </div>
            
            <div class="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                <p class="font-semibold mb-1 text-gray-700">Recommended:</p>
                <p class="mb-2">Click <span class="font-semibold text-red-600">DIRECT PRINT</span> for instant printing.</p>
                <p>If Direct Print doesn't work, use <span class="font-semibold text-blue-600">DOWNLOAD & PRINT</span>.</p>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// ==================== RAWTB PRINTING FUNCTIONS ====================

// METHOD 1: Direct RawBT Intent (Fastest)
window.directRawBTPrint = function() {
    const receipt = document.getElementById('printContent').getAttribute('data-receipt-text');
    const billNo = document.getElementById('printContent').getAttribute('data-bill-no');
    
    console.log('Attempting direct RawBT print...');
    
    // Save order first (don't wait for print)
    saveOrderAndClearCart();
    
    // Try multiple RawBT intent methods
    setTimeout(() => {
        if (tryRawBTIntentMethod1(receipt, billNo)) {
            closePrintModal();
            showNotification('Printing via RawBT...', 'success');
        } else if (tryRawBTIntentMethod2(receipt, billNo)) {
            closePrintModal();
            showNotification('Printing via RawBT...', 'success');
        } else {
            // Fallback to download
            showNotification('Using download method...', 'info');
            setTimeout(() => {
                downloadAndPrint();
            }, 500);
        }
    }, 100);
};

function tryRawBTIntentMethod1(receipt, billNo) {
    try {
        // RawBT Intent Scheme 1
        const encodedText = encodeURIComponent(receipt);
        const intentUrl = `intent://rawbt.ru/print#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.text=${encodedText};S.title=Bill_${billNo};end`;
        
        console.log('Trying RawBT Intent URL:', intentUrl.substring(0, 100) + '...');
        
        // Create hidden iframe to trigger intent
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.style.visibility = 'hidden';
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.src = intentUrl;
        
        document.body.appendChild(iframe);
        
        // Check if intent was handled
        setTimeout(() => {
            document.body.removeChild(iframe);
            // If we're still here after 2 seconds, intent probably failed
        }, 2000);
        
        return true;
    } catch (e) {
        console.error('RawBT Intent Method 1 failed:', e);
        return false;
    }
}

function tryRawBTIntentMethod2(receipt, billNo) {
    try {
        // RawBT Intent Scheme 2 - Alternative format
        const encodedText = encodeURIComponent(receipt);
        const intentUrl = `intent:#Intent;action=ru.a402d.rawbtprinter.PRINT;component=ru.a402d.rawbtprinter/.PrintActivity;S.text=${encodedText};end`;
        
        console.log('Trying RawBT Intent Method 2');
        
        // Try window.location
        window.location.href = intentUrl;
        
        // Fallback timeout
        setTimeout(() => {
            if (document.hasFocus()) {
                console.log('Intent likely failed, falling back');
            }
        }, 1000);
        
        return true;
    } catch (e) {
        console.error('RawBT Intent Method 2 failed:', e);
        return false;
    }
}

// METHOD 2: Download Text File (Works reliably)
window.downloadAndPrint = function() {
    const receipt = document.getElementById('printContent').getAttribute('data-receipt-text');
    const billNo = document.getElementById('printContent').getAttribute('data-bill-no') || generateOrderId();
    
    console.log('Downloading receipt for RawBT...');
    
    // Save order first
    saveOrderAndClearCart();
    
    // Create text file
    const blob = new Blob([receipt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    
    // IMPORTANT: Use .txt extension and simple filename for RawBT
    a.download = `bill_${billNo}.txt`;
    
    // Append, click, remove
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
    
    // Show message
    showNotification('Receipt downloaded! Opening RawBT...', 'success');
    
    // Close modal
    setTimeout(() => {
        closePrintModal();
    }, 500);
    
    // Try to auto-open RawBT after download
    setTimeout(() => {
        try {
            // Try to open RawBT
            window.location.href = 'rawbt://';
        } catch (e) {
            // Ignore errors
        }
    }, 1000);
    
    return true;
};

// ==================== ORDER SAVING ====================

async function saveOrderAndClearCart() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const doc = await db.collection('restaurants').doc(user.uid).get();
        const settings = doc.data()?.settings || {};
        const currency = settings.currency || '₹';
        
        const paymentMode = document.getElementById('paymentMode')?.value || 'cash';
        const cashReceived = parseFloat(document.getElementById('cashReceived')?.value || 0);
        const changeAmount = parseFloat(document.getElementById('changeAmount')?.textContent.replace(currency, '') || 0);
        const total = parseFloat(document.getElementById('totalAmount')?.textContent.replace(currency, '') || 0);
        
        // Get cart items (make sure cart is accessible)
        const cartItems = window.cart || [];
        
        const orderData = {
            restaurantId: user.uid,
            items: [...cartItems],
            customerName: document.getElementById('customerName')?.value || 'Walk-in Customer',
            customerPhone: document.getElementById('customerPhone')?.value || '',
            subtotal: parseFloat(document.getElementById('subtotal')?.textContent.replace(currency, '') || 0),
            gstRate: parseFloat(settings.gstRate) || 0,
            gstAmount: parseFloat(document.getElementById('gstAmount')?.textContent.replace(currency, '') || 0),
            serviceChargeRate: parseFloat(settings.serviceCharge) || 0,
            serviceCharge: parseFloat(document.getElementById('serviceCharge')?.textContent.replace(currency, '') || 0),
            total: total,
            paymentMode: paymentMode,
            cashReceived: paymentMode === 'cash' ? cashReceived : 0,
            changeAmount: paymentMode === 'cash' ? changeAmount : 0,
            status: 'completed',
            orderId: generateOrderId(),
            billNo: generateOrderId(),
            printedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Save to Firestore
        await db.collection('orders').add(orderData);
        
        // Clear cart
        if (window.cart) {
            window.cart = [];
        }
        
        // Update UI if functions exist
        if (typeof renderCart === 'function') {
            renderCart();
        }
        if (typeof updateTotals === 'function') {
            updateTotals();
        }
        
        // Clear form fields
        const customerNameInput = document.getElementById('customerName');
        const customerPhoneInput = document.getElementById('customerPhone');
        const cashReceivedInput = document.getElementById('cashReceived');
        const changeAmountSpan = document.getElementById('changeAmount');
        
        if (customerNameInput) customerNameInput.value = '';
        if (customerPhoneInput) customerPhoneInput.value = '';
        if (cashReceivedInput) cashReceivedInput.value = '';
        if (changeAmountSpan) changeAmountSpan.textContent = `${currency}0.00`;
        
        // Reset payment mode
        const paymentModeSelect = document.getElementById('paymentMode');
        if (paymentModeSelect) paymentModeSelect.value = 'cash';
        
        console.log('Order saved successfully');
        
    } catch (error) {
        console.error('Error saving order:', error);
        // Don't show error to user during printing
    }
}

// ==================== UTILITY FUNCTIONS ====================

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

function showNotification(message, type) {
    // Remove any existing notifications
    const existingNotifications = document.querySelectorAll('.custom-notification');
    existingNotifications.forEach(n => n.remove());
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `custom-notification fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[10000] text-white font-medium ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    notification.style.animation = 'slideIn 0.3s ease-out';
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations for notifications
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// ==================== GLOBAL EXPORTS ====================

window.prepareReceipt = prepareReceipt;
window.printReceipt = function() {
    // For backward compatibility - triggers the print flow
    const printBtn = document.getElementById('printBill');
    if (printBtn) {
        printBtn.click();
    }
};
window.closePrintModal = closePrintModal;
window.directRawBTPrint = directRawBTPrint;
window.downloadAndPrint = downloadAndPrint;

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Print module loaded');
    
    // Make sure cart is accessible
    if (!window.cart) {
        window.cart = [];
    }
    
    // Add print button listener if not already added
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn && !printBillBtn.hasAttribute('data-print-listener')) {
        printBillBtn.setAttribute('data-print-listener', 'true');
        printBillBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (window.cart && window.cart.length === 0) {
                showNotification('Cart is empty', 'error');
                return;
            }
            prepareReceipt();
        });
    }
    
    // Check if RawBT is available
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        console.log('Android device detected - RawBT printing enabled');
    }
});

