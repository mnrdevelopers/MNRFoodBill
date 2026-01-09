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
        
        let receipt = `
${'='.repeat(42)}
        ${restaurant.name.toUpperCase()}
${'='.repeat(42)}
`;
        
        // Add restaurant details only if they exist
        if (restaurant.address) receipt += `${restaurant.address}\n`;
        if (restaurant.phone) receipt += `${restaurant.phone}\n`;
        if (restaurant.gstin) receipt += `${restaurant.gstin}\n`;
        if (restaurant.fssai) receipt += `${restaurant.fssai}\n`;
        
        receipt += `
${'-'.repeat(42)}
Date: ${now.toLocaleDateString('en-IN')}
Time: ${now.toLocaleTimeString('en-IN', {hour: '2-digit', minute:'2-digit'})}
Bill No: ${billNo}
Table: ${tableNo}
${'-'.repeat(42)}
Customer: ${customerName}
`;
        
        if (customerPhone) {
            receipt += `Phone: ${customerPhone}\n`;
        }
        
        receipt += `
${'-'.repeat(42)}
SL  ITEM              QTY   RATE    AMOUNT
${'-'.repeat(42)}
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
${'-'.repeat(42)}
                BILL SUMMARY
${'-'.repeat(42)}
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
${'-'.repeat(42)}
GRAND TOTAL:                ${currency}${total.toFixed(2).padStart(10)}
${'='.repeat(42)}
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
${'='.repeat(42)}
Thank you for dining with us!
Please visit again.
${'-'.repeat(42)}
** This is a computer generated bill **
** No signature required **
`;
        
        // Add restaurant phone for feedback if available
        if (restaurant.phone) {
            receipt += `
For feedback: ${restaurant.phone}
`;
        }
        
        receipt += `
${'='.repeat(42)}
`;
        
        // Set the receipt content
        const printContent = document.getElementById('printContent');
        printContent.textContent = receipt;
        
        // Show modal
        const modal = document.getElementById('printModal');
        modal.classList.remove('hidden');
        
        // Prevent body scrolling when modal is open
        document.body.style.overflow = 'hidden';
        
        // Add click outside to close
        modal.addEventListener('click', function(e) {
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
    
    // Create a print-friendly window with thermal printer styling
    const printWindow = window.open('', '_blank', 'width=230,height=400');
    if (!printWindow) {
        // Fallback to browser print dialog
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
                    padding: 0;
                    line-height: 1.1;
                    white-space: pre-line;
                }
                .receipt {
                    padding: 2mm;
                    word-wrap: break-word;
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <pre>${printContent}</pre>
            </div>
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
    
    // Save the order to database
    saveOrderAndClearCart();
}

// Fallback browser print function
function printViaBrowser(printContent) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Print Receipt</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        @page { size: 58mm auto; margin: 0; }
                    }
                    body {
                        font-family: 'Courier New', monospace;
                        font-size: 10pt;
                        width: 58mm;
                        margin: 0;
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

// Make functions available globally
window.prepareReceipt = prepareReceipt;
window.printReceipt = printReceipt;
window.closePrintModal = closePrintModal;

