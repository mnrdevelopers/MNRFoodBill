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
        cardsContainer.id = container.id ? container.id + '-cards' : 'cards-' + Date.now();
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
            
            // Store row data for event handling
            const rowsData = [];
            
            // Create cards from each row
            tbody.querySelectorAll('tr').forEach((row, rowIndex) => {
                const cells = row.querySelectorAll('td');
                if (cells.length === 0) return;
                
                const rowId = row.id || 'row-' + rowIndex;
                const card = document.createElement('div');
                card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-4';
                card.dataset.rowId = rowId;
                
                let cardContent = '';
                
                cells.forEach((cell, cellIndex) => {
                    if (cellIndex >= headers.length) return;
                    
                    const header = headers[cellIndex];
                    let cellContent = cell.innerHTML.trim();
                    
                    // Special handling for actions column
                    if (header.toLowerCase().includes('actions') || 
                        header.toLowerCase().includes('action')) {
                        
                        // Store button data for event delegation
                        const buttons = cell.querySelectorAll('button');
                        buttons.forEach((button, btnIndex) => {
                            const buttonType = button.classList.contains('view-order') ? 'view' :
                                             button.classList.contains('print-order') ? 'print' :
                                             button.classList.contains('delete-order') ? 'delete' :
                                             button.classList.contains('edit-product') ? 'edit' :
                                             button.classList.contains('delete-product') ? 'delete-product' : 'action';
                            
                            // Store row data
                            if (button.dataset.id) {
                                rowsData.push({
                                    rowId: rowId,
                                    dataId: button.dataset.id,
                                    buttonType: buttonType,
                                    originalIndex: rowIndex
                                });
                            }
                        });
                        
                        // Recreate buttons with proper attributes
                        const newButtons = cell.querySelectorAll('button');
                        let newButtonHTML = '';
                        
                        newButtons.forEach((button, btnIndex) => {
                            const buttonClass = button.className;
                            const buttonTitle = button.title || button.getAttribute('title') || '';
                            const icon = button.querySelector('i');
                            const iconClass = icon ? icon.className : '';
                            const dataId = button.dataset.id || '';
                            const buttonType = button.classList.contains('view-order') ? 'view' :
                                             button.classList.contains('print-order') ? 'print' :
                                             button.classList.contains('delete-order') ? 'delete' :
                                             button.classList.contains('edit-product') ? 'edit' :
                                             button.classList.contains('delete-product') ? 'delete-product' : 'action';
                            
                            // Create new button with data attributes
                            newButtonHTML += `
                                <button class="${buttonClass}" 
                                        data-row-id="${rowId}"
                                        data-button-type="${buttonType}"
                                        data-original-id="${dataId}"
                                        title="${buttonTitle}">
                                    <i class="${iconClass}"></i>
                                </button>
                            `;
                        });
                        
                        cardContent += `
                            <div class="flex justify-end space-x-2 pt-3 border-t mt-3">
                                ${newButtonHTML}
                            </div>
                        `;
                    } else if (header.toLowerCase().includes('status')) {
                        // Preserve status styling
                        const statusClass = cell.className;
                        cardContent += `
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-sm text-gray-500">${header}:</span>
                                <span class="${statusClass}">${cellContent}</span>
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
            
            // Store rows data for event handling
            cardsContainer.dataset.rowsData = JSON.stringify(rowsData);
            
            // Set up event delegation for action buttons
            setupCardEventDelegation(cardsContainer);
        }
        
        // Initial conversion
        convertToCards();
        
        // Store function for resize events
        container.convertToCards = convertToCards;
    });
}

function setupCardEventDelegation(cardsContainer) {
    // Event delegation for card buttons
    cardsContainer.addEventListener('click', function(e) {
        const button = e.target.closest('button');
        if (!button) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const buttonType = button.dataset.buttonType;
        const originalId = button.dataset.originalId;
        const rowId = button.dataset.rowId;
        
        console.log('Card button clicked:', { buttonType, originalId, rowId });
        
        // Try to parse rows data if available
        let rowsData = [];
        try {
            rowsData = JSON.parse(cardsContainer.dataset.rowsData || '[]');
        } catch (err) {
            console.error('Error parsing rows data:', err);
        }
        
        // Find the row data
        const rowData = rowsData.find(r => r.rowId === rowId && r.dataId === originalId);
        
        // Dispatch appropriate actions based on button type
        if (buttonType === 'view' && originalId) {
            // Handle view order
            if (typeof viewOrderDetails === 'function') {
                viewOrderDetails(originalId);
            } else if (window.viewOrderDetails) {
                window.viewOrderDetails(originalId);
            }
        } else if (buttonType === 'print' && originalId) {
            // Handle print order
            if (typeof printOrder === 'function') {
                printOrder(originalId);
            } else if (window.printOrder) {
                window.printOrder(originalId);
            }
        } else if (buttonType === 'delete' && originalId) {
            // Handle delete order
            if (typeof showDeleteOrderModal === 'function') {
                showDeleteOrderModal(originalId);
            } else if (window.showDeleteOrderModal) {
                window.showDeleteOrderModal(originalId);
            }
        } else if (buttonType === 'edit' && originalId) {
            // Handle edit product
            if (typeof editProduct === 'function') {
                editProduct(originalId);
            } else if (window.editProduct) {
                window.editProduct(originalId);
            }
        } else if (buttonType === 'delete-product' && originalId) {
            // Handle delete product
            if (typeof showDeleteModal === 'function') {
                showDeleteModal(originalId);
            } else if (window.showDeleteModal) {
                window.showDeleteModal(originalId);
            }
        }
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
        
        // Re-setup event delegation for all card containers
        document.querySelectorAll('.cards-container').forEach(cardsContainer => {
            setupCardEventDelegation(cardsContainer);
        });
    }
};

// Add global functions to handle actions from cards
window.handleCardAction = function(buttonType, dataId) {
    console.log('Global card action:', buttonType, dataId);
    
    switch(buttonType) {
        case 'view':
            if (typeof viewOrderDetails === 'function') viewOrderDetails(dataId);
            break;
        case 'print':
            if (typeof printOrder === 'function') printOrder(dataId);
            break;
        case 'delete':
            if (typeof showDeleteOrderModal === 'function') showDeleteOrderModal(dataId);
            break;
        case 'edit':
            if (typeof editProduct === 'function') editProduct(dataId);
            break;
        case 'delete-product':
            if (typeof showDeleteModal === 'function') showDeleteModal(dataId);
            break;
    }
};
