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
            fssai: settings.fssai || '',
            logoUrl: settings.logoUrl || restaurantData.logoUrl || '' // Add logo URL
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
        
        // Check if mobile or desktop
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            // Mobile: Use RawBT printing
            await mobilePrintWithRawBT(receipt, restaurant.name, billNo);
        } else {
            // Desktop: Show print preview modal with logo
            showDesktopPrintPreview(receipt, restaurant.name, billNo, restaurant.logoUrl); // Pass logo URL
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
    
    // HEADER with logo placeholder
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    // Check if restaurant has a logo
    if (restaurant.logoUrl) {
        // Add logo placeholder - in text receipt, we'll add [LOGO] marker
        receipt += centerText('[LOGO]') + '\n\n';
    }
    
    // Restaurant name in bigger style
    const restaurantName = restaurant.name.toUpperCase();
    
    // Make restaurant name appear bigger by adding spaces
    let bigName = '';
    for (let i = 0; i < restaurantName.length; i++) {
        bigName += restaurantName[i] + ' ';
    }
    bigName = bigName.trim();
    
    receipt += centerText(bigName) + '\n';
    receipt += centerText('RESTAURANT') + '\n';
    
    receipt += '='.repeat(MAX_WIDTH) + '\n';
    
    // Restaurant details
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

// ========================================
// MOBILE: RAWBT PRINTING
// ========================================
async function mobilePrintWithRawBT(receiptText, restaurantName, billNo) {
    try {
        // First, save the order (do this BEFORE sharing)
        await saveOrderAndClearCart();
        
        // Create file for sharing
        const fileName = `receipt_${billNo}.txt`;
        const file = new File([receiptText], fileName, { type: 'text/plain' });
        
        // Check if Web Share API is available
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            // Share with Web Share API (this will open RawBT)
            await navigator.share({
                title: `${restaurantName} - Bill ${billNo}`,
                text: `Receipt ${billNo}\nTotal: ₹${getTotalAmount()}`,
                files: [file]
            });
            
            showNotification('Receipt sent to printer!', 'success');
            
        } else {
            // Fallback: Download file (which should open RawBT)
            downloadFile(receiptText, fileName);
            showNotification('Opening RawBT...', 'info');
        }
        
    } catch (error) {
        console.error('Mobile print failed:', error);
        
        if (error.name !== 'AbortError') {
            // Fallback to download
            downloadFile(receiptText, `receipt_${billNo}.txt`);
            showNotification('Downloading receipt...', 'info');
            
            // Still save the order
            await saveOrderAndClearCart();
        }
    }
}

// ========================================
// DESKTOP: BROWSER PRINTING
// ========================================
function showDesktopPrintPreview(receiptText, restaurantName, billNo, logoUrl = '') {
    const printContent = document.getElementById('printContent');
    const modal = document.getElementById('printModal');
    
    // Store receipt and logo in data attributes
    printContent.setAttribute('data-receipt-text', receiptText);
    printContent.setAttribute('data-logo-url', logoUrl);
    
    // Create HTML with proper thermal printer styling
    const receiptHTML = formatReceiptForHTMLPrint(receiptText, logoUrl);
    
    // Update modal content for desktop
    printContent.innerHTML = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-print text-blue-500 text-2xl"></i>
                    <div>
                        <h4 class="font-bold text-blue-800">Print Preview</h4>
                        <p class="text-sm text-blue-600">${restaurantName} • Bill: ${billNo}</p>
                    </div>
                </div>
            </div>
            
            <div class="thermal-preview">
                <div class="thermal-receipt" style="
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.1;
                    white-space: pre;
                    background: white;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    max-height: 400px;
                    overflow-y: auto;
                    width: 100%;
                    max-width: 300px;
                    margin: 0 auto;
                ">
                    ${receiptHTML}
                </div>
            </div>
            
            <div class="text-xs text-gray-500 text-center">
                <p>Preview shows thermal printer layout (42 chars width)</p>
                <p>Actual print will use thermal printer formatting</p>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
                <button onclick="desktopPrintReceipt()" 
                        class="bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 transition flex items-center justify-center">
                    <i class="fas fa-print mr-2"></i> PRINT NOW
                </button>
                
                <button onclick="downloadReceiptDesktop()" 
                        class="bg-gray-500 text-white py-3 rounded-lg font-bold hover:bg-gray-600 transition flex items-center justify-center">
                    <i class="fas fa-download mr-2"></i> Download as Text
                </button>
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

function formatReceiptForHTML(receiptText) {
    // Convert plain text receipt to HTML with proper formatting
    return receiptText
        .replace(/=/g, '<span style="color: #666;">=</span>')
        .replace(/-/g, '<span style="color: #999;">-</span>')
        .replace(/\n/g, '<br>')
        .replace(/^(.*RESTAURANT.*)$/gmi, '<strong>$1</strong>')
        .replace(/^(GRAND TOTAL.*)$/gmi, '<strong style="color: #000;">$1</strong>')
        .replace(/^(Thank you.*)$/gmi, '<span style="color: #333;">$1</span>');
}

window.desktopPrintReceipt = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text');
    const logoUrl = document.getElementById('printContent').getAttribute('data-logo-url');
    printThermalReceipt(receiptText, logoUrl);
    saveOrderAndClearCart();
    closePrintModal();
};

window.downloadReceiptDesktop = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text');
    const billNo = generateOrderId();
    downloadFile(receiptText, `receipt_${billNo}.txt`);
    showNotification('Receipt downloaded!', 'success');
};

function printThermalReceipt(receiptText, restaurantLogoUrl = '') {
    // Create a print window with thermal printer styling
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Receipt</title>
            <style>
                @media print {
                    body, html {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 58mm !important;
                        font-family: 'Courier New', monospace !important;
                        font-size: 12px !important;
                        line-height: 1.1 !important;
                    }
                    @page {
                        margin: 0 !important;
                        size: 58mm auto !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .restaurant-logo {
                        text-align: center !important;
                        margin: 5px 0 !important;
                    }
                    .restaurant-logo img {
                        max-width: 40mm !important;
                        max-height: 25mm !important;
                        object-fit: contain !important;
                    }
                    .restaurant-name {
                        font-weight: bold !important;
                        font-size: 16px !important;
                        text-align: center !important;
                        margin: 4px 0 !important;
                        letter-spacing: 1px !important;
                        text-transform: uppercase !important;
                    }
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.1;
                    width: 58mm;
                    margin: 0 auto;
                    padding: 2mm;
                    white-space: pre;
                    word-wrap: break-word;
                }
                .restaurant-logo {
                    text-align: center;
                    margin: 5px 0;
                }
                .restaurant-logo img {
                    max-width: 40mm;
                    max-height: 25mm;
                    object-fit: contain;
                }
                .restaurant-name {
                    font-weight: bold;
                    font-size: 16px;
                    text-align: center;
                    margin: 4px 0;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .receipt-content {
                    max-width: 42ch;
                    margin: 0 auto;
                }
            </style>
        </head>
        <body>
            <div class="receipt-content">
                ${formatReceiptForHTMLPrint(receiptText, restaurantLogoUrl)}
            </div>
            <script>
                // Auto-print
                setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                        window.close();
                    }, 500);
                }, 100);
            </script>
        </body>
        </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

function formatReceiptForHTMLPrint(receiptText, restaurantLogoUrl = '') {
    // Convert plain text receipt to HTML with formatting
    const lines = receiptText.split('\n');
    let html = '';
    
    for (let line of lines) {
        if (line.includes('[LOGO]') && restaurantLogoUrl) {
            // Replace [LOGO] with actual logo image
            html += `<div class="restaurant-logo">
                        <img src="${restaurantLogoUrl}" alt="Restaurant Logo" onerror="this.style.display='none'">
                     </div>`;
        } else if (line.toUpperCase() === line && line.trim().length > 3 && 
                  !line.includes('=') && !line.includes('-') && !line.includes('[LOGO]')) {
            // This is likely the restaurant name line
            html += `<div class="restaurant-name">${line.trim()}</div>`;
        } else {
            // Regular line
            html += line.replace(/=/g, '<span style="color: #666;">=</span>')
                       .replace(/-/g, '<span style="color: #999;">-</span>') + '<br>';
        }
    }
    
    return html;
}

// ========================================
// COMMON FUNCTIONS
// ========================================
function downloadFile(content, fileName) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getTotalAmount() {
    const currency = '₹';
    const totalText = document.getElementById('totalAmount')?.textContent || '₹0.00';
    return parseFloat(totalText.replace(currency, '')).toFixed(2);
}

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
        
    } catch (error) {
        console.error('Error saving order:', error);
        // Don't show error to user during printing
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

// ========================================
// INITIALIZATION
// ========================================

// Override the printBill button click handler
document.addEventListener('DOMContentLoaded', function() {
    const printBillBtn = document.getElementById('printBill');
    if (printBillBtn) {
        // Remove any existing event listeners
        const newPrintBillBtn = printBillBtn.cloneNode(true);
        printBillBtn.parentNode.replaceChild(newPrintBillBtn, printBillBtn);
        
        // Add new event listener
        newPrintBillBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            if (cart.length === 0) {
                showNotification('Cart is empty', 'error');
                return;
            }
            
            // Validate cash payment if cash mode
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
            showNotification('Processing receipt...', 'info');
            
            // Call prepareReceipt which handles mobile/desktop differently
            await prepareReceipt();
        });
    }
});

// Make functions available globally
window.prepareReceipt = prepareReceipt;
window.printReceipt = function() {
    // For backward compatibility
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text');
        mobilePrintWithRawBT(receiptText, 'Restaurant', generateOrderId());
    } else {
        desktopPrintReceipt();
    }
};
window.closePrintModal = closePrintModal;

// Helper for notifications
function showNotification(message, type) {
    // Remove any existing notifications
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



