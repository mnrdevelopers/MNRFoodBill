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
        
        // Calculate available space (typically 42-48 characters wide for thermal printer)
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
        
        // Calculate CGST/SGST if applicable
        const cgstAmount = gstRate > 0 ? gstAmount / 2 : 0;
        const sgstAmount = gstRate > 0 ? gstAmount / 2 : 0;
        
        const now = new Date();
        const billNo = generateOrderId();
        const tableNo = 'T01'; // Could be made dynamic from UI if needed
        
        // Helper function to center text
        function centerText(text) {
            const padding = Math.max(0, Math.floor((MAX_WIDTH - text.length) / 2));
            return ' '.repeat(padding) + text;
        }
        
        // Helper function to format line with proper spacing
        function formatLine(label, value) {
            const availableSpace = MAX_WIDTH - label.length - value.length;
            const dots = '.'.repeat(Math.max(3, availableSpace));
            return label + dots + value;
        }
        
        // Build receipt
        let receipt = '';
        
        // ========================================
        // HEADER SECTION
        // ========================================
        receipt += '='.repeat(MAX_WIDTH) + '\n';
        receipt += centerText(restaurant.name.toUpperCase()) + '\n';
        receipt += '='.repeat(MAX_WIDTH) + '\n';
        
        // Restaurant details (only if they exist)
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
        receipt += `Table   : ${tableNo}\n`;
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
            
            // Handle long item names (max 15 chars)
            let displayName = itemName;
            if (itemName.length > 15) {
                displayName = itemName.substring(0, 13) + '..';
            }
            
            // Format line: SL. ItemName(15) Qty(3) Price(8) Amount(9)
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
        
        // Owner contact for feedback
        if (restaurant.ownerPhone) {
            receipt += '-'.repeat(MAX_WIDTH) + '\n';
            receipt += centerText('For feedback/complaints:') + '\n';
            receipt += centerText(restaurant.ownerPhone) + '\n';
        }
        
        receipt += '='.repeat(MAX_WIDTH) + '\n';
        
        // ========================================
        // DUPLICATE COPY (for kitchen/records)
        // ========================================
        receipt += '\n\n\n'; // Add space between copies
        
        // Duplicate header
        receipt += '='.repeat(MAX_WIDTH) + '\n';
        receipt += centerText('DUPLICATE COPY') + '\n';
        receipt += centerText('FOR RESTAURANT RECORDS') + '\n';
        receipt += '='.repeat(MAX_WIDTH) + '\n';
        
        receipt += `Date    : ${now.toLocaleDateString('en-IN')}\n`;
        receipt += `Time    : ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}\n`;
        receipt += `Bill No : ${billNo}\n`;
        receipt += `Customer: ${customerName}\n`;
        if (customerPhone) {
            receipt += `Phone   : ${customerPhone}\n`;
        }
        receipt += `Payment : ${paymentModeDisplay}\n`;
        receipt += `Amount  : ${currency}${total.toFixed(2)}\n`;
        receipt += '='.repeat(MAX_WIDTH) + '\n';
        
        // Check if we're on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            showMobilePrintOptions(receipt);
        } else {
            // Set the receipt content for desktop
            const printContent = document.getElementById('printContent');
            printContent.textContent = receipt;
            
            // Show modal
            const modal = document.getElementById('printModal');
            modal.classList.remove('hidden');
        }
        
        // Prevent body scrolling when modal is open
        document.body.style.overflow = 'hidden';
        
        // Add click outside to close
        document.getElementById('printModal').addEventListener('click', function(e) {
            if (e.target === this) {
                closePrintModal();
            }
        });
        
    } catch (error) {
        console.error("Error preparing receipt:", error);
        showNotification('Error loading restaurant details', 'error');
    }
}

function printReceipt() {
    const printContent = document.getElementById('printContent').textContent;
    
    // Check if we're on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // For mobile devices, use the mobile-friendly method
        printForMobile(printContent);
    } else {
        // For desktop, use the existing method
        printForDesktop(printContent);
    }
    
    // Save the order to database
    saveOrderAndClearCart();
}

function showMobilePrintOptions(receipt) {
    // Update the print modal to show mobile-specific options
    const printModal = document.getElementById('printModal');
    const printContentDiv = document.getElementById('printContent');
    
    // Store receipt in data attribute for later use
    printContentDiv.setAttribute('data-receipt-text', receipt);
    
    // Update modal content
    printContentDiv.innerHTML = `
        <div class="space-y-4">
            <h4 class="font-bold text-lg text-gray-800">Print Receipt</h4>
            
            <div class="bg-gray-50 p-3 rounded border border-gray-200">
                <h5 class="font-semibold text-gray-700 mb-2">Receipt Preview:</h5>
                <div class="max-h-48 overflow-y-auto font-mono text-xs bg-white p-2 rounded border">
                    <pre class="whitespace-pre-wrap">${receipt.substring(0, 300)}${receipt.length > 300 ? '...' : ''}</pre>
                </div>
            </div>
            
            <div class="bg-blue-50 p-3 rounded border border-blue-200">
                <h5 class="font-semibold text-blue-700 mb-1">📱 Mobile Printing Help:</h5>
                <p class="text-sm text-blue-600">
                    Your USB thermal printer is detected: <span class="font-semibold">usb_1155_22339 printer-80</span>
                </p>
            </div>
            
            <div class="grid grid-cols-1 gap-3">
                <button onclick="attemptMobilePrint()" class="bg-red-500 text-white py-3 rounded-lg font-bold hover:bg-red-600 flex items-center justify-center">
                    <i class="fas fa-print mr-2"></i> Print Now (Auto)
                </button>
                
                <button onclick="copyReceiptForPrinting()" class="bg-blue-500 text-white py-3 rounded-lg font-bold hover:bg-blue-600 flex items-center justify-center">
                    <i class="fas fa-copy mr-2"></i> Copy Text & Print Manually
                </button>
                
                <button onclick="downloadReceiptText()" class="bg-green-500 text-white py-3 rounded-lg font-bold hover:bg-green-600 flex items-center justify-center">
                    <i class="fas fa-download mr-2"></i> Download as Text File
                </button>
            </div>
            
            <div class="text-xs text-gray-500 mt-2">
                <p>If automatic printing fails:</p>
                <ol class="list-decimal pl-4 mt-1 space-y-1">
                    <li>Copy the receipt text</li>
                    <li>Open any text editor (Notes, Word, etc.)</li>
                    <li>Paste and set font to "Courier New"</li>
                    <li>Print to your thermal printer</li>
                </ol>
            </div>
        </div>
    `;
    
    // Update modal footer buttons
    const modalFooter = printModal.querySelector('.flex.space-x-3');
    if (modalFooter) {
        modalFooter.innerHTML = `
            <button onclick="closePrintModal()" class="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-50">
                <i class="fas fa-times mr-2"></i> Close
            </button>
        `;
    }
    
    // Show modal
    printModal.classList.remove('hidden');
}

function printForMobile(printContent) {
    // Method 1: Try iframe printing (most reliable for mobile)
    try {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden;';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt Print</title>
                <style>
                    @media print {
                        body, html { 
                            margin: 0 !important; 
                            padding: 0 !important;
                            width: 58mm !important;
                            font-family: 'Courier New', monospace !important;
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
                        margin: 0;
                        padding: 2mm;
                        white-space: pre;
                        line-height: 1;
                    }
                </style>
            </head>
            <body>
                ${printContent.replace(/\n/g, '<br>')}
                <script>
                    // Auto print
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                            // Close iframe after printing
                            window.frameElement.parentNode.removeChild(window.frameElement);
                        }, 1000);
                    }, 100);
                    
                    // Fallback: if print doesn't start in 3 seconds, show manual option
                    setTimeout(function() {
                        if (!window.printStarted) {
                            alert('Print dialog not opening. Please use manual print option.');
                            window.frameElement.parentNode.removeChild(window.frameElement);
                        }
                    }, 3000);
                    
                    window.onbeforeprint = function() {
                        window.printStarted = true;
                    };
                </script>
            </body>
            </html>
        `);
        doc.close();
        
        // Save order immediately
        saveOrderAndClearCart();
        
    } catch (error) {
        console.error('Iframe print failed:', error);
        // Fallback to Method 2
        printForMobileFallback(printContent);
    }
}

function printForMobileFallback(printContent) {
    // Method 2: Simple window print
    try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print Receipt</title>
                    <style>
                        body {
                            font-family: monospace;
                            font-size: 9pt;
                            white-space: pre;
                            margin: 0;
                            padding: 2mm;
                        }
                    </style>
                </head>
                <body onload="window.print(); setTimeout(() => window.close(), 1000);">
                    ${printContent}
                </body>
                </html>
            `);
            printWindow.document.close();
            
            // Save order
            saveOrderAndClearCart();
        } else {
            // Method 3: Direct print API
            printViaDirectAPI(printContent);
        }
    } catch (error) {
        console.error('Window print failed:', error);
        printViaDirectAPI(printContent);
    }
}

function printViaDirectAPI(printContent) {
    // Method 3: Use browser's print API directly
    const printDiv = document.createElement('div');
    printDiv.id = 'directPrintReceipt';
    printDiv.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: 58mm;
        font-family: 'Courier New', monospace;
        font-size: 9pt;
        white-space: pre;
        line-height: 1;
        padding: 2mm;
        background: white;
        z-index: 99999;
        visibility: hidden;
    `;
    printDiv.textContent = printContent;
    document.body.appendChild(printDiv);
    
    // Trigger print
    window.print();
    
    // Clean up
    setTimeout(() => {
        if (printDiv.parentNode) {
            printDiv.parentNode.removeChild(printDiv);
        }
    }, 1000);
    
    // Save order
    saveOrderAndClearCart();
    closePrintModal();
}

function printForDesktop(printContent) {
    // Create a print-friendly window with thermal printer styling
    const printWindow = window.open('', '_blank', 'width=240,height=600');
    if (!printWindow) {
        // Fallback to browser print dialog
        printViaBrowser(printContent);
        return;
    }
    
    // Create thermal printer style HTML
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
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
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
                    letter-spacing: 0.01em;
                }
                .header {
                    text-align: center;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .center {
                    text-align: center;
                }
                .divider {
                    border-top: 1px dashed #000;
                    margin: 3px 0;
                }
                .receipt {
                    word-break: break-word;
                    overflow-wrap: break-word;
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <pre>${printContent}</pre>
            </div>
            <script>
                window.onload = function() {
                    // Auto-print after a short delay
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => {
                            window.close();
                        }, 500);
                    }, 100);
                }
                
                // Also allow manual print trigger
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey && e.key === 'p') {
                        e.preventDefault();
                        window.print();
                    }
                });
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Fallback browser print function
function printViaBrowser(printContent) {
    // Create a hidden div for printing
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
    
    // Trigger print
    window.print();
    
    // Clean up
    setTimeout(() => {
        if (printDiv.parentNode) {
            printDiv.parentNode.removeChild(printDiv);
        }
    }, 100);
    
    // Save order even if printing fails
    setTimeout(() => {
        saveOrderAndClearCart();
        closePrintModal();
    }, 1000);
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
        // Re-enable body scrolling
        document.body.style.overflow = '';
    }
}

// Mobile-specific helper functions
window.attemptMobilePrint = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text');
    if (receiptText) {
        printForMobile(receiptText);
    } else {
        // Fallback to reading text content
        const receiptText = document.getElementById('printContent').textContent;
        printForMobile(receiptText);
    }
};

window.copyReceiptForPrinting = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text') || 
                       document.getElementById('printContent').textContent;
    
    navigator.clipboard.writeText(receiptText).then(() => {
        showNotification('Receipt copied to clipboard! You can now paste and print.', 'success');
        
        // Optional: Show instructions
        setTimeout(() => {
            if (confirm('Receipt copied! Would you like to see printing instructions?')) {
                alert('Printing Instructions:\n\n1. Open any text editor (Notes, Word, etc.)\n2. Paste the receipt text\n3. Set font to "Courier New" size 9\n4. Set paper size to 58mm width\n5. Print to your thermal printer');
            }
        }, 500);
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Copy failed. Please select and copy the text manually.', 'error');
    });
};

window.downloadReceiptText = function() {
    const receiptText = document.getElementById('printContent').getAttribute('data-receipt-text') || 
                       document.getElementById('printContent').textContent;
    
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${generateOrderId()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Receipt downloaded as text file!', 'success');
};

// Make functions available globally
window.prepareReceipt = prepareReceipt;
window.printReceipt = printReceipt;
window.closePrintModal = closePrintModal;

// Helper function for notifications (make sure this exists)
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
