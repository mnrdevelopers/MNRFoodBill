// js/table-scroll.js - Smooth horizontal scrolling for tables
class TableScroll {
    constructor() {
        this.tables = [];
        this.init();
    }
    
    init() {
        // Initialize on DOM ready
        document.addEventListener('DOMContentLoaded', () => {
            this.setupTables();
            this.addScrollIndicators();
            this.setupTouchEvents();
        });
        
        // Re-initialize on page changes (for SPA-like behavior)
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => this.setupTables(), 100);
        });
    }
    
    setupTables() {
        // Find all tables in dashboard, products, and orders pages
        const tableSelectors = [
            '#recentOrders table',
            '#productsTable',
            '#ordersTable',
            '.overflow-x-auto table',
            '.table-container table'
        ];
        
        tableSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(table => {
                this.wrapTable(table);
            });
        });
    }
    
    wrapTable(table) {
        // Check if already wrapped
        if (table.parentElement.classList.contains('table-container')) {
            return;
        }
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'table-container smooth-scroll';
        wrapper.style.position = 'relative';
        
        // Wrap the table
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
        
        // Add mobile table class
        table.classList.add('mobile-table');
        
        // Add scroll event listener
        wrapper.addEventListener('scroll', (e) => this.handleScroll(e));
        
        // Store reference
        this.tables.push({
            wrapper,
            table,
            scrollLeft: 0
        });
        
        // Add gradient indicators
        this.addScrollGradients(wrapper);
    }
    
    addScrollGradients(wrapper) {
        // Check if already has gradients
        if (wrapper.querySelector('.scroll-gradient')) return;
        
        // Right gradient
        const rightGradient = document.createElement('div');
        rightGradient.className = 'scroll-gradient right';
        rightGradient.style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            width: 30px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.9));
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 2;
        `;
        wrapper.appendChild(rightGradient);
        
        // Left gradient
        const leftGradient = document.createElement('div');
        leftGradient.className = 'scroll-gradient left';
        leftGradient.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 30px;
            background: linear-gradient(90deg, rgba(255, 255, 255, 0.9), transparent);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 2;
        `;
        wrapper.appendChild(leftGradient);
    }
    
    handleScroll(event) {
        const wrapper = event.target;
        const scrollLeft = wrapper.scrollLeft;
        const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
        
        // Update gradients
        const rightGradient = wrapper.querySelector('.scroll-gradient.right');
        const leftGradient = wrapper.querySelector('.scroll-gradient.left');
        
        if (rightGradient) {
            rightGradient.style.opacity = scrollLeft < maxScroll - 10 ? '1' : '0';
        }
        
        if (leftGradient) {
            leftGradient.style.opacity = scrollLeft > 10 ? '1' : '0';
        }
        
        // Show/hide scroll indicators
        this.updateScrollIndicators(wrapper, scrollLeft, maxScroll);
    }
    
    addScrollIndicators() {
        // Only on mobile
        if (window.innerWidth > 768) return;
        
        // Create scroll right indicator
        const scrollRight = document.createElement('div');
        scrollRight.id = 'scrollRight';
        scrollRight.className = 'scroll-indicator';
        scrollRight.innerHTML = '<i class="fas fa-chevron-right"></i>';
        scrollRight.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: #ef4444;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            z-index: 1000;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(scrollRight);
        
        // Create scroll left indicator
        const scrollLeft = document.createElement('div');
        scrollLeft.id = 'scrollLeft';
        scrollLeft.className = 'scroll-indicator left';
        scrollLeft.innerHTML = '<i class="fas fa-chevron-left"></i>';
        scrollLeft.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 20px;
            background: #ef4444;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            z-index: 1000;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(scrollLeft);
        
        // Add click events
        scrollRight.addEventListener('click', () => this.scrollTable('right'));
        scrollLeft.addEventListener('click', () => this.scrollTable('left'));
        
        // Hide on desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                scrollRight.style.display = 'none';
                scrollLeft.style.display = 'none';
            }
        });
    }
    
    updateScrollIndicators(wrapper, scrollLeft, maxScroll) {
        const scrollRight = document.getElementById('scrollRight');
        const scrollLeftBtn = document.getElementById('scrollLeft');
        
        if (!scrollRight || !scrollLeftBtn) return;
        
        // Show/hide based on scroll position
        if (scrollLeft < maxScroll - 10) {
            scrollRight.classList.add('show');
        } else {
            scrollRight.classList.remove('show');
        }
        
        if (scrollLeft > 10) {
            scrollLeftBtn.classList.add('show');
        } else {
            scrollLeftBtn.classList.remove('show');
        }
        
        // Store current wrapper for scroll buttons
        this.currentWrapper = wrapper;
    }
    
    scrollTable(direction) {
        if (!this.currentWrapper) return;
        
        const scrollAmount = 200;
        const currentScroll = this.currentWrapper.scrollLeft;
        const newScroll = direction === 'right' 
            ? currentScroll + scrollAmount
            : currentScroll - scrollAmount;
        
        // Smooth scroll
        this.currentWrapper.scrollTo({
            left: newScroll,
            behavior: 'smooth'
        });
    }
    
    setupTouchEvents() {
        // Add touch event for better mobile scrolling
        document.querySelectorAll('.table-container').forEach(wrapper => {
            let startX;
            let scrollLeft;
            
            wrapper.addEventListener('touchstart', (e) => {
                startX = e.touches[0].pageX;
                scrollLeft = wrapper.scrollLeft;
                wrapper.style.cursor = 'grabbing';
            });
            
            wrapper.addEventListener('touchmove', (e) => {
                if (!startX) return;
                
                const x = e.touches[0].pageX;
                const walk = (x - startX) * 2; // Scroll speed
                
                wrapper.scrollLeft = scrollLeft - walk;
                e.preventDefault();
            });
            
            wrapper.addEventListener('touchend', () => {
                startX = null;
                wrapper.style.cursor = '';
            });
        });
    }
    
    refresh() {
        // Refresh all tables
        this.tables.forEach(({ wrapper }) => {
            if (wrapper) {
                wrapper.dispatchEvent(new Event('scroll'));
            }
        });
    }
}

// Initialize table scroll
const tableScroll = new TableScroll();

// Export for use in other files
window.TableScroll = tableScroll;
