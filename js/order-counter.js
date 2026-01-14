// order-counter.js - Sequential order ID generator
class OrderCounter {
    constructor() {
        this.countersRef = null;
        this.currentCount = 0;
        this.restaurantId = null;
    }

    async initialize(userId) {
        this.restaurantId = userId;
        this.countersRef = db.collection('orderCounters').doc(userId);
        
        try {
            const doc = await this.countersRef.get();
            if (!doc.exists) {
                // Initialize with count 0
                await this.countersRef.set({
                    count: 0,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
                this.currentCount = 0;
            } else {
                this.currentCount = doc.data().count || 0;
            }
        } catch (error) {
            console.error('Error initializing order counter:', error);
            this.currentCount = 0;
        }
    }

    async getNextOrderId() {
        try {
            // Increment counter
            const batch = db.batch();
            const counterDoc = await this.countersRef.get();
            
            let newCount = 1;
            if (counterDoc.exists) {
                newCount = (counterDoc.data().count || 0) + 1;
            }
            
            // Update counter
            batch.set(this.countersRef, {
                count: newCount,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            await batch.commit();
            
            // Generate order ID
            const date = new Date();
            const year = date.getFullYear().toString().substr(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const sequential = newCount.toString().padStart(4, '0');
            
            return `ORD${year}${month}${day}${sequential}`;
            
        } catch (error) {
            console.error('Error generating order ID:', error);
            // Fallback to timestamp-based ID
            return `ORD${Date.now()}`;
        }
    }

    getCurrentCount() {
        return this.currentCount;
    }
}

// Create global instance
window.OrderCounter = new OrderCounter();
