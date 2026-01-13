// js/table-responsive.js - Mobile cards, Desktop tables
document.addEventListener('DOMContentLoaded', function() {
    initResponsiveTables();
    setupTouchScrolling();
    checkScreenSize();
    
    // Listen for screen size changes
    window.addEventListener('resize', checkScreenSize);
});

function initResponsiveTables() {
    const tableContainers = document.querySelectorAll('.table-container');
    
    tableContainers.forEach(container => {
        const table = container.querySelector('table');
        if (!table) return;
        
        // Create cards container for mobile
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'cards-container hidden grid grid-cols-1 gap-4 p-4';
        container.appendChild(cardsContainer);
        
        // Function to convert table to cards
        function convertToCards() {
            if (window.innerWidth > 768) {
                table.classList.remove('hidden');
                cardsContainer.classList.add('hidden');
                return;
            }
            
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            if (!thead || !tbody) return;
            
            // Get column headers
            const headers = Array.from(thead.querySelectorAll('th')).map(th => th.textContent.trim());
            
            // Clear existing cards
            cardsContainer.innerHTML = '';
            
            // Create cards from each row
            tbody.querySelectorAll('tr').forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 0) return;
                
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-4';
                
                let cardContent = '';
                
                cells.forEach((cell, cellIndex) => {
                    if (cellIndex >= headers.length) return;
                    
                    const header = headers[cellIndex];
                    const cellContent = cell.innerHTML.trim();
                    
                    // Special handling for actions column
                    if (header.toLowerCase().includes('actions') || 
                        header.toLowerCase().includes('action')) {
                        cardContent += `
                            <div class="flex justify-end space-x-2 pt-3 border-t mt-3">
                                ${cellContent}
                            </div>
                        `;
                    } else if (header.toLowerCase().includes('status')) {
                        cardContent += `
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">${header}:</span>
                                <span class="${cell.classList.toString()}">${cellContent}</span>
                            </div>
                        `;
                    } else if (header.toLowerCase().includes('amount') || 
                              header.toLowerCase().includes('price')) {
                        cardContent += `
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">${header}:</span>
                                <span class="font-bold">${cellContent}</span>
                            </div>
                        `;
                    } else {
                        cardContent += `
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">${header}:</span>
                                <span class="text-gray-800">${cellContent}</span>
                            </div>
                        `;
                    }
                });
                
                card.innerHTML = cardContent;
                cardsContainer.appendChild(card);
            });
            
            // Show cards, hide table
            table.classList.add('hidden');
            cardsContainer.classList.remove('hidden');
        }
        
        // Initial conversion
        convertToCards();
        
        // Store function for resize events
        container.convertToCards = convertToCards;
    });
}

function checkScreenSize() {
    const tableContainers = document.querySelectorAll('.table-container');
    
    tableContainers.forEach(container => {
        if (container.convertToCards) {
            container.convertToCards();
        }
    });
}

function setupTouchScrolling() {
    const tableWrappers = document.querySelectorAll('.table-wrapper');
    
    tableWrappers.forEach(wrapper => {
        // Only apply touch scrolling on desktop (table view)
        if (window.innerWidth <= 768) return;
        
        let isDragging = false;
        let startX, scrollLeft;
        
        wrapper.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
            wrapper.style.cursor = 'grabbing';
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
            wrapper.style.cursor = '';
        });
        
        wrapper.addEventListener('mouseleave', () => {
            isDragging = false;
            wrapper.style.cursor = '';
        });
    });
}

// Initialize responsive tables
window.ResponsiveTables = {
    refresh: function() {
        checkScreenSize();
    }
};
