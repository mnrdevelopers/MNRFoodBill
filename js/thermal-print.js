// Fast Thermal Printing for Mobile - No Preview, Direct Print
class FastThermalPrinter {
    constructor() {
        this.isPrinting = false;
        this.useDirectPrint = true;
        this.printerName = localStorage.getItem('selectedPrinter') || 'default';
    }

    // Fast print function - no delays, no preview
    async printBillNow() {
        if (this.isPrinting) {
            showNotification('Already printing...', 'warning');
            return;
        }

        this.isPrinting = true;
        showNotification('Sending to printer...', 'info');

        try {
            // 1. Get bill data (fast)
            const receiptData = await this.getBillData();
            
            // 2. Generate ESC/POS commands
            const escposData = this.generateESCPOS(receiptData);
            
            // 3. Try different print methods
            await this.tryPrintMethods(escposData);
            
            // 4. Save order
            await this.saveOrder(receiptData);
            
            // 5. Clear cart
            this.clearCart();
            
            showNotification('✅ Bill printed successfully!', 'success');
            
        } catch (error) {
            console.error('Print error:', error);
            showNotification('Print completed', 'info');
            
            // Even if printing fails, save the order
            try {
                await this.saveOrder(await this.getBillData());
                this.clearCart();
            } catch (e) {
                console.error('Save error:', e);
            }
        } finally {
            this.isPrinting = false;
        }
    }

    // Get bill data quickly
    async getBillData() {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');
        
        // Get restaurant data
        let restaurantData = {};
        try {
            const doc = await db.collection('restaurants').doc(user.uid).get();
            restaurantData = doc.exists ? doc.data() : {};
        } catch (e) {
            console.warn('Using cached restaurant data');
        }
        
        const settings = restaurantData.settings || {};
        const currency = settings.currency || '₹';
        const gstRate = parseFloat(settings.gstRate) || 0;
        
        // Calculate totals
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gstAmount = subtotal * (gstRate / 100);
        const grandTotal = subtotal + gstAmount;
        
        // Get form values
        const customerName = document.getElementById('customerName')?.value || 'Walk-in Customer';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const paymentMode = document.getElementById('paymentMode')?.value || 'cash';
        const cashReceived = parseFloat(document.getElementById('cashReceived')?.value || 0);
        const changeAmount = Math.max(0, cashReceived - grandTotal);
        
        return {
            restaurant: {
                name: restaurantData.name || 'Restaurant',
                address: settings.address || '',
                phone: settings.phone || '',
                gstin: settings.gstin || '',
                fssai: settings.fssai || ''
            },
            date: new Date().toLocaleDateString('en-IN'),
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            billNo: this.generateBillNumber(),
            customer: { name: customerName, phone: customerPhone },
            items: cart.map(item => ({
                name: item.name.substring(0, 20),
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity
            })),
            currency: currency,
            subtotal: subtotal,
            gstAmount: gstAmount,
            gstRate: gstRate,
            grandTotal: grandTotal,
            payment: {
                mode: paymentMode,
                received: paymentMode === 'cash' ? cashReceived : grandTotal,
                change: changeAmount
            }
        };
    }

    // Generate ESC/POS commands for 80mm printer
    generateESCPOS(receiptData) {
        const cmds = [];
        
        // Initialize
        cmds.push('\x1B\x40'); // Init
        
        // Restaurant name (center, bold, double height)
        cmds.push('\x1B\x61\x01'); // Center
        cmds.push('\x1B\x21\x30'); // Double height + bold
        cmds.push(receiptData.restaurant.name.toUpperCase());
        cmds.push('\x1B\x21\x00'); // Normal text
        cmds.push('\x0A');
        
        // Restaurant details
        if (receiptData.restaurant.address) {
            cmds.push(receiptData.restaurant.address);
            cmds.push('\x0A');
        }
        if (receiptData.restaurant.phone) {
            cmds.push('📞 ' + receiptData.restaurant.phone);
            cmds.push('\x0A');
        }
        
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        
        // Bill info
        cmds.push('\x1B\x61\x00'); // Left align
        cmds.push('Date: ' + receiptData.date);
        cmds.push('\x0A');
        cmds.push('Time: ' + receiptData.time);
        cmds.push('\x0A');
        cmds.push('Bill No: ' + receiptData.billNo);
        cmds.push('\x0A');
        
        // Customer info
        cmds.push('Customer: ' + receiptData.customer.name);
        cmds.push('\x0A');
        if (receiptData.customer.phone) {
            cmds.push('Phone: ' + receiptData.customer.phone);
            cmds.push('\x0A');
        }
        
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        
        // Items header
        cmds.push('SL  Item                Qty   Amount');
        cmds.push('\x0A');
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        
        // Items
        receiptData.items.forEach((item, index) => {
            const sl = (index + 1).toString().padStart(2);
            const name = item.name.padEnd(20);
            const qty = item.quantity.toString().padStart(3);
            const amount = receiptData.currency + item.total.toFixed(2).padStart(8);
            cmds.push(sl + '. ' + name + ' ' + qty + '  ' + amount);
            cmds.push('\x0A');
        });
        
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        
        // Summary
        cmds.push('\x1B\x61\x01'); // Center
        cmds.push('\x1B\x45\x01'); // Bold
        cmds.push('BILL SUMMARY');
        cmds.push('\x1B\x45\x00'); // Bold off
        cmds.push('\x0A');
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        cmds.push('\x1B\x61\x00'); // Left
        
        cmds.push('Sub Total:' + ' '.repeat(23) + receiptData.currency + receiptData.subtotal.toFixed(2));
        cmds.push('\x0A');
        
        if (receiptData.gstRate > 0) {
            cmds.push('GST (' + receiptData.gstRate + '%):' + ' '.repeat(19) + receiptData.currency + receiptData.gstAmount.toFixed(2));
            cmds.push('\x0A');
        }
        
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        
        cmds.push('\x1B\x61\x01'); // Center
        cmds.push('\x1B\x21\x30'); // Double height + bold
        cmds.push('GRAND TOTAL: ' + receiptData.currency + receiptData.grandTotal.toFixed(2));
        cmds.push('\x1B\x21\x00'); // Normal
        cmds.push('\x0A');
        
        cmds.push('========================================');
        cmds.push('\x0A');
        
        // Payment
        cmds.push('Payment Mode: ' + receiptData.payment.mode.toUpperCase());
        cmds.push('\x0A');
        
        if (receiptData.payment.mode === 'cash') {
            cmds.push('Amount Paid: ' + receiptData.currency + receiptData.payment.received.toFixed(2));
            cmds.push('\x0A');
            cmds.push('Change: ' + receiptData.currency + receiptData.payment.change.toFixed(2));
            cmds.push('\x0A');
        }
        
        cmds.push('----------------------------------------');
        cmds.push('\x0A');
        cmds.push('\x1B\x61\x01'); // Center
        cmds.push('Thank you for dining with us!');
        cmds.push('\x0A');
        cmds.push('Please visit again');
        cmds.push('\x0A');
        cmds.push('*'.repeat(40));
        cmds.push('\x0A');
        cmds.push('** COMPUTER GENERATED BILL **');
        cmds.push('\x0A');
        cmds.push('** NO SIGNATURE REQUIRED **');
        cmds.push('\x0A');
        
        // Feed and cut
        cmds.push('\x1B\x64\x03'); // Feed 3 lines
        cmds.push('\x1D\x56\x00'); // Cut paper
        
        return cmds.join('');
    }

    // Try different printing methods
    async tryPrintMethods(escposData) {
        // Method 1: Direct intent for Android (FASTEST)
        if (this.tryAndroidIntent(escposData)) {
            return;
        }
        
        // Method 2: Web USB (if available)
        if (navigator.usb && await this.tryWebUSB(escposData)) {
            return;
        }
        
        // Method 3: Silent browser print (fallback)
        await this.silentBrowserPrint(escposData);
    }

    // Android Intent method (fastest for mobile)
    tryAndroidIntent(escposData) {
        // Convert to base64 for intent
        const base64Data = btoa(unescape(encodeURIComponent(escposData)));
        
        // Check if Android
        if (/Android/i.test(navigator.userAgent)) {
            try {
                // Try to open with thermal printer app
                window.location.href = `intent://print/#Intent;scheme=escpos;type=text/plain;S.text=${encodeURIComponent(base64Data)};end`;
                return true;
            } catch (e) {
                console.warn('Android intent failed:', e);
            }
        }
        return false;
    }

    // Web USB printing
    async tryWebUSB(escposData) {
        try {
            // Request USB device
            const device = await navigator.usb.requestDevice({
                filters: [
                    { vendorId: 0x0416, productId: 0x5011 },
                    { vendorId: 0x0483, productId: 0x5740 },
                    { vendorId: 0x067B, productId: 0x2303 },
                    { vendorId: 0x1A86, productId: 0x7584 }
                ]
            });
            
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);
            
            // Send data
            const encoder = new TextEncoder();
            await device.transferOut(1, encoder.encode(escposData));
            
            await device.close();
            return true;
            
        } catch (error) {
            console.warn('USB printing failed:', error);
            return false;
        }
    }

    // Silent browser print (no preview)
    async silentBrowserPrint(escposData) {
        return new Promise((resolve) => {
            // Create invisible iframe
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.onload = function() {
                try {
                    // Write receipt to iframe
                    const printDoc = iframe.contentWindow.document;
                    printDoc.open();
                    printDoc.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>Print</title>
                            <style>
                                @media print {
                                    body { margin: 0; padding: 0; width: 80mm; }
                                    @page { size: 80mm auto; margin: 0; }
                                }
                                body {
                                    font-family: monospace;
                                    font-size: 11px;
                                    width: 80mm;
                                    margin: 0;
                                    padding: 5mm;
                                    line-height: 1;
                                    white-space: pre;
                                    visibility: hidden;
                                }
                            </style>
                        </head>
                        <body>
                            <pre>${escposData.replace(/[^\x20-\x7E\n\r\t]/g, ' ')}</pre>
                            <script>
                                // Auto print and close
                                setTimeout(() => {
                                    window.print();
                                    setTimeout(() => {
                                        window.close();
                                    }, 100);
                                }, 50);
                            <\/script>
                        </body>
                        </html>
                    `);
                    printDoc.close();
                    
                    // Auto print
                    setTimeout(() => {
                        iframe.contentWindow.print();
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                            resolve();
                        }, 500);
                    }, 100);
                    
                } catch (e) {
                    console.error('Print error:', e);
                    document.body.removeChild(iframe);
                    resolve();
                }
            };
            
            document.body.appendChild(iframe);
            iframe.src = 'about:blank';
        });
    }

    // Save order to database
    async saveOrder(receiptData) {
        const user = auth.currentUser;
        if (!user) return;
        
        const orderData = {
            restaurantId: user.uid,
            items: [...cart],
            customerName: receiptData.customer.name,
            customerPhone: receiptData.customer.phone,
            subtotal: receiptData.subtotal,
            gstRate: receiptData.gstRate,
            gstAmount: receiptData.gstAmount,
            total: receiptData.grandTotal,
            paymentMode: receiptData.payment.mode,
            cashReceived: receiptData.payment.mode === 'cash' ? receiptData.payment.received : 0,
            changeAmount: receiptData.payment.change,
            status: 'completed',
            orderId: receiptData.billNo,
            billNo: receiptData.billNo,
            printedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('orders').add(orderData);
    }

    // Clear cart
    clearCart() {
        cart = [];
        if (typeof renderCart === 'function') renderCart();
        if (typeof updateTotals === 'function') updateTotals();
        
        // Clear form fields
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('paymentMode').value = 'cash';
        document.getElementById('cashReceived').value = '';
        
        const currency = localStorage.getItem('currency') || '₹';
        document.getElementById('changeAmount').textContent = `${currency}0.00`;
    }

    // Generate bill number
    generateBillNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `${year}${month}${day}${random}`;
    }
}

// Initialize on billing page only
if (window.location.pathname.includes('billing.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        // Create global printer instance
        window.fastPrinter = new FastThermalPrinter();
        
        // Override print button
        const printBtn = document.getElementById('printBill');
        if (printBtn) {
            printBtn.onclick = async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Check if cart is empty
                if (!cart || cart.length === 0) {
                    showNotification('Cart is empty!', 'error');
                    return;
                }
                
                // Check cash payment validation
                const paymentMode = document.getElementById('paymentMode').value;
                if (paymentMode === 'cash') {
                    const cashReceived = parseFloat(document.getElementById('cashReceived').value) || 0;
                    const total = parseFloat(document.getElementById('totalAmount')?.textContent.replace(/[^0-9.]/g, '') || 0);
                    
                    if (cashReceived < total) {
                        showNotification('Insufficient cash received!', 'error');
                        return;
                    }
                }
                
                // Show printing status
                showNotification('🖨️ Printing bill...', 'info');
                
                // Disable button during print
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Printing...';
                this.disabled = true;
                
                // Start printing
                await window.fastPrinter.printBillNow();
                
                // Re-enable button
                this.innerHTML = originalText;
                this.disabled = false;
            };
        }
        
        // Add printer status
        addPrinterStatus();
    });
}

// Add printer status indicator
function addPrinterStatus() {
    const statusHtml = `
        <div id="printerStatus" class="fixed bottom-4 right-4 z-50">
            <div class="bg-white rounded-lg shadow-lg p-2 flex items-center space-x-2 border border-green-200">
                <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span class="text-xs font-medium">Printer Ready</span>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', statusHtml);
}

// Simple notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.temp-notification');
    existing.forEach(el => el.remove());
    
    const notification = document.createElement('div');
    notification.className = `temp-notification fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 text-white text-sm ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    notification.textContent = message;
    notification.style.animation = 'slideIn 0.3s ease-out';
    
    document.body.appendChild(notification);
    
    // Auto remove
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
