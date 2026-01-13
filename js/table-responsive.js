// js/table-responsive.js - Enhanced mobile table scrolling
document.addEventListener('DOMContentLoaded', function() {
    initResponsiveTables();
    setupTouchScrolling();
    setupScrollBoundaries();
    showMobileSwipeHint();
});

function initResponsiveTables() {
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        const table = wrapper.querySelector('table');
        if (!table) return;
        
        // Add loading state
        wrapper.classList.add('loading');
        
        // Check if horizontal scroll is needed
        function checkScrollNeeded() {
            setTimeout(() => {
                const needsScroll = table.scrollWidth > wrapper.clientWidth;
                
                if (needsScroll) {
                    wrapper.classList.add('has-horizontal-scroll');
                    
                    // Calculate scroll percentage
                    const scrollPercentage = (wrapper.clientWidth / table.scrollWidth) * 100;
                    
                    if (scrollPercentage < 70) {
                        wrapper.classList.add('significant-scroll');
                        showScrollHint(wrapper);
                    } else {
                        wrapper.classList.remove('significant-scroll');
                    }
                } else {
                    wrapper.classList.remove('has-horizontal-scroll', 'significant-scroll');
                }
                
                // Remove loading state
                wrapper.classList.remove('loading');
                
                // Check if table is empty
                const tbody = table.querySelector('tbody');
                if (tbody && tbody.children.length === 0) {
                    wrapper.classList.add('empty');
                    createEmptyState(wrapper);
                } else {
                    wrapper.classList.remove('empty');
                }
            }, 100);
        }
        
        // Initial check
        checkScrollNeeded();
        
        // Check on resize with debounce
        let resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(checkScrollNeeded, 250);
        });
        
        // Add touch-friendly class on mobile
        if (window.innerWidth <= 768) {
            wrapper.classList.add('touch-enabled');
        }
        
        // Wheel event for desktop
        wrapper.addEventListener('wheel', function(e) {
            // If horizontal scroll, prevent default vertical scroll
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                e.preventDefault();
                this.scrollLeft += e.deltaX;
            }
            
            // Prevent body scroll when at table boundaries
            const atLeft = this.scrollLeft <= 10;
            const atRight = this.scrollLeft >= (this.scrollWidth - this.clientWidth - 10);
            
            if ((e.deltaX > 0 && atRight) || (e.deltaX < 0 && atLeft)) {
                e.stopPropagation();
            }
        }, { passive: false });
        
        // Add momentum scrolling for iOS
        wrapper.addEventListener('touchstart', function() {
            this.classList.add('scrolling');
        }, { passive: true });
        
        wrapper.addEventListener('touchend', function() {
            setTimeout(() => {
                this.classList.remove('scrolling');
            }, 100);
        }, { passive: true });
    });
}

function showScrollHint(wrapper) {
    if (window.innerWidth > 768) return;
    
    // Remove existing hint
    const existingHint = wrapper.querySelector('.scroll-hint');
    if (existingHint) existingHint.remove();
    
    const hint = document.createElement('div');
    hint.className = 'scroll-hint';
    hint.innerHTML = `
        <div class="flex items-center justify-center p-2 text-xs text-gray-500">
            <i class="fas fa-arrows-left-right mr-2"></i>
            Swipe to scroll
        </div>
    `;
    
    wrapper.appendChild(hint);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (hint.parentNode) {
            hint.remove();
        }
    }, 5000);
}

function createEmptyState(wrapper) {
    // Remove existing empty state
    const existingEmptyState = wrapper.querySelector('.empty-state');
    if (existingEmptyState) existingEmptyState.remove();
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state absolute inset-0 flex flex-col items-center justify-center p-8 text-center';
    emptyState.innerHTML = `
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <i class="fas fa-table text-gray-400 text-2xl"></i>
        </div>
        <h3 class="text-lg font-medium text-gray-600 mb-2">No data available</h3>
        <p class="text-gray-500 text-sm">Add some items to see them here</p>
    `;
    
    wrapper.style.position = 'relative';
    wrapper.appendChild(emptyState);
}

function setupTouchScrolling() {
    // Enhanced touch scrolling for mobile
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        let startX, startY, scrollLeft, isScrolling;
        
        wrapper.addEventListener('touchstart', function(e) {
            isScrolling = false;
            startX = e.touches[0].pageX - wrapper.offsetLeft;
            startY = e.touches[0].pageY;
            scrollLeft = wrapper.scrollLeft;
            
            // Add active state
            this.classList.add('active');
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        }, { passive: true });
        
        wrapper.addEventListener('touchmove', function(e) {
            if (!startX || !startY) return;
            
            const x = e.touches[0].pageX - wrapper.offsetLeft;
            const y = e.touches[0].pageY;
            
            const diffX = x - startX;
            const diffY = y - startY;
            
            // Determine if user is trying to scroll horizontally
            if (!isScrolling) {
                isScrolling = Math.abs(diffX) > Math.abs(diffY);
            }
            
            if (isScrolling) {
                e.preventDefault();
                
                // Smooth scrolling with momentum
                const walk = diffX * 1.5;
                wrapper.scrollLeft = scrollLeft - walk;
                
                // Update start position for smooth continuous scrolling
                startX = e.touches[0].pageX - wrapper.offsetLeft;
            }
        }, { passive: false });
        
        wrapper.addEventListener('touchend', function() {
            startX = null;
            startY = null;
            isScrolling = false;
            
            // Remove active state
            this.classList.remove('active');
            
            // Restore body scroll
            document.body.style.overflow = '';
        }, { passive: true });
        
        // Mouse drag support for desktop testing
        let isDragging = false;
        
        wrapper.addEventListener('mousedown', function(e) {
            isDragging = true;
            startX = e.pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
            this.style.cursor = 'grabbing';
        });
        
        wrapper.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 2;
            wrapper.scrollLeft = scrollLeft - walk;
        });
        
        wrapper.addEventListener('mouseup', function() {
            isDragging = false;
            this.style.cursor = '';
        });
        
        wrapper.addEventListener('mouseleave', function() {
            isDragging = false;
            this.style.cursor = '';
        });
    });
}

function setupScrollBoundaries() {
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        let scrollTimeout;
        
        wrapper.addEventListener('scroll', function() {
            const atLeft = this.scrollLeft <= 10;
            const atRight = this.scrollLeft >= (this.scrollWidth - this.clientWidth - 10);
            
            // Update classes for styling
            this.classList.toggle('at-left', atLeft);
            this.classList.toggle('at-right', atRight);
            
            // Add scroll effect
            this.classList.add('scrolling');
            
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.classList.remove('scrolling');
            }, 150);
        });
    });
}

function showMobileSwipeHint() {
    if (window.innerWidth > 768) return;
    
    // Check if hint was already shown
    if (localStorage.getItem('mobileSwipeHintShown')) return;
    
    // Wait for tables to load
    setTimeout(() => {
        const hasScrollableTables = document.querySelector('.has-horizontal-scroll');
        if (!hasScrollableTables) return;
        
        const hint = document.createElement('div');
        hint.className = 'mobile-swipe-hint';
        hint.innerHTML = `
            <i class="fas fa-hand-point-right"></i>
            <span>Swipe table horizontally to see more</span>
        `;
        
        document.body.appendChild(hint);
        
        // Remove after 4 seconds
        setTimeout(() => {
            if (hint.parentNode) {
                hint.style.animation = 'slideUp 0.5s ease-out reverse forwards';
                setTimeout(() => hint.remove(), 500);
            }
        }, 4000);
        
        // Mark as shown
        localStorage.setItem('mobileSwipeHintShown', 'true');
    }, 2000);
}

// Re-initialize on window resize
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        initResponsiveTables();
    }, 250);
});

// Expose API
window.TableScroll = {
    init: function() {
        initResponsiveTables();
        setupTouchScrolling();
        setupScrollBoundaries();
        showMobileSwipeHint();
    },
    
    refresh: function() {
        initResponsiveTables();
    },
    
    scrollToLeft: function(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (wrapper) {
            wrapper.scrollLeft = 0;
        }
    },
    
    scrollToRight: function(wrapperId) {
        const wrapper = document.getElementById(wrapperId);
        if (wrapper) {
            wrapper.scrollLeft = wrapper.scrollWidth;
        }
    }
};
