// js/table-responsive.js - Enhanced mobile table handling
document.addEventListener('DOMContentLoaded', function() {
    initResponsiveTables();
});

function initResponsiveTables() {
    const tables = document.querySelectorAll('.table-responsive');
    
    tables.forEach(table => {
        // Add touch events for better mobile scrolling
        let startX, scrollLeft;
        let isDragging = false;
        
        table.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].pageX - table.offsetLeft;
            scrollLeft = table.scrollLeft;
            table.style.cursor = 'grabbing';
            table.style.userSelect = 'none';
        });
        
        table.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.touches[0].pageX - table.offsetLeft;
            const walk = (x - startX) * 2; // Scroll-fast factor
            table.scrollLeft = scrollLeft - walk;
        });
        
        table.addEventListener('touchend', () => {
            isDragging = false;
            table.style.cursor = 'grab';
            table.style.removeProperty('user-select');
        });
        
        // Add scroll indicators
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator hidden';
        scrollIndicator.innerHTML = '<i class="fas fa-chevron-right"></i>';
        table.parentNode.appendChild(scrollIndicator);
        
        // Show/hide scroll indicator
        function updateScrollIndicator() {
            const hasHorizontalScroll = table.scrollWidth > table.clientWidth;
            const isAtStart = table.scrollLeft === 0;
            const isAtEnd = table.scrollLeft >= (table.scrollWidth - table.clientWidth - 1);
            
            if (hasHorizontalScroll && !isAtEnd) {
                scrollIndicator.classList.remove('hidden');
            } else {
                scrollIndicator.classList.add('hidden');
            }
        }
        
        table.addEventListener('scroll', updateScrollIndicator);
        window.addEventListener('resize', updateScrollIndicator);
        updateScrollIndicator();
        
        // Add mobile-friendly hover effects
        if ('ontouchstart' in window) {
            table.addEventListener('touchstart', function(e) {
                const row = e.target.closest('tr');
                if (row && row.parentNode.tagName === 'TBODY') {
                    row.classList.add('touch-active');
                }
            }, { passive: true });
            
            table.addEventListener('touchend', function() {
                const activeRow = table.querySelector('.touch-active');
                if (activeRow) {
                    setTimeout(() => activeRow.classList.remove('touch-active'), 150);
                }
            }, { passive: true });
        }
    });
    
    // Adjust table layout on orientation change
    window.addEventListener('orientationchange', function() {
        setTimeout(initResponsiveTables, 300);
    });
}

// Helper function to check if mobile
function isMobile() {
    return window.innerWidth <= 768;
}

// Export functions
window.TableResponsive = {
    init: initResponsiveTables,
    isMobile: isMobile
};
