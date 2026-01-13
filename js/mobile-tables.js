// js/mobile-tables.js - Convert tables to mobile-friendly cards
document.addEventListener('DOMContentLoaded', function() {
    // Only run on mobile
    if (window.innerWidth <= 768) {
        convertTablesToCards();
    }
    
    // Add resize listener to handle orientation changes
    window.addEventListener('resize', function() {
        const isMobile = window.innerWidth <= 768;
        const hasMobileCards = document.querySelectorAll('.mobile-cards-container').length > 0;
        
        if (isMobile && !hasMobileCards) {
            convertTablesToCards();
        } else if (!isMobile && hasMobileCards) {
            restoreOriginalTables();
        }
    });
});

function convertTablesToCards() {
    // Process each table container on the page
    const tableContainers = document.querySelectorAll('.table-container');
    
    tableContainers.forEach(container => {
        // Skip if already converted
        if (container.dataset.converted === 'true') return;
        
        // Mark as converted
        container.dataset.converted = 'true';
        
        const table = container.querySelector('table');
        if (!table) return;
        
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        if (!thead || !tbody) return;
        
        // Get column headers
        const headers = Array.from(thead.querySelectorAll('th')).map(th => 
            th.textContent.trim()
        );
        
        // Create mobile cards container
        const mobileContainer = document.createElement('div');
        mobileContainer.className = 'mobile-cards-container';
        
        // Convert each row to a card
        const rows = tbody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            
            // Determine which type of table this is based on headers
            if (headers.includes('Staff Info')) {
                mobileContainer.appendChild(createStaffCard(headers, cells, row));
            } else if (headers.includes('Name') && headers.includes('Category')) {
                mobileContainer.appendChild(createProductCard(headers, cells, row));
            } else if (headers.includes('Order ID') || headers.includes('Customer')) {
                mobileContainer.appendChild(createOrderCard(headers, cells, row));
            } else {
                mobileContainer.appendChild(createGenericCard(headers, cells, row));
            }
        });
        
        // Add mobile container after the table
        container.parentNode.insertBefore(mobileContainer, container.nextSibling);
    });
}

function createOrderCard(headers, cells, originalRow) {
    const card = document.createElement('div');
    card.className = 'mobile-table-card';
    
    // Extract data
    const orderId = cells[0]?.textContent || 'N/A';
    const time = cells[1]?.textContent || 'N/A';
    const customer = cells[2]?.textContent || 'Guest';
    const items = cells[3]?.textContent || '0 items';
    const amount = cells[4]?.textContent || '₹0';
    const status = cells[5]?.textContent || 'pending';
    const actions = cells[6]?.innerHTML || '';
    
    // Create card HTML
    card.innerHTML = `
        <div class="mobile-card-header">
            <div class="mobile-card-title">${orderId}</div>
            <div class="mobile-status-badge status-${status.toLowerCase()}">${status}</div>
        </div>
        
        <div class="mobile-card-row">
            <div class="mobile-card-label">Time:</div>
            <div class="mobile-card-value">${time}</div>
        </div>
        
        <div class="mobile-card-row">
            <div class="mobile-card-label">Customer:</div>
            <div class="mobile-card-value">${customer}</div>
        </div>
        
        <div class="mobile-card-row">
            <div class="mobile-card-label">Items:</div>
            <div class="mobile-card-value">${items}</div>
        </div>
        
        <div class="mobile-card-row">
            <div class="mobile-card-label">Amount:</div>
            <div class="mobile-card-value">${amount}</div>
        </div>
        
        ${actions ? `
        <div class="mobile-card-actions">
            ${extractMobileActions(actions)}
        </div>
        ` : ''}
    `;
    
    return card;
}

function createProductCard(headers, cells, originalRow) {
    const card = document.createElement('div');
    card.className = 'mobile-product-card';
    
    const name = cells[0]?.textContent || 'Unnamed Product';
    const category = cells[1]?.textContent || 'Uncategorized';
    const price = cells[2]?.textContent || '₹0';
    const quantity = cells[3]?.textContent || 'N/A';
    const type = cells[4]?.textContent || 'N/A';
    const actions = cells[5]?.innerHTML || '';
    
    // Check for image in original row
    const image = originalRow.querySelector('img');
    const imgSrc = image ? image.src : '';
    
    card.innerHTML = `
        <div class="product-info-row">
            ${imgSrc ? `
            <img src="${imgSrc}" alt="${name}" class="product-image-small">
            ` : `
            <div class="staff-avatar">
                <i class="fas fa-hamburger"></i>
            </div>
            `}
            <div class="product-main-info">
                <div class="product-name">${name}</div>
                <div>
                    <span class="product-category">${category}</span>
                    <span class="food-type-indicator ${type.toLowerCase().includes('veg') ? 'veg' : 'nonveg'}">
                        ${type.toLowerCase().includes('veg') ? '🌱' : '🍗'} ${type}
                    </span>
                </div>
                <div class="product-price">${price}</div>
                <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">
                    Quantity: ${quantity}
                </div>
            </div>
        </div>
        
        ${actions ? `
        <div class="mobile-card-actions">
            ${extractMobileActions(actions)}
        </div>
        ` : ''}
    `;
    
    return card;
}

function createStaffCard(headers, cells, originalRow) {
    const card = document.createElement('div');
    card.className = 'mobile-staff-card';
    
    const staffInfo = cells[0]?.textContent || 'Unknown Staff';
    const status = cells[1]?.textContent || 'Active';
    const permissions = cells[2]?.textContent || 'No permissions';
    const actions = cells[3]?.innerHTML || '';
    
    card.innerHTML = `
        <div class="staff-info-row">
            <div class="staff-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #1f2937; margin-bottom: 0.25rem;">${staffInfo}</div>
                <div class="mobile-status-badge ${status === 'Active' ? 'status-completed' : 'status-cancelled'}">
                    ${status}
                </div>
            </div>
        </div>
        
        <div style="margin-bottom: 1rem;">
            <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">Permissions:</div>
            <div>
                ${permissions.split(',').map(perm => 
                    `<span class="permission-tag">${perm.trim()}</span>`
                ).join('')}
            </div>
        </div>
        
        ${actions ? `
        <div class="mobile-card-actions">
            ${extractMobileActions(actions)}
        </div>
        ` : ''}
    `;
    
    return card;
}

function createGenericCard(headers, cells, originalRow) {
    const card = document.createElement('div');
    card.className = 'mobile-table-card';
    
    let html = '';
    
    // Create a row for each header/cell pair
    headers.forEach((header, index) => {
        if (cells[index]) {
            const value = cells[index].textContent;
            if (value && value.trim() !== '') {
                html += `
                    <div class="mobile-card-row">
                        <div class="mobile-card-label">${header}:</div>
                        <div class="mobile-card-value">${value}</div>
                    </div>
                `;
            }
        }
    });
    
    // Check for actions in last cell
    const actions = cells[cells.length - 1]?.innerHTML || '';
    if (actions) {
        html += `
            <div class="mobile-card-actions">
                ${extractMobileActions(actions)}
            </div>
        `;
    }
    
    card.innerHTML = html;
    return card;
}

function extractMobileActions(actionsHtml) {
    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = actionsHtml;
    
    // Find all buttons and convert them to mobile-friendly versions
    const buttons = tempDiv.querySelectorAll('button, a[role="button"]');
    const mobileButtons = [];
    
    buttons.forEach(btn => {
        const text = btn.textContent.trim();
        const icon = btn.querySelector('i')?.className || '';
        const classes = btn.className;
        const onClick = btn.getAttribute('onclick') || '';
        const dataId = btn.getAttribute('data-id') || '';
        
        // Determine button type
        let btnType = 'secondary';
        if (classes.includes('bg-red') || classes.includes('bg-green')) {
            btnType = 'primary';
        }
        
        const mobileBtn = document.createElement('button');
        mobileBtn.className = `mobile-action-btn ${btnType}`;
        mobileBtn.innerHTML = icon ? `<i class="${icon}"></i> ${text}` : text;
        
        // Copy event handlers
        if (onClick) {
            mobileBtn.setAttribute('onclick', onClick);
        }
        if (dataId) {
            mobileBtn.setAttribute('data-id', dataId);
        }
        
        // Copy all data attributes
        Array.from(btn.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                mobileBtn.setAttribute(attr.name, attr.value);
            }
        });
        
        mobileButtons.push(mobileBtn.outerHTML);
    });
    
    return mobileButtons.join('');
}

function restoreOriginalTables() {
    // Remove mobile cards and show tables again
    document.querySelectorAll('.mobile-cards-container').forEach(container => {
        container.remove();
    });
    
    // Reset conversion markers
    document.querySelectorAll('.table-container[data-converted="true"]').forEach(container => {
        container.dataset.converted = 'false';
    });
}

// Export for manual control
window.MobileTables = {
    convert: convertTablesToCards,
    restore: restoreOriginalTables,
    refresh: function() {
        restoreOriginalTables();
        convertTablesToCards();
    }
};

// Add view toggle functionality for users who want to switch between views
function addViewToggle() {
    if (window.innerWidth > 768) return;
    
    const tableSections = document.querySelectorAll('.bg-white.rounded-xl.shadow.overflow-hidden, .bg-white.rounded-xl.shadow-sm');
    
    tableSections.forEach(section => {
        const existingToggle = section.querySelector('.view-toggle-container');
        if (existingToggle) return;
        
        const header = section.querySelector('h1, h2, h3, h4, h5, h6');
        if (!header) return;
        
        const toggleContainer = document.createElement('div');
        toggleContainer.className = 'view-toggle-container';
        toggleContainer.innerHTML = `
            <button class="view-toggle-btn active" data-view="cards">
                <i class="fas fa-th-large"></i> Cards
            </button>
            <button class="view-toggle-btn" data-view="table">
                <i class="fas fa-table"></i> Table
            </button>
        `;
        
        header.parentNode.insertBefore(toggleContainer, header.nextSibling);
        
        // Add toggle functionality
        toggleContainer.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const view = this.dataset.view;
                
                // Update active state
                toggleContainer.querySelectorAll('.view-toggle-btn').forEach(b => {
                    b.classList.remove('active');
                });
                this.classList.add('active');
                
                // Toggle views
                const tableContainer = section.querySelector('.table-container');
                const mobileContainer = section.querySelector('.mobile-cards-container');
                
                if (view === 'table') {
                    if (tableContainer) tableContainer.style.display = 'block';
                    if (mobileContainer) mobileContainer.style.display = 'none';
                } else {
                    if (tableContainer) tableContainer.style.display = 'none';
                    if (mobileContainer) mobileContainer.style.display = 'block';
                }
            });
        });
    });
}

// Initialize view toggle after a delay to ensure tables are loaded
setTimeout(addViewToggle, 1000);
