// Thermal printing functions - Professional Restaurant Bill Style for 80mm printer
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
            logoUrl: settings.logoUrl || restaurantData.logoUrl || ''
        };
        
        const MAX_WIDTH = 48; // Increased for 80mm printer (approx 48 characters)
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
            // Mobile: Use RawBT printing with ESC/POS commands for better thermal printing
            await mobilePrintWithRawBT(receipt, restaurant.name, billNo);
        } else {
            // Desktop: Show print preview modal
            showDesktopPrintPreview(receipt, restaurant.name, billNo, restaurant.logoUrl);
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
    
    const MAX_WIDTH = 48; // For 80mm thermal printer
    
    // ESC/POS commands for better thermal printing
    const ESC = '\x1B';
    const INIT = ESC + '@';
    const BOLD_ON = ESC + 'E' + '\x01'; // Bold ON
    const BOLD_OFF = ESC + 'E' + '\x00'; // Bold OFF
    const DOUBLE_HEIGHT_ON = ESC + '!' + '\x10'; // Double height
    const DOUBLE_HEIGHT_OFF = ESC + '!' + '\x00'; // Normal height
    const CENTER_ALIGN = ESC + 'a' + '\x01'; // Center alignment
    const LEFT_ALIGN = ESC + 'a' + '\x00'; // Left alignment
    const CUT_PAPER = ESC + 'm'; // Cut paper
    
    function centerText(text) {
        const padding = Math.max(0, Math.floor((MAX_WIDTH - text.length) / 2));
        return ' '.repeat(padding) + text;
    }
    
    function formatLine(label, value, bold = false) {
        const availableSpace = MAX_WIDTH - label.length - value.length;
        const dots = '.'.repeat(Math.max(2, availableSpace));
        const line = label + dots + value;
        return bold ? BOLD_ON + line + BOLD_OFF : line;
    }
    
    function createSeparator(char = '=', bold = false) {
        const separator = char.repeat(MAX_WIDTH);
        return bold ? BOLD_ON + separator + BOLD_OFF : separator;
    }
    
    // Start building receipt with ESC/POS initialization
    let receipt = INIT;
    
    // HEADER
    receipt += CENTER_ALIGN + DOUBLE_HEIGHT_ON + BOLD_ON;
    
    // Logo marker
    if (restaurant.logoUrl) {
        receipt += '[LOGO]\n\n';
    }
    
    // Restaurant name (bold, centered, double height)
    const restaurantName = restaurant.name.toUpperCase();
    if (restaurantName.length <= MAX_WIDTH) {
        receipt += centerText(restaurantName) + '\n';
    } else {
        // Split long names
        const words = restaurantName.split(' ');
        let currentLine = '';
        for (const word of words) {
            if (currentLine.length + word.length + 1 <= MAX_WIDTH) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                receipt += centerText(currentLine) + '\n';
                currentLine = word;
            }
        }
        if (currentLine) {
            receipt += centerText(currentLine) + '\n';
        }
    }
    
    receipt += DOUBLE_HEIGHT_OFF + BOLD_OFF + '\n';
    
    // Restaurant details
    receipt += LEFT_ALIGN + BOLD_ON;
    receipt += createSeparator('=', true) + '\n';
    receipt += BOLD_OFF;
    
    if (restaurant.address) {
        const addressLines = restaurant.address.split(',').map(line => line.trim());
        for (const line of addressLines) {
            if (line) {
                receipt += centerText(line) + '\n';
            }
        }
    }
    
    if (restaurant.phone) {
        receipt += centerText('Ph: ' + restaurant.phone) + '\n';
    }
    
    if (restaurant.gstin || restaurant.fssai) {
        receipt += '\n';
        if (restaurant.gstin) {
            receipt += centerText('GSTIN: ' + restaurant.gstin) + '\n';
        }
        if (restaurant.fssai) {
            receipt += centerText('FSSAI: ' + restaurant.fssai) + '\n';
        }
    }
    
    receipt += createSeparator('=', true) + '\n\n';
    
    // BILL DETAILS
    receipt += BOLD_ON + centerText('TAX INVOICE') + BOLD_OFF + '\n';
    receipt += createSeparator('-') + '\n';
    
    receipt += `Bill No.   : ${billNo}\n`;
    receipt += `Date       : ${now.toLocaleDateString('en-IN')}\n`;
    receipt += `Time       : ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
    receipt += createSeparator('-') + '\n';
    
    // Customer details
    receipt += `Customer   : ${customerName}\n`;
    if (customerPhone) {
        receipt += `Mobile     : ${customerPhone}\n`;
    }
    
    receipt += createSeparator('=') + '\n\n';
    
    // ITEMS HEADER
    receipt += BOLD_ON;
    receipt += 'ITEM'.padEnd(32) + 'QTY   AMOUNT\n';
    receipt += createSeparator('-', true) + '\n';
    receipt += BOLD_OFF;
    
    // ITEMS LIST
    let itemCount = 0;
    cart.forEach(item => {
        const itemName = item.name;
        const qty = item.quantity;
        const amount = (item.price * item.quantity);
        const itemPrice = item.price.toFixed(2);
        
        let displayName = itemName;
        if (itemName.length > 30) {
            displayName = itemName.substring(0, 28) + '..';
        }
        
        // Item name (with possible price per item)
        const nameLine = `${displayName}`;
        receipt += nameLine + '\n';
        
        // Quantity and amount (right aligned)
        const qtyAmountLine = ' '.repeat(32 - 8) + 
                            qty.toString().padStart(3) + ' x ' + 
                            currency + itemPrice.padStart(6) + 
                            ' = ' + currency + amount.toFixed(2).padStart(8);
        receipt += qtyAmountLine + '\n';
        
        itemCount++;
    });
    
    // BILL SUMMARY
    receipt += createSeparator('=', true) + '\n';
    receipt += BOLD_ON + centerText('BILL SUMMARY') + BOLD_OFF + '\n';
    receipt += createSeparator('-') + '\n';
    
    receipt += formatLine('Sub Total', currency + subtotal.toFixed(2)) + '\n';
    
    if (serviceCharge > 0) {
        receipt += formatLine(`Service Charge (${serviceRate}%)`, currency + serviceCharge.toFixed(2)) + '\n';
    }
    
    if (gstRate > 0) {
        const halfRate = (gstRate / 2).toFixed(1);
        receipt += formatLine(`CGST ${halfRate}%`, currency + cgstAmount.toFixed(2)) + '\n';
        receipt += formatLine(`SGST ${halfRate}%`, currency + sgstAmount.toFixed(2)) + '\n';
    }
    
    receipt += createSeparator('-', true) + '\n';
    receipt += BOLD_ON + formatLine('GRAND TOTAL', currency + total.toFixed(2), true) + BOLD_OFF + '\n';
    receipt += createSeparator('=', true) + '\n\n';
    
    // PAYMENT DETAILS
    receipt += BOLD_ON + centerText('PAYMENT DETAILS') + BOLD_OFF + '\n';
    receipt += createSeparator('-') + '\n';
    
    const paymentModeDisplay = paymentMode.toUpperCase();
    receipt += `Mode       : ${paymentModeDisplay}\n`;
    
    if (paymentMode === 'cash') {
        receipt += `Cash Paid  : ${currency}${cashReceived.toFixed(2)}\n`;
        receipt += `Change Due : ${currency}${changeAmount.toFixed(2)}\n`;
    }
    
    receipt += createSeparator('=', true) + '\n\n';
    
    // FOOTER
    receipt += centerText('Thank you for dining with us!') + '\n';
    receipt += centerText('Please visit again') + '\n';
    receipt += createSeparator('-') + '\n';
    receipt += centerText('** Computer Generated Bill **') + '\n';
    receipt += centerText('** No Signature Required **') + '\n';
    
    if (restaurant.ownerPhone) {
        receipt += createSeparator('-') + '\n';
        receipt += centerText('For feedback:') + '\n';
        receipt += BOLD_ON + centerText(restaurant.ownerPhone) + BOLD_OFF + '\n';
    }
    
    receipt += createSeparator('=', true) + '\n';
    receipt += '\n\n\n\n'; // Extra space for cutting
    
    // Add paper cut command
    receipt += CUT_PAPER;
    
    return receipt;
}

// ========================================
// MOBILE: RAWBT PRINTING WITH ESC/POS
// ========================================
async function mobilePrintWithRawBT(receiptText, restaurantName, billNo) {
    try {
        // First, save the order
        await saveOrderAndClearCart();
        
        // For mobile printing, we need to use proper ESC/POS encoding
        const encoder = new TextEncoder();
        const receiptData = encoder.encode(receiptText);
        
        // Create blob with proper MIME type for thermal printing
        const blob = new Blob([receiptData], { type: 'text/plain;charset=iso-8859-1' });
        
        const fileName = `receipt_${billNo}.prn`;
        const file = new File([blob], fileName, { type: 'application/octet-stream' });
        
        // Check if Web Share API is available
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: `${restaurantName} - Bill ${billNo}`,
                text: `Thermal Receipt ${billNo}\nTotal: ₹${getTotalAmount()}`,
                files: [file]
            });
            
            showNotification('Receipt sent to printer!', 'success');
            
        } else {
            // Fallback: Download file
            downloadFile(receiptText, fileName);
            showNotification('Opening printer app...', 'info');
        }
        
    } catch (error) {
        console.error('Mobile print failed:', error);
        
        if (error.name !== 'AbortError') {
            // Fallback to simple text download
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
    
    // Create preview with proper formatting
    const receiptHTML = formatReceiptForPreview(receiptText, logoUrl);
    
    // Update modal content for desktop
    printContent.innerHTML = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-print text-blue-500 text-2xl"></i>
                    <div>
                        <h4 class="font-bold text-blue-800">80mm Thermal Printer Preview</h4>
                        <p class="text-sm text-blue-600">${restaurantName} • Bill: ${billNo}</p>
                        <p class="text-xs text-blue-500 mt-1">Preview shows how receipt will appear on thermal printer</p>
                    </div>
                </div>
            </div>
            
            <div class="thermal-preview">
                <div class="thermal-receipt" style="
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    line-height: 1.2;
                    background: white;
                    padding: 15px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    max-height: 500px;
                    overflow-y: auto;
                    width: 100%;
                    max-width: 350px;
                    margin: 0 auto;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                ">
                    ${receiptHTML}
                </div>
            </div>
            
            <div class="text-xs text-gray-500 text-center">
                <p><i class="fas fa-info-circle mr-1"></i> Optimized for 80mm thermal printers (48 chars width)</p>
                <p><i class="fas fa-info-circle mr-1"></i> Bold text will appear darker on thermal paper</p>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
                <button onclick="desktopPrintReceipt()" 
                        class="bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition flex items-center justify-center">
                    <i class="fas fa-print mr-2"></i> PRINT RECEIPT
                </button>
                
                <button onclick="downloadReceiptDesktop()" 
                        class="bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700 transition flex items-center justify-center">
                    <i class="fas fa-download mr-2"></i> Download ESC/POS File
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

function formatReceiptForPreview(receiptText, logoUrl = '') {
    // Remove ESC/POS commands for HTML preview
    let cleanText = receiptText
        .replace(/\x1B\[@]/g, '')
        .replace(/\x1B\[E\x01/g, '<strong>')
        .replace(/\x1B\[E\x00/g, '</strong>')
        .replace(/\x1B\[!\x10/g, '<span style="font-size: 1.3em;">')
        .replace(/\x1B\[!\x00/g, '</span>')
        .replace(/\x1B\[a\x01/g, '<div style="text-align: center;">')
        .replace(/\x1B\[a\x00/g, '</div>')
        .replace(/\x1B\[m/g, '')
        .replace(/\x1B/g, '');
    
    const lines = cleanText.split('\n');
    let html = '';
    
    for (const line of lines) {
        if (line.includes('[LOGO]') && logoUrl) {
            html += `<div style="text-align: center; margin: 10px 0;">
                        <img src="${logoUrl}" alt="Logo" style="max-width: 150px; max-height: 60px; object-fit: contain;" onerror="this.style.display='none'">
                     </div>`;
        } else if (line.includes('=======')) {
            html += `<div style="text-align: center; font-weight: bold; color: #000; letter-spacing: 1px; margin: 3px 0; border-top: 2px solid #000; padding-top: 3px;">${line}</div>`;
        } else if (line.includes('-------')) {
            html += `<div style="text-align: center; color: #333; letter-spacing: 1px; margin: 2px 0; border-bottom: 1px solid #ccc; padding-bottom: 2px;">${line}</div>`;
        } else if (line.trim().length === 0) {
            html += '<div style="height: 4px;"></div>';
        } else {
            // Check for centered text
            const trimmedLine = line.trim();
            if (trimmedLine === 'TAX INVOICE' || trimmedLine === 'BILL SUMMARY' || trimmedLine === 'GRAND TOTAL' || trimmedLine === 'PAYMENT DETAILS') {
                html += `<div style="text-align: center; font-weight: bold; margin: 5px 0; text-transform: uppercase;">${trimmedLine}</div>`;
            } else if (line.includes('₹') && line.includes('GRAND TOTAL')) {
                html += `<div style="text-align: center; font-weight: bold; font-size: 1.1em; margin: 8px 0; background: #f0f0f0; padding: 4px; border-radius: 3px;">${line}</div>`;
            } else {
                html += `<div>${line}</div>`;
            }
        }
    }
    
    return html;
}

function formatReceiptForHTMLPrint(receiptText, restaurantLogoUrl = '') {
    // Remove ESC/POS commands
    let cleanText = receiptText
        .replace(/\x1B\[@]/g, '')
        .replace(/\x1B\[E\x01/g, '<strong>')
        .replace(/\x1B\[E\x00/g, '</strong>')
        .replace(/\x1B\[!\x10/g, '<span style="font-size: 1.3em;">')
        .replace(/\x1B\[!\x00/g, '</span>')
        .replace(/\x1B\[a\x01/g, '<div style="text-align: center;">')
        .replace(/\x1B\[a\x00/g, '</div>')
        .replace(/\x1B\[m/g, '')
        .replace(/\x1B/g, '');
    
    const lines = cleanText.split('\n');
    let html = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('[LOGO]') && restaurantLogoUrl) {
            html += `<div class="logo-container">
                        <img src="${restaurantLogoUrl}" alt="Restaurant Logo" onerror="this.style.display='none'">
                     </div>`;
            continue;
        }
        
        if (line.includes('=======')) {
            html += `<div class="separator bold">${'='.repeat(48)}</div>`;
        } else if (line.includes('-------')) {
            html += `<div class="separator">${'-'.repeat(48)}</div>`;
        } else if (line.trim().length === 0) {
            html += '<div class="spacer">&nbsp;</div>';
        } else {
            const trimmedLine = line.trim();
            
            if (trimmedLine === 'TAX INVOICE' || trimmedLine === 'BILL SUMMARY' || trimmedLine === 'PAYMENT DETAILS') {
                html += `<div class="section-title">${trimmedLine}</div>`;
            } else if (line.includes('GRAND TOTAL')) {
                html += `<div class="grand-total">${line}</div>`;
            } else if (line.includes('₹') && (line.includes('Sub Total') || line.includes('CGST') || line.includes('SGST') || line.includes('Service'))) {
                html += `<div class="amount-line">${line}</div>`;
            } else if (line.includes(':')) {
                html += `<div class="info-line">${line}</div>`;
            } else {
                html += `<div class="receipt-line">${line}</div>`;
            }
        }
    }
    
    return html;
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
    downloadFile(receiptText, `receipt_${billNo}.prn`);
    showNotification('ESC/POS file downloaded!', 'success');
};

function printThermalReceipt(receiptText, restaurantLogoUrl = '') {
    // Create a print window with thermal printer styling for 80mm
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Print Receipt - 80mm Thermal</title>
            <style>
                @media print {
                    body, html {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 80mm !important;
                        max-width: 80mm !important;
                        font-family: 'Courier New', monospace !important;
                        font-size: 14px !important;
                        line-height: 1.2 !important;
                        font-weight: bold !important;
                    }
                    @page {
                        margin: 0 !important;
                        size: 80mm auto !important;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .logo-container {
                        text-align: center !important;
                        margin: 3mm 0 2mm 0 !important;
                        padding: 0 !important;
                    }
                    .logo-container img {
                        max-width: 50mm !important;
                        max-height: 20mm !important;
                        object-fit: contain !important;
                        margin: 0 auto !important;
                        display: block !important;
                    }
                    .section-title {
                        font-weight: bold !important;
                        font-size: 16px !important;
                        text-align: center !important;
                        margin: 3mm 0 2mm 0 !important;
                        text-transform: uppercase !important;
                    }
                    .grand-total {
                        font-weight: bold !important;
                        font-size: 16px !important;
                        text-align: center !important;
                        margin: 4mm 0 !important;
                        padding: 2mm !important;
                        background: #f0f0f0 !important;
                        border: 1px solid #000 !important;
                    }
                    .separator {
                        text-align: center !important;
                        margin: 2mm 0 !important;
                        padding: 1mm 0 !important;
                        letter-spacing: 1px !important;
                    }
                    .separator.bold {
                        font-weight: bold !important;
                        border-top: 2px solid #000 !important;
                        border-bottom: 2px solid #000 !important;
                    }
                    .amount-line {
                        margin: 1mm 0 !important;
                        padding: 0 !important;
                    }
                    .info-line {
                        margin: 1mm 0 !important;
                        padding: 0 !important;
                    }
                    .receipt-line {
                        margin: 0.5mm 0 !important;
                        padding: 0 !important;
                    }
                    .spacer {
                        height: 2mm !important;
                    }
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 14px;
                    line-height: 1.2;
                    font-weight: bold;
                    width: 80mm;
                    max-width: 80mm;
                    margin: 0 auto;
                    padding: 3mm;
                    word-wrap: break-word;
                }
                .logo-container {
                    text-align: center;
                    margin: 3mm 0 2mm 0;
                    padding: 0;
                }
                .logo-container img {
                    max-width: 50mm;
                    max-height: 20mm;
                    object-fit: contain;
                    margin: 0 auto;
                    display: block;
                }
                .section-title {
                    font-weight: bold;
                    font-size: 16px;
                    text-align: center;
                    margin: 3mm 0 2mm 0;
                    text-transform: uppercase;
                }
                .grand-total {
                    font-weight: bold;
                    font-size: 16px;
                    text-align: center;
                    margin: 4mm 0;
                    padding: 2mm;
                    background: #f0f0f0;
                    border: 1px solid #000;
                }
                .separator {
                    text-align: center;
                    margin: 2mm 0;
                    padding: 1mm 0;
                    letter-spacing: 1px;
                }
                .separator.bold {
                    font-weight: bold;
                    border-top: 2px solid #000;
                    border-bottom: 2px solid #000;
                }
                .amount-line {
                    margin: 1mm 0;
                    padding: 0;
                }
                .info-line {
                    margin: 1mm 0;
                    padding: 0;
                }
                .receipt-line {
                    margin: 0.5mm 0;
                    padding: 0;
                }
                .spacer {
                    height: 2mm;
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

// ========================================
// COMMON FUNCTIONS
// ========================================
function downloadFile(content, fileName) {
    const blob = new Blob([content], { type: 'application/octet-stream' });
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
            showNotification('Preparing 80mm thermal receipt...', 'info');
            
            // Call prepareReceipt
            await prepareReceipt();
        });
    }
});

// Make functions available globally
window.prepareReceipt = prepareReceipt;
window.printReceipt = function() {
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
    document.querySelectorAll('.notification-temp').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification-temp fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-[10000] text-white font-medium ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
