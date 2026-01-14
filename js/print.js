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
        
        // Build receipt
        let receipt = buildReceipt(
            restaurant, 
            customerName, 
            customerPhone,
            subtotal, gstRate, gstAmount, serviceRate, serviceCharge, total,
            paymentMode, cashReceived, changeAmount,
            billNo, now, currency,
            cgstAmount, sgstAmount
        );
        
        // Check device type
        const isAndroid = /Android/i.test(navigator.userAgent);
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isAndroid) {
            // Android: Try RawBT directly
            await printWithRawBT(receipt, billNo, restaurant.name);
        } else if (isMobile) {
            // iOS or other mobile: Use Share API
            await shareToRawBT(receipt, billNo, restaurant.name);
        } else {
            // Desktop: Show print modal
            showDesktopPrintModal(receipt);
        }
        
    } catch (error) {
        console.error("Error preparing receipt:", error);
        showNotification('Error: ' + error.message, 'error');
    }
}

function buildReceipt(restaurant, customerName, customerPhone, 
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
    
    // BILL DETAILS
    receipt += `Date    : ${now.toLocaleDateString('en-IN')}\n`;
    receipt += `Time    : ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
    receipt += `Bill No : ${billNo}\n`;
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    receipt += `Customer: ${customerName}\n`;
    if (customerPhone) {
        receipt += `Phone   : ${customerPhone}\n`;
    }
    
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ITEMS HEADER
    receipt += 'Sl  Item'.padEnd(18) + 'Qty  Price'.padStart(10) + 'Amount'.padStart(10) + '\n';
    receipt += '-'.repeat(MAX_WIDTH) + '\n';
    
    // ITEMS LIST
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
    
    // BILL SUMMARY
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
    
    // PAYMENT DETAILS
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
    receipt += '\n\n\n';
    
    return receipt;
}

// ================= ANDROID: DIRECT RAWTB PRINTING =================
async function printWithRawBT(receiptText, billNo, restaurantName) {
    try {
        // First, save the order
        await saveOrderAndClearCart();
        
        // Try multiple RawBT methods
        const success = await tryRawBTMethods(receiptText, billNo);
        
        if (success) {
            showNotification('Receipt sent to printer!', 'success');
        } else {
            // Fallback to download
            showNotification('Opening RawBT...', 'info');
            downloadForRawBT(receiptText, billNo);
        }
        
    } catch (error) {
        console.error('RawBT print failed:', error);
        downloadForRawBT(receiptText, billNo);
    }
}

async function tryRawBTMethods(receiptText, billNo) {
    // Method 1: RawBT Intent URL (Android deep link)
    try {
        // Create a temporary file URL
        const blob = new Blob([receiptText], { type: 'text/plain' });
        const fileUrl = URL.createObjectURL(blob);
        
        // RawBT intent URL format
        const rawbtIntent = `intent://rawbt.ru/print_file#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.path=${encodeURIComponent(fileUrl)};end`;
        
        // Try to open RawBT via iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = rawbtIntent;
        document.body.appendChild(iframe);
        
        // Check if RawBT opened
        let rawbtOpened = false;
        const timeout = setTimeout(() => {
            document.body.removeChild(iframe);
            if (!rawbtOpened) {
                throw new Error('RawBT timeout');
            }
        }, 1000);
        
        // Listen for blur (app switch)
        window.addEventListener('blur', function onBlur() {
            rawbtOpened = true;
            clearTimeout(timeout);
            window.removeEventListener('blur', onBlur);
            setTimeout(() => {
                if (iframe.parentNode) {
                    document.body.removeChild(iframe);
                }
            }, 1000);
        });
        
        return true;
        
    } catch (error) {
        console.log('Method 1 failed:', error);
        
        // Method 2: Alternative intent format
        try {
            const altIntent = `intent://rawbt.ru/print?text=${encodeURIComponent(receiptText)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
            
            window.location.href = altIntent;
            
            // If we're still here after 500ms, RawBT didn't open
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(false);
                }, 500);
            });
            
        } catch (error2) {
            console.log('Method 2 failed:', error2);
            return false;
        }
    }
}

function downloadForRawBT(receiptText, billNo) {
    // Create and download .txt file
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Use .txt extension
    a.href = url;
    a.download = `receipt_${billNo}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ================= IOS/MOBILE: SHARE API =================
async function shareToRawBT(receiptText, billNo, restaurantName) {
    try {
        // Save order first
        await saveOrderAndClearCart();
        
        // Create file for sharing
        const fileName = `receipt_${billNo}.txt`;
        const file = new File([receiptText], fileName, { type: 'text/plain' });
        
        // Check if Web Share API supports files
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `${restaurantName} - Bill ${billNo}`,
                text: `Receipt ${billNo}`,
                files: [file]
            });
            
            showNotification('Receipt shared to printer!', 'success');
        } else {
            // Web Share API not available
            throw new Error('Share API not supported');
        }
        
    } catch (error) {
        console.error('Share failed:', error);
        
        if (error.name !== 'AbortError') {
            // Fallback to show options
            showMobilePrintOptions(receiptText, billNo, restaurantName);
        }
    }
}

function showMobilePrintOptions(receiptText, billNo, restaurantName) {
    const printContent = document.getElementById('printContent');
    const modal = document.getElementById('printModal');
    
    // Store receipt
    printContent.setAttribute('data-receipt-text', receiptText);
    
    // Update modal for mobile
    printContent.innerHTML = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-mobile-alt text-blue-500 text-2xl"></i>
                    <div>
                        <h4 class="font-bold text-blue-800">Mobile Printing</h4>
                        <p class="text-sm text-blue-600">${restaurantName} • Bill: ${billNo}</p>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
                <button onclick="downloadAndPrint()" 
                        class="bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition flex items-center justify-center">
                    <i class="fas fa-download mr-2"></i> Download & Print
                </button>
                
                <button onclick="copyReceiptText()" 
                        class="bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 transition flex items-center justify-center">
                    <i class="fas fa-copy mr-2"></i> Copy Text
                </button>
            </div>
            
            <div class="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                <p class="font-semibold mb-1">Instructions:</p>
                <p>1. Click "Download & Print"</p>
                <p>2. Open the .txt file with RawBT app</p>
                <p>3. Printer will start automatically</p>
            </div>
        </div>
    `;
    
    // Update modal footer
    const modalFooter = modal.querySelector('.flex.space-x-3');
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button onclick="closePrintModal()" 
                    class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                Close
            </button>
        `;
    }
    
    modal.classList.remove('hidden');
}

// ================= DESKTOP: REGULAR PRINTING =================
function showDesktopPrintModal(receiptText) {
    // Save order first
    saveOrderAndClearCart();
    
    // Set print content
    const printContent = document.getElementById('printContent');
    printContent.textContent = receiptText;
    
    // Show modal
    const modal = document.getElementById('printModal');
    modal.classList.remove('hidden');
    
    // Update modal buttons for desktop
    const modalFooter = modal.querySelector('.flex.space-x-3');
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button onclick="printDesktopReceipt()" class="flex-1 bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600">
                <i class="fas fa-print mr-2"></i> Print Now
            </button>
            <button onclick="closePrintModal()" class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                Close
            </button>
        `;
    }
}

window.printDesktopReceipt = function() {
    const printContent = document.getElementById('printContent').textContent;
    
    // Create print window
    const printWindow = window.open('', '_blank', 'width=240,height=600');
    if (!printWindow) {
        printViaBrowser(printContent);
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
                        font-size: 9pt !important;
                    }
                    @page {
                        margin: 0 !important;
                        size: 58mm auto !important;
                    }
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 9pt;
                    width: 58mm;
                    margin: 0 auto;
                    padding: 2mm;
                    line-height: 1;
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
                        }, 500);
                    }, 100);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

function printViaBrowser(printContent) {
    const printDiv = document.createElement('div');
    printDiv.id = 'printableReceipt';
    printDiv.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 58mm;
        font-family: 'Courier New', monospace;
        font-size: 9pt;
        white-space: pre;
        line-height: 1;
        padding: 2mm;
        background: white;
    `;
    printDiv.textContent = printContent;
    document.body.appendChild(printDiv);
    
    window.print();
    
    setTimeout(() => {
        if (printDiv.parentNode) {
            printDiv.parentNode.removeChild(printDiv);
        }
    }, 100);
    
    closePrintModal();
}

// ================= MOBILE HELPER FUNCTIONS =================
window.downloadAndPrint = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text');
    const billNo = generateOrderId();
    
    downloadForRawBT(receiptText, billNo);
    closePrintModal();
};

window.copyReceiptText = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text');
    
    navigator.clipboard.writeText(receiptText).then(() => {
        showNotification('Receipt copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Copy failed. Please select text manually.', 'error');
    });
};

// ================= COMMON FUNCTIONS =================
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
        
        // Clear cart IMMEDIATELY
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
        
    } catch (error) {
        console.error('Error saving order:', error);
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

// ================= INITIALIZATION =================
window.prepareReceipt = prepareReceipt;
window.closePrintModal = closePrintModal;

// Update print button
document.addEventListener('DOMContentLoaded', function() {
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        const newPrintBillBtn = printBillBtn.cloneNode(true);
        printBillBtn.parentNode.replaceChild(newPrintBillBtn, printBillBtn);
        
        newPrintBillBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            if (cart.length === 0) {
                showNotification('Cart is empty', 'error');
                return;
            }
            
            const paymentMode = document.getElementById('paymentMode').value;
            if (paymentMode === 'cash') {
                const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                const totalText = document.getElementById('totalAmount').textContent;
                const total = parseFloat(totalText.replace('₹', '')) || 0;
                
                if (cashReceived < total) {
                    showNotification('Insufficient cash received', 'error');
                    return;
                }
            }
            
            // Show processing notification
            const isAndroid = /Android/i.test(navigator.userAgent);
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isAndroid) {
                showNotification('Printing receipt...', 'info');
            } else if (isMobile) {
                showNotification('Preparing print...', 'info');
            } else {
                showNotification('Opening print dialog...', 'info');
            }
            
            await prepareReceipt();
        });
    }
});

// Helper for notifications
function showNotification(message, type) {
    document.querySelectorAll('.notification-temp').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification-temp fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[10000] text-white font-medium ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
