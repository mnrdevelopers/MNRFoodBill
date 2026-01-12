// js/table-responsive.js - Fixed container, scrolling table
document.addEventListener('DOMContentLoaded', function() {
    initTableScrolling();
    setupTableTouch();
});

function initTableScrolling() {
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        const table = wrapper.querySelector('table');
        
        // Check if scrolling is needed
        function checkScrollNeeded() {
            if (table.scrollWidth > wrapper.clientWidth) {
                wrapper.classList.add('scrollable');
                wrapper.classList.add('has-scroll');
            } else {
                wrapper.classList.remove('scrollable');
                wrapper.classList.remove('has-scroll');
            }
        }
        
        // Initial check
        checkScrollNeeded();
        
        // Check on resize
        window.addEventListener('resize', checkScrollNeeded);
        
        // Add scroll event to show/hide indicators
        wrapper.addEventListener('scroll', function() {
            const isAtStart = wrapper.scrollLeft === 0;
            const isAtEnd = wrapper.scrollLeft >= (wrapper.scrollWidth - wrapper.clientWidth - 1);
            
            if (isAtStart) {
                wrapper.classList.remove('scrolled');
            } else {
                wrapper.classList.add('scrolled');
            }
            
            if (isAtEnd) {
                wrapper.classList.remove('can-scroll-right');
            } else {
                wrapper.classList.add('can-scroll-right');
            }
        });
    });
}

function setupTableTouch() {
    // Only for mobile/touch devices
    if (!('ontouchstart' in window)) return;
    
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        let isDragging = false;
        let startX, scrollLeft;
        
        wrapper.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
            wrapper.style.cursor = 'grabbing';
        }, { passive: true });
        
        wrapper.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const x = e.touches[0].pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 2;
            wrapper.scrollLeft = scrollLeft - walk;
        }, { passive: true });
        
        wrapper.addEventListener('touchend', () => {
            isDragging = false;
            wrapper.style.cursor = 'grab';
        }, { passive: true });
        
        // Prevent vertical scroll when horizontally scrolling table
        wrapper.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
            }
        }, { passive: false });
    });
}

// Helper to check if mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Export
window.TableScroll = {
    init: initTableScrolling,
    isMobile: isMobile
};
