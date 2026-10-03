// Authentication check for all pages
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const loginTime = localStorage.getItem('loginTime');

    // Check if user is authenticated and session is valid (24 hours)
    if (!isAuthenticated || isAuthenticated !== 'true') {
        redirectToLogin();
        return false;
    }

    // Optional: Check if login session is still valid (24 hours)
    if (loginTime) {
        const loginDate = new Date(loginTime);
        const currentDate = new Date();
        const hoursDiff = (currentDate - loginDate) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            // Session expired
            localStorage.clear();
            redirectToLogin();
            return false;
        }
    }

    return true;
}

function redirectToLogin() {
    window.location.href='login.html';
}

function logout() {
    localStorage.clear();
    redirectToLogin();
}


document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) {
        return;
    }

    try {
        // REMOVED: showLoading('Loading Customer Details', 'Initializing database and loading customer data...');

        // Setup event listeners first
        setupEventListeners();

        // Check if required DOM elements exist
        const requiredElements = [
            'customerTableBody', 'noCustomers'
        ];

        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            console.error('Missing required DOM elements:', missingElements);
            throw new Error(`Missing required page elements: ${missingElements.join(', ')}`);
        }

        // Show skeleton loading for immediate feedback
        showStatsSkeleton();
        showTableSkeleton();

        // Initialize database
        await db.init();

        // Load all customers
        await loadAllCustomers();

        // REMOVED: hideLoading();

    } catch (error) {
        // REMOVED: hideLoading();
        hideStatsSkeleton(); // Ensure skeleton is hidden on error
        console.error('Error during customer details page initialization:', error);
        showErrorState('Failed to load customer data: ' + error.message);
    }
});


async function loadAllCustomers() {
    try {
        // ADDED: Show skeleton loaders before fetching/processing
        showStatsSkeleton();
        showTableSkeleton();

        // REMOVED: showLoading('Loading Customers', 'Processing customer data and calculating statistics...');

        const invoices = await db.getAllInvoices();
        const customers = await processCustomerData(invoices);

        // Check if we have valid data
        if (!customers || !Array.isArray(customers)) {
            throw new Error('Invalid customer data received');
        }

        console.log('✅ Customer data processed, updating statistics...');
        
        // Update statistics (this will hide the stats skeleton inside)
        updateStatistics(customers);
        
        // Display customers (this overwrites the table skeleton)
        displayCustomers(customers);

        // REMOVED: hideLoading();
        console.log('✅ All customer data loaded successfully');

    } catch (error) {
        // REMOVED: hideLoading();
        hideStatsSkeleton(); // Ensure stats skeleton is hidden on error
        console.error('Error loading customers:', error);
        showErrorState('Error loading customer data: ' + error.message);
    }
}




// Add event listeners - FIXED naming conflict
function setupEventListeners() {
    // Add event listeners if elements exist
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearch'); // Renamed variable
    const refreshBtn = document.getElementById('refreshBtn');
    const exportBtn = document.getElementById('exportBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const customerSearch = document.getElementById('customerSearch');

    if (searchBtn) {
        searchBtn.addEventListener('click', searchCustomers);
    }

    if (clearSearchBtn) { // Use the renamed variable
        clearSearchBtn.addEventListener('click', clearSearch); // This now calls the function
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAllCustomers);
    }

    if (exportBtn) {
        // Changed to use the advanced export options by default for better UX
        exportBtn.addEventListener('click', exportCustomersWithOptions);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Search on Enter key
    if (customerSearch) {
        customerSearch.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                searchCustomers();
            }
        });
    }

    // Close invoice number lists when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.invoice-numbers')) {
            document.querySelectorAll('.invoice-numbers-list.show').forEach(list => {
                list.classList.remove('show');
            });
        }
    });
}

function toggleInvoiceList(element, event) {
    event.stopPropagation();
    const list = element.nextElementSibling;
    if (list && list.classList.contains('invoice-numbers-list')) {
        // Toggle this list
        list.classList.toggle('show');
    }
}

function makeDraggable(element) {
    const header = element.querySelector('.popup-header');
    if (!header) return;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        if (e.target.classList.contains('popup-close')) return; // Ignore close button
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}


// Process invoice data to get customer summaries - ENHANCED error handling
async function processCustomerData(invoices) {
    try {
        // REMOVED: showLoading('Processing Data', 'Analyzing invoices and calculating returns...');

        // Validate input
        if (!invoices || !Array.isArray(invoices)) {
            console.warn('No invoices found or invalid data format');
            return [];
        }

        const customerMap = new Map();

        // Process invoices with error handling
        invoices.forEach(invoice => {
            try {
                // Skip invalid invoices
                if (!invoice || !invoice.customerName) {
                    console.warn('Skipping invalid invoice:', invoice);
                    return;
                }

                const customerName = invoice.customerName;

                if (!customerMap.has(customerName)) {
                    customerMap.set(customerName, {
                        name: customerName,
                        phone: invoice.customerPhone || '',
                        address: invoice.customerAddress || '',
                        totalInvoices: 0,
                        totalCurrentBillAmount: 0,
                        totalAmount: 0,
                        amountPaid: 0,
                        balanceDue: 0,
                        totalReturns: 0,
                        totalDiscountAmount: 0,
                        adjustedBalanceDue: 0,
                        allInvoiceNumbers: [],
                        invoices: []
                    });
                }

                const customer = customerMap.get(customerName);
                customer.totalInvoices++;
                customer.totalCurrentBillAmount += parseFloat(invoice.subtotal) || 0;
                customer.totalAmount += parseFloat(invoice.grandTotal) || 0;
                customer.amountPaid += parseFloat(invoice.amountPaid) || 0;
                customer.totalDiscountAmount += parseFloat(invoice.discountAmount) || 0;

                // Store invoice number and invoice data
                if (invoice.invoiceNo) {
                    customer.allInvoiceNumbers.push(invoice.invoiceNo);
                }
                customer.invoices.push(invoice);

                // Update last invoice info
                if (invoice.invoiceDate) {
                    const invoiceDate = new Date(invoice.invoiceDate);
                    if (!customer.lastInvoiceDate || invoiceDate > new Date(customer.lastInvoiceDate)) {
                        customer.lastInvoiceDate = invoice.invoiceDate;
                        customer.lastInvoiceNo = invoice.invoiceNo;
                    }
                }
            } catch (invoiceError) {
                console.error('Error processing invoice:', invoiceError, invoice);
            }
        });

        // After processing all invoices, calculate returns and adjusted balances
        const customers = Array.from(customerMap.values());

        // OPTIMIZATION: Fetch all returns once instead of per invoice
        const allReturns = await db.getAllReturns();
        const returnsByInvoice = {};
        allReturns.forEach(r => {
            if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
            returnsByInvoice[r.invoiceNo].push(r);
        });

        // Calculate returns for each customer
        for (let customer of customers) {
            try {
                // Sort invoices by invoice number (newest first)
                customer.invoices.sort((a, b) => {
                    const numA = parseInt(a.invoiceNo) || 0;
                    const numB = parseInt(b.invoiceNo) || 0;
                    return numB - numA;
                });

                // Calculate total returns for this customer
                customer.totalReturns = 0;
                try {
                    for (let invoice of customer.invoices) {
                        if (invoice.invoiceNo) {
                            const returns = returnsByInvoice[invoice.invoiceNo] || [];
                            const invoiceReturns = returns.reduce((sum, returnItem) => sum + (parseFloat(returnItem.returnAmount) || 0), 0);
                            customer.totalReturns += invoiceReturns;
                        }
                    }
                } catch (returnsError) {
                    console.error('Error calculating returns for customer:', customer.name, returnsError);
                    customer.totalReturns = 0;
                }

                // Set balance due to the most recent invoice's balance due
                if (customer.invoices.length > 0) {
                    customer.balanceDue = parseFloat(customer.invoices[0].balanceDue) || 0;
                    customer.adjustedBalanceDue = customer.balanceDue - customer.totalReturns;
                }

                // Sort invoice numbers in descending order (newest first)
                customer.allInvoiceNumbers.sort((a, b) => {
                    const numA = parseInt(a) || 0;
                    const numB = parseInt(b) || 0;
                    return numB - numA;
                });

                // Remove the invoices array as we don't need it anymore
                delete customer.invoices;
            } catch (customerError) {
                console.error('Error processing customer:', customer.name, customerError);
            }
        }

        return customers;

    } catch (error) {
        console.error('Error in processCustomerData:', error);
        return [];
    }
}


// Update statistics cards with robust error handling
function updateStatistics(customers) {
    console.log('🔄 Starting statistics update...');
    
    // Get all DOM elements first with null checks
    const totalCustomersEl = document.getElementById('totalCustomers');
    const totalInvoicesEl = document.getElementById('totalInvoices');
    const totalRevenueEl = document.getElementById('totalRevenue');
    const totalPaidEl = document.getElementById('totalPaid');
    const totalDiscountEl = document.getElementById('totalDiscount');
    const pendingBalanceEl = document.getElementById('pendingBalance');

    // Debug: Check what elements we found
    console.log('🔍 Statistics elements found:', {
        totalCustomers: !!totalCustomersEl,
        totalInvoices: !!totalInvoicesEl,
        totalRevenue: !!totalRevenueEl,
        totalPaid: !!totalPaidEl,
        pendingBalance: !!pendingBalanceEl
    });

    // We rely on the skeleton cleanup to restore structure if needed, 
    // so we just check for null elements before updating them.
    if (!totalCustomersEl || !totalInvoicesEl || !totalRevenueEl || !totalPaidEl || !pendingBalanceEl) {
        console.error('❌ Missing required statistics elements, skipping update.');
        hideStatsSkeleton(); // Important: ensure skeleton state is removed if data update fails
        return;
    }

    // Calculate statistics
    const totalCustomers = customers.length;
    const totalInvoices = customers.reduce((sum, customer) => sum + customer.totalInvoices, 0);
    const totalCurrentBillAmount = customers.reduce((sum, customer) => sum + customer.totalCurrentBillAmount, 0);
    const totalPaid = customers.reduce((sum, customer) => sum + customer.amountPaid, 0);
    const totalReturns = customers.reduce((sum, customer) => sum + customer.totalReturns, 0);
    const totalDiscountAmount = customers.reduce((sum, customer) => sum + customer.totalDiscountAmount, 0);
    const pendingBalance = totalCurrentBillAmount - totalPaid - totalReturns - totalDiscountAmount;

    console.log('📈 Calculated statistics:', {
        totalCustomers,
        totalInvoices,
        totalCurrentBillAmount,
        totalPaid,
        totalReturns,
        totalDiscountAmount,
        pendingBalance
    });

    // Update the values
    totalCustomersEl.textContent = totalCustomers.toLocaleString();
    totalInvoicesEl.textContent = totalInvoices.toLocaleString();
    totalRevenueEl.textContent = `₹${Utils.formatCurrency(totalCurrentBillAmount)}`;
    totalPaidEl.textContent = `₹${Utils.formatCurrency(totalPaid)}`;
    if(totalDiscountEl) totalDiscountEl.textContent = `₹${Utils.formatCurrency(totalDiscountAmount)}`;
    pendingBalanceEl.textContent = `₹${Utils.formatCurrency(pendingBalance)}`;

    // Helper to add the text subtitle (like 1.15 Cr)
    const addTextSubtitle = (el, amount) => {
        const pTag = el.nextElementSibling;
        if (pTag && pTag.tagName === 'P') {
            let span = pTag.querySelector('.amount-text-subtitle');
            const textVal = Utils.formatAmountToText(amount);
            if (textVal) {
                if (!span) {
                    span = document.createElement('span');
                    span.className = 'amount-text-subtitle';
                    span.style.fontSize = '0.75rem';
                    span.style.fontWeight = 'bold';
                    span.style.marginLeft = '5px';
                    span.style.color = 'var(--primary-color)';
                    pTag.appendChild(span);
                }
                span.textContent = `(${textVal})`;
            } else if (span) {
                span.remove();
            }
        }
    };

    addTextSubtitle(totalRevenueEl, totalCurrentBillAmount);
    addTextSubtitle(totalPaidEl, totalPaid);
    addTextSubtitle(pendingBalanceEl, pendingBalance);

    // Handle returns statistics
    handleReturnsStatistics(totalReturns);

    // Apply color coding
    applyStatisticsColorCoding(pendingBalance);
    
    // Hide skeleton effect
    hideStatsSkeleton();

    console.log('✅ Statistics updated successfully');
}

// Handle returns statistics
function handleReturnsStatistics(totalReturns) {
    if (totalReturns > 0) {
        let returnsCard = document.getElementById('totalReturns');
        const textVal = Utils.formatAmountToText(totalReturns);
        const subtitleHTML = textVal ? `<span class="amount-text-subtitle" style="font-size: 0.75rem; font-weight: bold; margin-left: 5px; color: var(--primary-color);">(${textVal})</span>` : '';
        
        if (!returnsCard) {
            const statsContainer = document.querySelector('.stats-cards');
            if (statsContainer) {
                const returnsHTML = `
                    <div class="stat-card" id="totalReturns">
                        <div class="stat-icon">
                            <i class="fas fa-undo"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="totalReturnsValue">-₹${Utils.formatCurrency(totalReturns)}</h3>
                            <p>Total Returns ${subtitleHTML}</p>
                        </div>
                    </div>
                `;
                const pendingBalanceCard = document.querySelector('.stat-card:last-child');
                if (pendingBalanceCard) {
                    pendingBalanceCard.insertAdjacentHTML('beforebegin', returnsHTML);
                }
            }
        } else {
            const totalReturnsValueEl = document.getElementById('totalReturnsValue');
            if (totalReturnsValueEl) {
                totalReturnsValueEl.textContent = `-₹${Utils.formatCurrency(totalReturns)}`;
                const pTag = totalReturnsValueEl.nextElementSibling;
                if (pTag && pTag.tagName === 'P') {
                    let span = pTag.querySelector('.amount-text-subtitle');
                    if (textVal) {
                        if (!span) {
                            span = document.createElement('span');
                            span.className = 'amount-text-subtitle';
                            span.style.fontSize = '0.75rem';
                            span.style.fontWeight = 'bold';
                            span.style.marginLeft = '5px';
                            span.style.color = 'var(--primary-color)';
                            pTag.appendChild(span);
                        }
                        span.textContent = `(${textVal})`;
                    } else if (span) {
                        span.remove();
                    }
                }
            }
        }
    } else {
        const returnsCard = document.getElementById('totalReturns');
        if (returnsCard) {
            returnsCard.remove();
        }
    }
}

// Apply color coding to statistics
function applyStatisticsColorCoding(pendingBalance) {
    const statsCards = document.querySelectorAll('.stat-card');
    
    statsCards.forEach((card, index) => {
        card.classList.remove('positive-value', 'negative-value', 'neutral-value');
        
        if (card.id === 'totalReturns') {
            card.classList.add('negative-value');
        } else if (card.id === 'pendingBalance') {
            if (pendingBalance > 0) {
                card.classList.add('negative-value');
            } else if (pendingBalance < 0) {
                card.classList.add('positive-value');
            } else {
                card.classList.add('neutral-value');
            }
        } else {
            card.classList.add('positive-value');
        }
    });
}




// Update the displayCustomers function with null checks and FIXED this reference
function displayCustomers(customers) {
    const tableBody = document.getElementById('customerTableBody');
    const noCustomers = document.getElementById('noCustomers');

    // Check if required elements exist
    if (!tableBody || !noCustomers) {
        console.error('Required table elements not found in DOM');
        return;
    }

    if (customers.length === 0) {
        tableBody.innerHTML = '';
        noCustomers.style.display = 'block';
        return;
    }

    noCustomers.style.display = 'none';

    tableBody.innerHTML = customers.map((customer, index) => {
        const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns - customer.totalDiscountAmount;

        // Only show WhatsApp button if customer has balance and phone number
        const showWhatsApp = customerBalance > 0 && customer.phone;

        // Format phone number to show only last 3 digits
        const formattedPhone = customer.phone ? formatPhoneNumber(customer.phone) : 'N/A';
        const safeId = customer.phone ? customer.phone.replace(/[^a-zA-Z0-9]/g, '') : 'unknown_' + index;

        return `
        <tr>
            <td>
                <div class="customer-name" id="display-name-${safeId}">
                    <i class="fas fa-user"></i>
                    ${escapeHtml(customer.name)}
                    ${customer.totalReturns > 0 ? `<span class="customer-return-badge" title="This customer has returns">🔄</span>` : ''}
                </div>
                <div class="edit-mode" id="edit-name-container-${safeId}" style="display:none;">
                    <input type="text" id="edit-name-${safeId}" value="${escapeHtml(customer.name)}" class="edit-input" style="width: 100%; padding: 4px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            </td>
            <td class="phone-number" title="Click to reveal full number" onclick="if(!document.getElementById('edit-phone-container-${safeId}').style.display || document.getElementById('edit-phone-container-${safeId}').style.display === 'none') togglePhoneNumber(document.getElementById('display-phone-${safeId}'), '${customer.phone || ''}')">
                <span id="display-phone-${safeId}">${escapeHtml(formattedPhone)}</span>
                <div class="edit-mode" id="edit-phone-container-${safeId}" style="display:none;">
                    <input type="text" id="edit-phone-${safeId}" value="${escapeHtml(customer.phone)}" class="edit-input" style="width: 100px; padding: 4px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            </td>
            <td title="${escapeHtml(customer.address || 'N/A')}">
                <span id="display-address-${safeId}">${customer.address ? (customer.address.length > 30 ? escapeHtml(customer.address.substring(0, 30)) + '...' : escapeHtml(customer.address)) : 'N/A'}</span>
                <div class="edit-mode" id="edit-address-container-${safeId}" style="display:none;">
                    <input type="text" id="edit-address-${safeId}" value="${escapeHtml(customer.address)}" class="edit-input" style="width: 100%; padding: 4px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;">
                </div>
            </td>
            <td>${customer.totalInvoices}</td>
            <td class="amount-positive">₹${Utils.formatCurrency(customer.totalCurrentBillAmount)}</td>
            <td class="amount-positive">₹${Utils.formatCurrency(customer.amountPaid)}</td>
            <td class="amount-negative">₹${Utils.formatCurrency(customer.totalDiscountAmount)}</td>
            <td class="${customer.totalReturns > 0 ? 'amount-negative' : 'amount-neutral'}">
                ${customer.totalReturns > 0 ? `₹${Utils.formatCurrency(customer.totalReturns)}` : '₹0.00'}
            </td>
            <td class="${customerBalance > 0 ? 'amount-negative' : (customerBalance < 0 ? 'amount-positive' : 'amount-neutral')}">
                ₹${Utils.formatCurrency(customerBalance)}
            </td>
            <td>
                ${showWhatsApp ? `
                <button class="whatsapp-reminder-btn" onclick="openReminderModal(${JSON.stringify(customer).replace(/"/g, '&quot;')})">
                    <i class="fab fa-whatsapp"></i> Send Reminder
                </button>
                ` : '<span class="no-reminder">No balance/phone</span>'}
            </td>
        </tr>
    `}).join('');
}

// Add escapeHtml function to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Search customers - UPDATED with skeleton loading
async function searchCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.trim().toLowerCase();

    // Show skeleton loaders before starting search
    showStatsSkeleton();
    showTableSkeleton();

    if (!searchTerm) {
        await loadAllCustomers();
        return;
    }

    try {
        // REMOVED: showLoading('Searching Customers', `Searching for "${searchTerm}"...`);

        const invoices = await db.getAllInvoices();
        let customers = await processCustomerData(invoices);

        // Filter customers based on search term
        customers = customers.filter(customer =>
            customer.name.toLowerCase().includes(searchTerm) ||
            (customer.phone && customer.phone.includes(searchTerm)) ||
            (customer.address && customer.address.toLowerCase().includes(searchTerm)) ||
            customer.allInvoiceNumbers.some(invoiceNo => invoiceNo.toLowerCase().includes(searchTerm))
        );

        updateStatistics(customers);
        displayCustomers(customers);

        // REMOVED: hideLoading();

    } catch (error) {
        // REMOVED: hideLoading();
        hideStatsSkeleton();
        console.error('Error searching customers:', error);
        Utils.showToast('Error', 'Error searching customers.', 'error');
    }
}


// Clear search
function clearSearch() {
    document.getElementById('customerSearch').value = '';
    loadAllCustomers();
}



// Add this utility function to format phone numbers
function formatPhoneNumber(phone) {
    if (!phone) return 'N/A';

    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');

    if (cleanPhone.length <= 3) {
        return cleanPhone;
    }

    // Show last 3 digits, mask the rest with asterisks
    const visibleDigits = 3;
    const maskedPart = '*'.repeat(cleanPhone.length - visibleDigits);
    const visiblePart = cleanPhone.slice(-visibleDigits);

    return maskedPart + visiblePart;
}

// Add function to toggle phone number visibility
function togglePhoneNumber(element, fullPhoneNumber) {
    if (!fullPhoneNumber || fullPhoneNumber === 'N/A') return;

    const currentText = element.textContent;
    const cleanFullPhone = fullPhoneNumber.replace(/\D/g, '');

    // If currently showing masked version, show full number
    if (currentText.includes('*')) {
        element.textContent = cleanFullPhone;
        element.classList.add('phone-revealed');

        // Auto hide after 5 seconds
        setTimeout(() => {
            if (element.classList.contains('phone-revealed')) {
                element.textContent = formatPhoneNumber(fullPhoneNumber);
                element.classList.remove('phone-revealed');
            }
        }, 5000);
    } else {
        // If showing full number, mask it
        element.textContent = formatPhoneNumber(fullPhoneNumber);
        element.classList.remove('phone-revealed');
    }
}


// Add function for toggling phone in popup
function togglePopupPhone(element, fullPhoneNumber) {
    const currentText = element.textContent.replace('📞 ', '');
    const cleanFullPhone = fullPhoneNumber.replace(/\D/g, '');

    if (currentText.includes('*')) {
        element.textContent = '📞 ' + cleanFullPhone;
        element.classList.add('phone-revealed');
    } else {
        element.textContent = '📞 ' + formatPhoneNumber(fullPhoneNumber);
        element.classList.remove('phone-revealed');
    }
}


// View specific invoice - redirect to invoice-history page with search filter
function viewInvoice(invoiceNo) {
    // Redirect to invoice-history page with the invoice number as search parameter
    window.location.href = `invoice-history?search=${invoiceNo}`;
}

// Show invoice details popup on click - UPDATED with multiple draggable popups
async function showInvoicePopup(invoiceNo, event) {
    event.stopPropagation();
    try {
        // Create unique ID for the popup
        const popupId = 'popup-' + invoiceNo + '-' + Date.now();
        
        // Calculate position based on mouse click event
        let posX = event.clientX + 10;
        let posY = event.clientY + 10;
        
        // Ensure it doesn't go off-screen
        if (posX + 320 > window.innerWidth) posX = window.innerWidth - 320;
        if (posY + 400 > window.innerHeight) posY = window.innerHeight - 400;

        const popup = document.createElement('div');
        popup.className = 'invoice-popup loading';
        popup.id = popupId;
        popup.style.position = 'fixed';
        popup.style.left = posX + 'px';
        popup.style.top = posY + 'px';
        popup.style.zIndex = '1000';
        
        // Bring to front on click
        popup.addEventListener('mousedown', () => {
            const allPopups = document.querySelectorAll('.invoice-popup');
            let maxZ = 1000;
            allPopups.forEach(p => {
                const z = parseInt(window.getComputedStyle(p).zIndex) || 1000;
                if (z > maxZ) maxZ = z;
            });
            popup.style.zIndex = maxZ + 1;
        });

        popup.innerHTML = `
            <div class="invoice-popup-content">
                <div class="popup-header" style="cursor: move;">
                    <h4>Loading Invoice #${invoiceNo}</h4>
                    <button class="popup-close" onclick="this.closest('.invoice-popup').remove()">&times;</button>
                </div>
                <div class="popup-body">
                    <div class="loading-spinner-mini"></div>
                    <p>Loading invoice details...</p>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        makeDraggable(popup);

        const invoiceData = await db.getInvoice(invoiceNo);
        if (!invoiceData) {
            popup.remove();
            return;
        }

        // Calculate previous balance and returns
        const previousBalance = (invoiceData.previousBalance || 0) + (invoiceData.manualPreviousBalance || 0);
        const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;

        // Format phone number for display
        const formattedPhone = invoiceData.customerPhone ? formatPhoneNumber(invoiceData.customerPhone) : 'N/A';

        // Update popup with actual data
        popup.className = 'invoice-popup'; // remove loading class
        popup.innerHTML = `
            <div class="invoice-popup-content">
                <div class="popup-header" style="cursor: move;">
                    <h4>Invoice #${invoiceData.invoiceNo}</h4>
                    <button class="popup-close" onclick="this.closest('.invoice-popup').remove()">&times;</button>
                </div>
                <div class="popup-body">
                    <div class="customer-info">
                        <strong>${invoiceData.customerName}</strong>
                        <div class="customer-details">
                            ${invoiceData.customerPhone ? `
                                <div class="phone-display" onclick="togglePopupPhone(this, '${invoiceData.customerPhone}')">
                                    📞 ${formattedPhone}
                                </div>
                            ` : ''}
                            ${invoiceData.customerAddress ? `<div>📍 ${invoiceData.customerAddress}</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="invoice-details">
                        <div class="detail-row">
                            <span>Date:</span>
                            <span>${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</span>
                        </div>
                        <div class="detail-row">
                            <span>Current Bill:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.subtotal)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Previous Balance:</span>
                            <span>₹${Utils.formatCurrency(previousBalance)}</span>
                        </div>
                        ${invoiceData.discountAmount ? `
                        <div class="detail-row">
                            <span>Discount Amount:</span>
                            <span>-₹${Utils.formatCurrency(invoiceData.discountAmount)}</span>
                        </div>
                        ` : ''}
                        <div class="detail-row">
                            <span>Total Amount:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.grandTotal)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Amount Paid:</span>
                            <span class="amount-paid">₹${Utils.formatCurrency(invoiceData.amountPaid)}</span>
                        </div>
                        ${totalReturns > 0 ? `
                        <div class="detail-row">
                            <span>Return Amount:</span>
                            <span class="amount-return">-₹${Utils.formatCurrency(totalReturns)}</span>
                        </div>
                        ` : ''}
                        <div class="detail-row">
                            <span>${totalReturns > 0 ? 'Adjusted Balance Due:' : 'Balance Due:'}</span>
                            <span class="${adjustedBalanceDue > 0 ? 'amount-due' : 'amount-paid'}">
                                ₹${Utils.formatCurrency(totalReturns > 0 ? adjustedBalanceDue : invoiceData.balanceDue)}
                            </span>
                        </div>
                        ${invoiceData.paymentMethod ? `
                        <div class="detail-row">
                            <span>Payment Method:</span>
                            <span class="payment-method ${invoiceData.paymentMethod}">
                                ${invoiceData.paymentMethod.toUpperCase()}
                            </span>
                        </div>
                        ` : ''}
                    </div>

                    ${invoiceData.products && invoiceData.products.length > 0 ? `
                    <div class="products-preview">
                        <strong>Products (${invoiceData.products.length}):</strong>
                        <div class="products-list">
                            ${invoiceData.products.slice(0, 3).map(product => `
                                <div class="product-item">
                                    <span class="product-desc">${product.description}</span>
                                    <span class="product-qty">${product.qty} × ₹${Utils.formatCurrency(product.rate)}</span>
                                </div>
                            `).join('')}
                            ${invoiceData.products.length > 3 ?
                        `<div class="more-products">+ ${invoiceData.products.length - 3} more items</div>` : ''}
                        </div>
                    </div>
                    ` : ''}

                    ${totalReturns > 0 ? `
                    <div class="returns-preview">
                        <strong>Returns Processed: ₹${Utils.formatCurrency(totalReturns)}</strong>
                        <button class="btn-view-returns" onclick="viewReturnStatus('${invoiceNo}')">
                            <i class="fas fa-history"></i> View Return Details
                        </button>
                    </div>
                    ` : ''}
                </div>
                <div class="popup-actions">
                    <button class="btn-view-full" onclick="viewInvoice('${invoiceData.invoiceNo}')">
                        <i class="fas fa-external-link-alt"></i> View on Invoice Page
                    </button>
                    <button class="btn-share" onclick="shareInvoiceViaWhatsApp('${invoiceData.invoiceNo}')">
                        <i class="fab fa-whatsapp"></i> Share
                    </button>
                    ${totalReturns === 0 ? `
                    <button class="btn-return" onclick="addReturn('${invoiceData.invoiceNo}')">
                        <i class="fas fa-undo"></i> Process Return
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Re-apply draggable since innerHTML recreated the header
        makeDraggable(popup);

    } catch (error) {
        console.error('Error loading invoice details:', error);
    }
}

// Close all invoice popups (legacy function, now only used manually if needed)
function closeInvoicePopup() {
    const popups = document.querySelectorAll('.invoice-popup');
    popups.forEach(p => p.remove());
}




// Export customers to CSV - REMOVED, relying on advanced export
async function exportCustomers() {
    // Redirect to advanced export for consistency
    exportCustomersWithOptions();
}




// Show export success message
function showExportSuccess(customerCount) {
    // Create success notification
    const notification = document.createElement('div');
    notification.className = 'export-notification success';
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-check-circle"></i>
            <div class="notification-text">
                <strong>Export Successful!</strong>
                <p>Exported ${customerCount} customers to CSV file</p>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Enhanced Export with Options - UPDATED with loading
async function exportCustomersWithOptions() {
    try {
        showLoading('Loading Export Options', 'Preparing customer data for export...');

        const invoices = await db.getAllInvoices();
        const customers = await processCustomerData(invoices);

        if (customers.length === 0) {
            hideLoading();
            Utils.showToast('Notification', 'No customer data to export.', 'info');
            return;
        }

        hideLoading();
        showExportOptionsModal(customers);

    } catch (error) {
        hideLoading();
        console.error('Error exporting customers:', error);
        Utils.showToast('Error', 'Error exporting customer data. Please try again.', 'error');
    }
}

// Show export options modal
function showExportOptionsModal(customers) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="export-modal">
            <div class="modal-header">
                <h3><i class="fas fa-download"></i> Export Customer Data</h3>
                <button class="close-modal">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="export-options">
                    <div class="option-group">
                        <label>Export Format:</label>
                        <select id="exportFormat" class="export-select">
                            <option value="csv">CSV (Excel)</option>
                            <option value="json">JSON</option>
                        </select>
                    </div>
                    
                    <div class="option-group">
                        <label>Include Columns:</label>
                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="phone" checked> Phone Numbers
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="address" checked> Address
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="invoices" checked> Invoice Details
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="exportColumns" value="returns" checked> Return Information
                            </label>
                        </div>
                    </div>
                    
                    <div class="export-preview">
                        <label>Data Summary:</label>
                        <div class="preview-stats">
                            <div class="stat"><strong>${customers.length}</strong> Customers</div>
                            <div class="stat"><strong>${customers.reduce((sum, c) => sum + c.totalInvoices, 0)}</strong> Total Invoices</div>
                            <div class="stat"><strong>₹${Utils.formatCurrency(customers.reduce((sum, c) => sum + c.totalCurrentBillAmount, 0))}</strong> Total Amount</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" id="cancelExport">Cancel</button>
                <button class="btn-primary" id="confirmExport">
                    <i class="fas fa-download"></i> Export Data
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners for export modal
    const closeBtn = modal.querySelector('.close-modal');
    const cancelBtn = modal.querySelector('#cancelExport');
    const confirmBtn = modal.querySelector('#confirmExport');

    closeBtn.addEventListener('click', () => modal.remove());
    cancelBtn.addEventListener('click', () => modal.remove());

    confirmBtn.addEventListener('click', () => {
        const format = modal.querySelector('#exportFormat').value;
        const selectedColumns = Array.from(modal.querySelectorAll('input[name="exportColumns"]:checked'))
            .map(input => input.value);

        modal.remove();
        performExport(customers, format, selectedColumns);
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Perform the actual export based on options
function performExport(customers, format, columns) {
    let content, mimeType, fileExtension;

    if (format === 'csv') {
        // Generate CSV based on selected columns
        let csvContent = 'Customer Name';

        if (columns.includes('phone')) csvContent += ',Phone';
        if (columns.includes('address')) csvContent += ',Address';
        csvContent += ',Total Invoices,Total Amount,Amount Paid';
        if (columns.includes('returns')) csvContent += ',Returns';
        csvContent += ',Balance Due,Last Invoice,Last Invoice Date\n';

        customers.forEach(customer => {
            const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns - customer.totalDiscountAmount;

            let row = [`"${customer.name.replace(/"/g, '""')}"`];

            if (columns.includes('phone')) row.push(`"${customer.phone || 'N/A'}"`);
            if (columns.includes('address')) row.push(`"${(customer.address || 'N/A').replace(/"/g, '""')}"`);

            row.push(
                customer.totalInvoices,
                customer.totalCurrentBillAmount,
                customer.amountPaid
            );

            if (columns.includes('returns')) row.push(customer.totalReturns);

            row.push(
                customerBalance,
                customer.lastInvoiceNo || 'N/A',
                customer.lastInvoiceDate ? new Date(customer.lastInvoiceDate).toLocaleDateString('en-IN') : 'N/A'
            );

            csvContent += row.join(',') + '\n';
        });

        content = csvContent;
        mimeType = 'text/csv;charset=utf-8;';
        fileExtension = 'csv';
    } else {
        // JSON export
        const exportData = customers.map(customer => {
            const data = {
                name: customer.name,
                totalInvoices: customer.totalInvoices,
                totalAmount: customer.totalCurrentBillAmount,
                amountPaid: customer.amountPaid,
                balanceDue: customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns - customer.totalDiscountAmount,
                lastInvoiceNo: customer.lastInvoiceNo,
                lastInvoiceDate: customer.lastInvoiceDate
            };

            if (columns.includes('phone')) data.phone = customer.phone;
            if (columns.includes('address')) data.address = customer.address;
            if (columns.includes('returns')) data.returns = customer.totalReturns;
            if (columns.includes('invoices')) data.invoiceNumbers = customer.allInvoiceNumbers;

            return data;
        });

        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json;charset=utf-8;';
        fileExtension = 'json';
    }

    // Download file
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `PR_Fabrics_Customers_${timestamp}.${fileExtension}`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showExportSuccess(customers.length);
}


// WhatsApp Reminder Functions
function createWhatsAppReminderButton(customer) {
    const button = document.createElement('button');
    button.className = 'whatsapp-reminder-btn';
    button.innerHTML = '<i class="fab fa-whatsapp"></i> Send Reminder';
    button.onclick = () => openReminderModal(customer);
    return button;
}

// WhatsApp Reminder Functions - UPDATED with loading
function openReminderModal(customer) {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.id = 'reminderModal';

    // Calculate customer balance
    const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;

    modalOverlay.innerHTML = `
        <div class="reminder-modal">
            <div class="modal-header">
                <h3><i class="fab fa-whatsapp"></i> Send WhatsApp Reminder</h3>
                <button class="close-modal">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="customer-info">
                    <h4>Customer: ${customer.name}</h4>
                    <p>Phone: ${customer.phone || 'Not provided'}</p>
                    <p>Balance Due: <strong>₹${Utils.formatCurrency(customerBalance)}</strong></p>
                </div>
                
                <div class="template-selection">
                    <label>Select Reminder Template:</label>
                    <select id="reminderTemplate" class="template-select">
                        <option value="standard">Standard Payment Reminder</option>
                        <option value="urgent">Urgent Payment Required</option>
                        <option value="friendly">Friendly Follow-up</option>
                        <option value="custom">Custom Message</option>
                    </select>
                </div>
                
                <div class="message-preview">
                    <label>Message Preview:</label>
                    <div class="preview-box" id="messagePreview">
                        ${generateReminderMessage(customer, 'standard')}
                    </div>
                </div>
                
                <div class="custom-message" id="customMessageSection" style="display: none;">
                    <label>Custom Message:</label>
                    <textarea id="customMessage" placeholder="Type your custom message here..." rows="4"></textarea>
                </div>
                
                <div class="message-stats">
                    <div class="stat-item">
                        <span>Characters:</span>
                        <span id="charCount">0</span>
                    </div>
                    <div class="stat-item">
                        <span>Messages:</span>
                        <span id="messageCount">0</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">

                <button class="btn-primary" id="sendWhatsApp">
                    <i class="fab fa-whatsapp"></i> Open in WhatsApp
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    // Add event listeners
    setupReminderModalEvents(customer);
}


function setupReminderModalEvents(customer) {
    const modal = document.getElementById('reminderModal');
    const templateSelect = document.getElementById('reminderTemplate');
    const customMessageSection = document.getElementById('customMessageSection');
    const customMessage = document.getElementById('customMessage');
    const messagePreview = document.getElementById('messagePreview');
    const charCount = document.getElementById('charCount');
    const messageCount = document.getElementById('messageCount');
    const testMessageBtn = document.getElementById('testMessage');
    const sendWhatsAppBtn = document.getElementById('sendWhatsApp');
    const closeBtn = modal.querySelector('.close-modal');

    // Template selection handler
    templateSelect.addEventListener('change', function () {
        if (this.value === 'custom') {
            customMessageSection.style.display = 'block';
            updateMessageStats(customMessage.value);
        } else {
            customMessageSection.style.display = 'none';
            messagePreview.innerHTML = generateReminderMessage(customer, this.value);
            updateMessageStats(messagePreview.textContent);
        }
    });

    // Custom message handler
    customMessage.addEventListener('input', function () {
        if (templateSelect.value === 'custom') {
            messagePreview.textContent = this.value;
            updateMessageStats(this.value);
        }
    });

    // Test message handler
    testMessageBtn.addEventListener('click', function () {
        const message = templateSelect.value === 'custom'
            ? customMessage.value
            : generateReminderMessage(customer, templateSelect.value);

        // Show message in alert for testing
        Utils.showToast('Notification', 'Message Preview:\n\n' + message, 'info');
    });

    // Send WhatsApp handler
    sendWhatsAppBtn.addEventListener('click', function () {
        const message = templateSelect.value === 'custom'
            ? customMessage.value
            : generateReminderMessage(customer, templateSelect.value);

        sendWhatsAppReminder(customer.phone, message);
    });

    // Close modal handlers
    closeBtn.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Initialize stats
    updateMessageStats(messagePreview.textContent);
}

function generateReminderMessage(customer, templateType) {
    const customerBalance = customer.totalCurrentBillAmount - customer.amountPaid - customer.totalReturns;
    const hasReturns = customer.totalReturns > 0;

    let message = '';
    let subject = '';

    switch (templateType) {
        case 'standard':
            subject = 'Payment Reminder';
            message = `SANTHAMANI TEXTILES - ${subject}

Dear ${customer.name},

Your outstanding balance is: ₹${Utils.formatCurrency(customerBalance)}

Please make the payment at your earliest convenience.

This is an automated reminder`;
            break;

        case 'urgent':
            subject = 'URGENT: Payment Required';
            message = `SANTHAMANI TEXTILES - ${subject}

Dear ${customer.name},

URGENT: Your payment of ₹${Utils.formatCurrency(customerBalance)} is overdue.

Please clear the outstanding amount immediately to avoid any inconvenience.

*Urgent - Please respond immediately*`;
            break;

        case 'friendly':
            subject = 'Friendly Payment Follow-up';
            message = `SANTHAMANI TEXTILES - ${subject}

Hi ${customer.name},

Hope you're doing well! This is a friendly reminder about your outstanding balance of ₹${Utils.formatCurrency(customerBalance)}.

Please let us know if you have any questions or need more time.

Best regards,
SANTHAMANI TEXTILES Team`;
            break;

        default:
            message = `SANTHAMANI TEXTILES - Payment Reminder

Dear ${customer.name},

Your outstanding balance is ₹${Utils.formatCurrency(customerBalance)}.

Please make the payment at your earliest convenience.`;
    }

    return message;
}

function updateMessageStats(message) {
    const charCount = document.getElementById('charCount');
    const messageCount = document.getElementById('messageCount');

    charCount.textContent = message.length;
    messageCount.textContent = Math.ceil(message.length / 160); // WhatsApp message segments
}

// Update the sendWhatsAppReminder function with loading
function sendWhatsAppReminder(phoneNumber, message) {
    if (!phoneNumber) {
        Utils.showToast('Notification', 'Phone number not available for this customer.', 'info');
        return;
    }

    // Show loading on the send button
    const sendButton = document.getElementById('sendWhatsApp');
    const originalText = sendButton.innerHTML;
    sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing...';
    sendButton.classList.add('btn-processing');

    // Clean phone number
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    // Add country code if not present
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
    }

    // Append signature
    message += "\n\nSoftware created by Sabarish R.\nFor custom billing solutions, contact: 7845081278";

    // URL encode the message
    const encodedMessage = encodeURIComponent(message);

    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Reset button after short delay
    setTimeout(() => {
        sendButton.innerHTML = originalText;
        sendButton.classList.remove('btn-processing');

        // Open in new tab
        window.open(whatsappUrl, '_blank');

        // Close modal
        const modal = document.getElementById('reminderModal');
        if (modal) modal.remove();

        // Show success message
        showMessage('WhatsApp opened with reminder message!', 'success');

    }, 1000);
}



// Add this function for showing messages
function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `notification ${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1001;
        animation: slideInRight 0.3s ease;
        background: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => messageDiv.remove(), 300);
        }
    }, 3000);
}



// Add these CSS styles for the new elements
const returnStyles = `
    .customer-return-badge {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 50%;
        padding: 2px 5px;
        font-size: 10px;
        margin-left: 5px;
        cursor: help;
    }

    .amount-return {
        color: #dc3545 !important;
        font-weight: 600;
    }

    .returns-preview {
        margin-top: 15px;
        padding: 10px;
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 6px;
    }

    .btn-view-returns {
        background: #17a2b8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .btn-view-returns:hover {
        background: #138496;
    }

    .btn-return {
        background: #ffc107;
        color: #212529;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
    }

    .btn-return:hover {
        background: #e0a800;
    }

    .stat-card.returns-value .stat-icon {
        background: linear-gradient(135deg, #dc3545, #e74c3c) !important;
    }
`;

// Add the styles to the document
const style = document.createElement('style');
style.textContent = returnStyles;
document.head.appendChild(style);



// Professional loading spinner functions
function showLoading(message = 'Loading...', subtext = '') {
    // Remove existing loading overlay if any
    hideLoading();

    const loadingHTML = `
        <div class="loading-overlay" id="globalLoading">
            <div class="professional-spinner"></div>
            <div class="spinner-text">${message}</div>
            ${subtext ? `<div class="spinner-subtext">${subtext}</div>` : ''}
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function hideLoading() {
    const existingLoader = document.getElementById('globalLoading');
    if (existingLoader) {
        existingLoader.remove();
    }
}

// Show skeleton loading for customer table - FIXED
function showTableSkeleton() {
    const tableBody = document.getElementById('customerTableBody');
    if (!tableBody) {
        console.warn('Table body not found');
        return;
    }

    let skeletonHTML = '';
    for (let i = 0; i < 8; i++) {
        skeletonHTML += `
            <tr>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
                <td><div class="skeleton-loader skeleton-table-row"></div></td>
            </tr>
        `;
    }
    tableBody.innerHTML = skeletonHTML;
}

// Show skeleton loading for statistics cards - REVISED to rely on CSS
function showStatsSkeleton() {
    const statsContainer = document.querySelector('.stats-cards');
    if (!statsContainer) {
        console.warn('Stats container not found');
        return;
    }

    // Add the loading class. Assume CSS handles the visual effect by applying a skeleton over the existing content.
    statsContainer.classList.add('loading');
    
    // Check if the original stat content is missing (e.g., due to an earlier error) and inject minimal skeleton placeholders if needed.
    const hasContent = !!document.getElementById('totalCustomers'); 
    if (!hasContent) {
         statsContainer.innerHTML = `
            <div class="stat-card skeleton-card">
                <div class="skeleton-loader skeleton-stat-label"></div>
                <div class="skeleton-loader skeleton-stat-value"></div>
            </div>
            <div class="stat-card skeleton-card">
                <div class="skeleton-loader skeleton-stat-label"></div>
                <div class="skeleton-loader skeleton-stat-value"></div>
            </div>
            <div class="stat-card skeleton-card">
                <div class="skeleton-loader skeleton-stat-label"></div>
                <div class="skeleton-loader skeleton-stat-value"></div>
            </div>
            <div class="stat-card skeleton-card">
                <div class="skeleton-loader skeleton-stat-label"></div>
                <div class="skeleton-loader skeleton-stat-value"></div>
            </div>
            <div class="stat-card skeleton-card">
                <div class="skeleton-loader skeleton-stat-label"></div>
                <div class="skeleton-loader skeleton-stat-value"></div>
            </div>
        `;
    }
    
    console.log('📊 Statistics skeleton shown (CSS class added)');
}

// Hide skeleton and ensure statistics are ready
function hideStatsSkeleton() {
    const statsContainer = document.querySelector('.stats-cards');
    if (statsContainer) {
        statsContainer.classList.remove('loading');
        console.log('📊 Statistics skeleton hidden');
    }
}
// Enhanced loading with timeout
function showLoadingWithTimeout(message, subtext = '', timeout = 30000) {
    showLoading(message, subtext);

    // Auto-hide after timeout to prevent stuck loading
    setTimeout(() => {
        hideLoading();
    }, timeout);
}

// Show success state for buttons
function showButtonSuccess(buttonId, duration = 2000) {
    const button = document.getElementById(buttonId);
    if (button) {
        const originalHTML = button.innerHTML;
        const originalBackground = button.style.background;

        button.innerHTML = '<i class="fas fa-check"></i> Success!';
        button.classList.add('btn-success');

        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('btn-success');
            if (originalBackground) {
                button.style.background = originalBackground;
            }
        }, duration);
    }
}

// Show error state
function showErrorState(message) {
    const tableBody = document.getElementById('customerTableBody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                    <h3>Error Loading Customer Data</h3>
                    <p>${message}</p>
                    <button onclick="retryLoadCustomers()" class="btn-retry">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </td>
            </tr>
        `;
    }

    // Also show error in stats
    const statsContainer = document.querySelector('.stats-cards');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card error-state">
                <div class="stat-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="stat-info">
                    <h3>Error</h3>
                    <p>Failed to load statistics</p>
                </div>
            </div>
        `;
    }
}

async function retryLoadCustomers() {
    await loadAllCustomers();
}

function editCustomer(safeId, oldPhone, oldName) {
    // Hide display, show edit containers
    document.getElementById(`display-name-${safeId}`).style.display = 'none';
    document.getElementById(`edit-name-container-${safeId}`).style.display = 'block';

    document.getElementById(`display-phone-${safeId}`).style.display = 'none';
    document.getElementById(`edit-phone-container-${safeId}`).style.display = 'block';

    document.getElementById(`display-address-${safeId}`).style.display = 'none';
    document.getElementById(`edit-address-container-${safeId}`).style.display = 'block';

    document.getElementById(`edit-btn-${safeId}`).style.display = 'none';
    document.getElementById(`save-btn-${safeId}`).style.display = 'inline-block';
}

async function saveCustomer(safeId, oldPhone, oldName) {
    const newName = document.getElementById(`edit-name-${safeId}`).value.trim();
    const newPhone = document.getElementById(`edit-phone-${safeId}`).value.trim();
    const newAddress = document.getElementById(`edit-address-${safeId}`).value.trim();

    if (!newName) {
        alert("Customer name is required.");
        return;
    }

    try {
        document.getElementById(`save-btn-${safeId}`).innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving';
        document.getElementById(`save-btn-${safeId}`).disabled = true;

        await db.updateCustomerDetails(oldName, newName, newPhone, newAddress);
        
        // Refresh table
        await loadAllCustomers();
        
    } catch (error) {
        console.error("Failed to update customer:", error);
        alert("Failed to update customer details.");
        
        // Reset UI
        document.getElementById(`save-btn-${safeId}`).innerHTML = '<i class="fas fa-save"></i> Save';
        document.getElementById(`save-btn-${safeId}`).disabled = false;
        
        document.getElementById(`display-name-${safeId}`).style.display = 'block';
        document.getElementById(`edit-name-container-${safeId}`).style.display = 'none';

        document.getElementById(`display-phone-${safeId}`).style.display = 'block';
        document.getElementById(`edit-phone-container-${safeId}`).style.display = 'none';

        document.getElementById(`display-address-${safeId}`).style.display = 'block';
        document.getElementById(`edit-address-container-${safeId}`).style.display = 'none';

        document.getElementById(`edit-btn-${safeId}`).style.display = 'inline-block';
        document.getElementById(`save-btn-${safeId}`).style.display = 'none';
    }
}
