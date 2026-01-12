// js/table-scroll.js - Isolate table scrolling
document.addEventListener('DOMContentLoaded', function() {
    initTableScrollIsolation();
    setupTouchScrolling();
});

function initTableScrollIsolation() {
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        const table = wrapper.querySelector('table');
        
        // Check if horizontal scroll is needed
        function checkScrollNeeded() {
            const needsScroll = table.scrollWidth > wrapper.clientWidth;
            
            if (needsScroll) {
                wrapper.classList.add('has-horizontal-scroll');
                
                // Calculate how much scroll is available
                const scrollPercentage = (wrapper.clientWidth / table.scrollWidth) * 100;
                
                if (scrollPercentage < 80) {
                    wrapper.classList.add('significant-scroll');
                }
            } else {
                wrapper.classList.remove('has-horizontal-scroll');
                wrapper.classList.remove('significant-scroll');
            }
        }
        
        // Initial check
        checkScrollNeeded();
        
        // Check on resize
        window.addEventListener('resize', checkScrollNeeded);
        
        // Prevent body scroll when table is scrolling
        wrapper.addEventListener('wheel', function(e) {
            // If horizontal scroll, prevent default vertical scroll
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
            }
            
            // If at horizontal limits and trying to scroll horizontally,
            // prevent the event from bubbling to body
            const atLeft = wrapper.scrollLeft === 0;
            const atRight = wrapper.scrollLeft >= (wrapper.scrollWidth - wrapper.clientWidth - 1);
            
            if ((e.deltaX > 0 && atRight) || (e.deltaX < 0 && atLeft)) {
                e.stopPropagation();
            }
        }, { passive: false });
        
        // Touch events for mobile
        wrapper.addEventListener('touchstart', function(e) {
            // Store initial touch position
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.isScrolling = null;
        }, { passive: true });
        
        wrapper.addEventListener('touchmove', function(e) {
            if (!this.touchStartX || !this.touchStartY) return;
            
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            
            const diffX = this.touchStartX - touchX;
            const diffY = this.touchStartY - touchY;
            
            // Determine scroll direction
            if (this.isScrolling === null) {
                this.isScrolling = Math.abs(diffX) > Math.abs(diffY);
            }
            
            // If horizontal scrolling, prevent body scroll
            if (this.isScrolling) {
                e.preventDefault();
                wrapper.scrollLeft += diffX;
                this.touchStartX = touchX;
                this.touchStartY = touchY;
            }
        }, { passive: false });
        
        wrapper.addEventListener('touchend', function() {
            this.touchStartX = null;
            this.touchStartY = null;
            this.isScrolling = null;
        }, { passive: true });
    });
}

function setupTouchScrolling() {
    // Only for mobile
    if (window.innerWidth > 768) return;
    
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        let isDragging = false;
        let startX, scrollLeft;
        
        wrapper.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
            wrapper.style.cursor = 'grabbing';
            document.body.style.overflow = 'hidden'; // Prevent body scroll
        });
        
        wrapper.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 2;
            wrapper.scrollLeft = scrollLeft - walk;
        });
        
        wrapper.addEventListener('mouseup', () => {
            isDragging = false;
            wrapper.style.cursor = 'grab';
            document.body.style.overflow = ''; // Restore body scroll
        });
        
        wrapper.addEventListener('mouseleave', () => {
            isDragging = false;
            wrapper.style.cursor = 'grab';
            document.body.style.overflow = '';
        });
    });
}

// Add scroll boundary detection
function setupScrollBoundaries() {
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        wrapper.addEventListener('scroll', function() {
            const atLeft = this.scrollLeft === 0;
            const atRight = this.scrollLeft >= (this.scrollWidth - this.clientWidth - 1);
            
            // Add/remove classes for styling
            if (atLeft) {
                this.classList.add('at-left');
                this.classList.remove('at-right');
            } else if (atRight) {
                this.classList.add('at-right');
                this.classList.remove('at-left');
            } else {
                this.classList.remove('at-left', 'at-right');
            }
        });
    });
}

// Initialize everything
window.TableScroll = {
    init: function() {
        initTableScrollIsolation();
        setupTouchScrolling();
        setupScrollBoundaries();
    }
};

// Re-initialize on window resize
window.addEventListener('resize', function() {
    setTimeout(initTableScrollIsolation, 100);
});
