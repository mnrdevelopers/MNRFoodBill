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
        
        // Build receipt with ESC/POS commands for RawBT
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
    
    // Build receipt text (no ESC/POS commands for RawBT - it uses plain text)
    let receipt = '';
    
    // ========================================
    // HEADER SECTION
    // ========================================
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    receipt += centerText(restaurant.name.toUpperCase()) + '\n';
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    if (restaurant.address) {
        receipt += centerText(restaurant.address) + '\n';
    }
    if (restaurant.phone) {
        receipt += centerText('Ph: ' + restaurant.phone) + '\n';
    }
    if (restaurant.gstin) {
        receipt += centerText('GSTIN: ' + restaurant.gstin) + '\n';
    }
    if (restaurant.fssai) {
        receipt += centerText('FSSAI: ' + restaurant.fssai) + '\n';
    }
    
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ========================================
    // BILL & CUSTOMER DETAILS
    // ========================================
    receipt += `Date    : ${now.toLocaleDateString('en-IN')}\n`;
    receipt += `Time    : ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
    receipt += `Bill No : ${billNo}\n`;
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    receipt += `Customer: ${customerName}\n`;
    if (customerPhone) {
        receipt += `Phone   : ${customerPhone}\n`;
    }
    
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ========================================
    // ITEMS TABLE HEADER
    // ========================================
    receipt += 'Sl  Item'.padEnd(18) + 'Qty  Price'.padStart(10) + 'Amount'.padStart(10) + '\n';
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ========================================
    // ITEMS LIST
    // ========================================
    let slNo = 1;
    cart.forEach(item => {
        const itemName = item.name;
        const qty = item.quantity;
        const rate = item.price.toFixed(2);
        const amount = (item.price * item.quantity).toFixed(2);
        
        let displayName = itemName;
        if (itemName.length > 15) {
            displayName = itemName.substring(0, 13) + '..';
        }
        
        const line = `${slNo.toString().padStart(2)}. ${displayName.padEnd(15)} ${qty.toString().padStart(3)} ${currency}${rate.padStart(6)} ${currency}${amount.padStart(7)}`;
        receipt += line + '\n';
        slNo++;
    });
    
    // ========================================
    // BILL SUMMARY
    // ========================================
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += centerText('BILL SUMMARY') + '\n';
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    receipt += formatLine('Sub Total', `${currency}${subtotal.toFixed(2)}`) + '\n';
    
    if (serviceCharge > 0) {
        receipt += formatLine(`Service Charge ${serviceRate}%`, `${currency}${serviceCharge.toFixed(2)}`) + '\n';
    }
    
    if (gstRate > 0) {
        receipt += formatLine(`CGST ${(gstRate/2).toFixed(1)}%`, `${currency}${cgstAmount.toFixed(2)}`) + '\n';
        receipt += formatLine(`SGST ${(gstRate/2).toFixed(1)}%`, `${currency}${sgstAmount.toFixed(2)}`) + '\n';
    }
    
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    receipt += formatLine('GRAND TOTAL', `${currency}${total.toFixed(2)}`) + '\n';
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    // ========================================
    // PAYMENT DETAILS
    // ========================================
    const paymentModeDisplay = paymentMode.toUpperCase();
    receipt += `Payment Mode: ${paymentModeDisplay}\n`;
    
    if (paymentMode === 'cash') {
        receipt += `Cash Received: ${currency}${cashReceived.toFixed(2)}\n`;
        receipt += `Change       : ${currency}${changeAmount.toFixed(2)}\n`;
    } else {
        receipt += `Paid Amount  : ${currency}${total.toFixed(2)}\n`;
    }
    
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    // ========================================
    // FOOTER & GREETINGS
    // ========================================
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
    
    // Store receipt in data attribute
    printContent.setAttribute('data-receipt-text', receipt);
    
    // Update modal content for RawBT
    printContent.innerHTML = `
        <div class="space-y-4">
            <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-print text-green-500 text-2xl"></i>
                    <div>
                        <h4 class="font-bold text-green-800">Ready to Print</h4>
                        <p class="text-sm text-green-600">${restaurantName} • Bill: ${billNo}</p>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
                <button onclick="printWithRawBT()" 
                        class="bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition flex items-center justify-center">
                    <i class="fas fa-bolt mr-2"></i> INSTANT PRINT (RawBT)
                </button>
                
                <button onclick="downloadForRawBT()" 
                        class="bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition flex items-center justify-center">
                    <i class="fas fa-download mr-2"></i> Download & Print
                </button>
                
                <button onclick="shareToRawBT()" 
                        class="bg-purple-500 text-white py-3 rounded-lg font-bold hover:bg-purple-600 transition flex items-center justify-center">
                    <i class="fas fa-share-alt mr-2"></i> Share to RawBT
                </button>
            </div>
            
            <div class="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                <p class="font-semibold mb-1">Quick Tips:</p>
                <ul class="list-disc pl-4 space-y-1">
                    <li>Click <span class="font-semibold">INSTANT PRINT</span> for automatic printing</li>
                    <li>If that doesn't work, use <span class="font-semibold">Download & Print</span></li>
                    <li>Make sure RawBT app is installed and printer is connected</li>
                </ul>
            </div>
        </div>
    `;
    
    // Update modal footer
    const modalFooter = modal.querySelector('.flex.space-x-3');
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button onclick="closePrintModal()" 
                    class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                Cancel
            </button>
        `;
    }
    
    modal.classList.remove('hidden');
}

// ========================================
// RAWTB PRINTING FUNCTIONS
// ========================================

// Method 1: Direct RawBT intent (Android Intent)
window.printWithRawBT = function() {
    const receipt = document.getElementById('printContent').getAttribute('data-receipt-text');
    
    // Try multiple methods to send to RawBT
    if (tryRawBTIntent(receipt)) {
        saveOrderAndClearCart();
        closePrintModal();
    } else {
        // Fallback to download
        downloadForRawBT();
    }
};

function tryRawBTIntent(receiptText) {
    try {
        // Method 1A: RawBT Intent URL scheme
        const intentUrl = `intent://rawbt.ru/print#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.text=${encodeURIComponent(receiptText)};end`;
        
        // Method 1B: Alternative intent format
        const altIntentUrl = `intent://rawbt.ru/print?text=${encodeURIComponent(receiptText)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
        
        // Method 1C: File intent
        const blob = new Blob([receiptText], { type: 'text/plain' });
        const fileUrl = URL.createObjectURL(blob);
        const fileIntentUrl = `intent://rawbt.ru/print_file#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.path=${encodeURIComponent(fileUrl)};end`;
        
        // Try first method
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = intentUrl;
        document.body.appendChild(iframe);
        
        // Check if RawBT opened
        setTimeout(() => {
            document.body.removeChild(iframe);
            showNotification('Opening RawBT...', 'info');
        }, 100);
        
        return true;
        
    } catch (error) {
        console.error('RawBT intent failed:', error);
        return false;
    }
}

// Method 2: Download text file (this works for you)
window.downloadForRawBT = function() {
    const receipt = document.getElementById('printContent').getAttribute('data-receipt-text');
    const billNo = generateOrderId();
    
    // Create and download file
    const blob = new Blob([receipt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Use .txt extension (RawBT recognizes this)
    a.href = url;
    a.download = `receipt_${billNo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Save order immediately
    saveOrderAndClearCart();
    
    showNotification('Receipt downloaded! Opening RawBT...', 'success');
    closePrintModal();
    
    // Try to auto-open RawBT after download
    setTimeout(() => {
        try {
            window.location.href = 'rawbt://';
        } catch (e) {
            // Ignore if can't open RawBT
        }
    }, 500);
};

// Method 3: Share intent
window.shareToRawBT = function() {
    const receipt = document.getElementById('printContent').getAttribute('data-receipt-text');
    
    if (navigator.share) {
        // Web Share API
        navigator.share({
            title: `Receipt ${generateOrderId()}`,
            text: receipt.substring(0, 100) + '...', // Preview
            files: [new File([receipt], `receipt_${generateOrderId()}.txt`, { type: 'text/plain' })]
        }).then(() => {
            saveOrderAndClearCart();
            closePrintModal();
        }).catch(err => {
            console.error('Share failed:', err);
            downloadForRawBT(); // Fallback
        });
    } else {
        // Fallback to download
        downloadForRawBT();
    }
};

// ========================================
// ORDER SAVING & CLEANUP
// ========================================

async function saveOrderAndClearCart() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
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
        
        // Reset UI
        document.getElementById('cashPaymentFields').classList.remove('hidden');
        document.getElementById('nonCashPaymentFields').classList.add('hidden');
        
        showNotification('Order completed! Printing receipt...', 'success');
        
    } catch (error) {
        console.error('Error saving order:', error);
        showNotification('Order saved but printing failed.', 'error');
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

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

// ========================================
// GLOBAL EXPORTS
// ========================================

window.prepareReceipt = prepareReceipt;
window.printReceipt = function() {
    // For backward compatibility - use RawBT method
    window.printWithRawBT();
};
window.closePrintModal = closePrintModal;

// Helper for notifications
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[10000] text-white font-medium ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Auto-detect RawBT on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we can detect RawBT
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        console.log('Android device detected - RawBT printing available');
    }
});
