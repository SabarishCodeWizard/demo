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


// Clear customer statement search and results
function clearCustomerStatement() {
    document.getElementById('customerSearch').value = '';
    document.getElementById('customerStatementResults').innerHTML = '';
}


// Add scroll to top button functionality
function addScrollToTopButton() {
    // Create the button element
    const scrollButton = document.createElement('button');
    scrollButton.id = 'scrollToTopBtn';
    scrollButton.className = 'scroll-to-top-btn';
    scrollButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
    scrollButton.title = 'Scroll to top';

    // Add styles dynamically
    scrollButton.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
        transition: all 0.3s ease;
        z-index: 1000;
        display: none;
        align-items: center;
        justify-content: center;
    `;

    // Add hover effects
    scrollButton.addEventListener('mouseenter', function () {
        this.style.background = '#0056b3';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 6px 16px rgba(0, 123, 255, 0.4)';
    });

    scrollButton.addEventListener('mouseleave', function () {
        this.style.background = '#007bff';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.3)';
    });

    // Add click event to scroll to top
    scrollButton.addEventListener('click', function () {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Add to page
    document.body.appendChild(scrollButton);

    // Show/hide button based on scroll position
    window.addEventListener('scroll', function () {
        if (window.pageYOffset > 300) {
            scrollButton.style.display = 'flex';
        } else {
            scrollButton.style.display = 'none';
        }
    });
}


document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) {
        return;
    }

    try {
        // Initialize database
        // NOTE: showLoading is removed as requested for a better UX.
        await db.init();

        // Load recent invoices - uses its own skeleton loading now
        await loadRecentInvoices();



        // Check for URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');

        if (searchParam) {
            document.getElementById('searchInput').value = searchParam;
        }

        // Load all invoices - uses skeleton loading now
        await loadInvoices();

        addScrollToTopButton();

        // Add event listeners
        document.getElementById('searchBtn').addEventListener('click', loadInvoices);
        document.getElementById('clearFilters').addEventListener('click', clearFilters);
        document.getElementById('generateCustomerStatement').addEventListener('click', searchCustomerInvoices);
        document.getElementById('clearCustomerStatement').addEventListener('click', clearCustomerStatement);

    } catch (error) {
        console.error('Error during page initialization:', error);
        Utils.showToast('Error', 'Error loading invoice history page. Please refresh.', 'error');
    }
});


// Update searchCustomerInvoices with section-specific skeleton loading
async function searchCustomerInvoices() {
    const customerName = document.getElementById('customerSearch').value.trim();

    if (!customerName) {
        Utils.showToast('Warning', 'Please enter a customer name', 'warning');
        return;
    }

    try {
        // Show skeleton loading for customer statement area
        showSkeletonLoadingCustomerStatement();

        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            document.getElementById('customerStatementResults').innerHTML = `
                <div class="no-customer-invoices">
                    <i class="fas fa-search" style="font-size: 48px; color: #6c757d; margin-bottom: 16px;"></i>
                    <p>No invoices found for customer: "${customerName}"</p>
                </div>
            `;
            return;
        }

        displayCustomerStatementResults(customerName, customerInvoices);
    } catch (error) {
        console.error('Error searching customer invoices:', error);
        document.getElementById('customerStatementResults').innerHTML = `<p class="error-state">Error loading customer statement.</p>`;
        Utils.showToast('Error', 'Error searching customer invoices.', 'error');
    }

}

// Display customer statement results
async function displayCustomerStatementResults(customerName, invoices) {
    // Sort invoices by invoice number (newest first)
    invoices.sort((a, b) => {
        const numA = parseInt(a.invoiceNo) || 0;
        const numB = parseInt(b.invoiceNo) || 0;
        return numB - numA; // Descending order (newest first)
    });

    // OPTIMIZATION: Fetch all returns once
    const allReturns = await db.getAllReturns();
    const returnsByInvoice = {};
    allReturns.forEach(r => {
        if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
        returnsByInvoice[r.invoiceNo].push(r);
    });

    // Calculate returns for all invoices
    const invoicesWithReturns = invoices.map((invoice) => {
        const returns = returnsByInvoice[invoice.invoiceNo] || [];
        const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
        return {
            ...invoice,
            totalReturns,
            adjustedBalanceDue: invoice.balanceDue - totalReturns
        };
    });

    // Calculate summary statistics
    const totalInvoices = invoicesWithReturns.length;
    const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
    const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);
    const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
    const totalDiscountAmount = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.discountAmount || 0), 0);

    // Get adjusted balance due from the most recent invoice
    const mostRecentInvoice = invoicesWithReturns[0];
    const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

    document.getElementById('customerStatementResults').innerHTML = `
        <div class="customer-summary">
            <h4>Customer: ${customerName}</h4>
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-value">${totalInvoices}</div>
                    <div class="stat-label">Total Invoices</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₹${Utils.formatCurrency(totalCurrentBillAmount)}</div>
                    <div class="stat-label">Total Current Bill Amount</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">₹${Utils.formatCurrency(totalPaid)}</div>
                    <div class="stat-label">Total Paid</div>
                </div>
                ${totalDiscountAmount > 0 ? `
                    <div class="stat-item">
                        <div class="stat-value">₹${Utils.formatCurrency(totalDiscountAmount)}</div>
                        <div class="stat-label">Total Discount</div>
                    </div>
                ` : ''}
                ${totalReturns > 0 ? `
                    <div class="stat-item">
                        <div class="stat-value" style="color: #dc3545;">-₹${Utils.formatCurrency(totalReturns)}</div>
                        <div class="stat-label">Total Returns</div>
                    </div>
                ` : ''}
                <div class="stat-item">
                    <div class="stat-value ${adjustedBalanceDue > 0 ? 'amount-negative' : (adjustedBalanceDue < 0 ? 'amount-positive' : '')}">
                        ₹${Utils.formatCurrency(adjustedBalanceDue)}
                    </div>
                    <div class="stat-label">${totalReturns > 0 ? 'Adjusted Balance Due' : 'Balance Due'}</div>
                </div>
            </div>
            
            <div class="customer-invoices-list">
                ${invoicesWithReturns.map(invoice => {
        const previousBalance = (invoice.previousBalance || 0) + (invoice.manualPreviousBalance || 0);
        return `
                    <div class="customer-invoice-item">
                        <div class="customer-invoice-info">
                            <strong>Invoice #${invoice.invoiceNo}</strong> - 
                            ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')} - 
                            Current: ₹${Utils.formatCurrency(invoice.subtotal)} - 
                            ${previousBalance > 0 ? `Prev Bal: ₹${Utils.formatCurrency(previousBalance)} - ` : ''}
                            ${invoice.discountAmount ? `Discount: ₹${Utils.formatCurrency(invoice.discountAmount)} - ` : ''}
                            Paid: ₹${Utils.formatCurrency(invoice.amountPaid)}
                            ${invoice.totalReturns > 0 ? ` - Returns: ₹${Utils.formatCurrency(invoice.totalReturns)}` : ''}
                            - Due: ₹${Utils.formatCurrency(invoice.totalReturns > 0 ? invoice.adjustedBalanceDue : invoice.balanceDue)}
                            ${invoice.totalReturns > 0 ? ' (Adjusted)' : ''}
                        </div>
                        ${invoice.totalReturns > 0 ? `
                            <div class="return-badge">
                                <i class="fas fa-undo"></i> Returns: ₹${Utils.formatCurrency(invoice.totalReturns)}
                            </div>
                        ` : ''}
                    </div>
                `}).join('')}
            </div>
        </div>
    `;
}

// Generate combined statement PDF for all customer invoices
async function generateCombinedStatement(customerName) {
    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            Utils.showToast('Notification', 'No invoices found for this customer.', 'info');
            return;
        }

        await generateCombinedPDFStatement(customerName, customerInvoices);
    } catch (error) {
        console.error('Error generating combined statement:', error);
        Utils.showToast('Error', 'Error generating combined statement.', 'error');
    }
}

// Generate combined PDF statement for all customer invoices - SIMPLE & PROFESSIONAL
async function generateCombinedPDFStatement(customerName, invoices) {
    try {

        showLoading('Generating PDF Statement', 'This may take a few moments...');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Simple color scheme
        const primaryColor = [0, 0, 0]; // Black
        const accentColor = [0, 100, 0]; // Dark Green
        const grayColor = [100, 100, 100]; // Gray

        // Add Watermark and Logo if available
        if (typeof PDFGenerator !== 'undefined' && PDFGenerator.checkImageExists()) {
            const logoBase64 = PDFGenerator.getImageBase64();
            // Watermark
            doc.setGState(new doc.GState({opacity: 0.1}));
            doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 75, pageHeight / 2 - 75, 150, 150);
            doc.setGState(new doc.GState({opacity: 1.0}));
            // Logo in header
            doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 15, yPos, 30, 25);
            yPos += 30; // Push text down
        }

        // HEADER
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('SANTHAMANI TEXTILES', pageWidth / 2, yPos, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('No.16/1, 25A, Thirumalai Nagar South, 1st Street, TIRUPUR - 641 602.', pageWidth / 2, yPos + 5, { align: 'center' });
        doc.text('Cell: 90872 93268, 9092779599', pageWidth / 2, yPos + 10, { align: 'center' });

        yPos += 20;

        // TITLE
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('COMBINED ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });

        // Underline
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 50, yPos + 2, pageWidth / 2 + 50, yPos + 2);

        yPos += 15;

        // Sort invoices by invoice number (newest first)
        invoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        // OPTIMIZATION: Fetch all returns and payments once
        const allReturns = await db.getAllReturns();
        const allPayments = await db.getAllPayments();
        
        const returnsByInvoice = {};
        allReturns.forEach(r => {
            if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
            returnsByInvoice[r.invoiceNo].push(r);
        });

        const paymentsByInvoice = {};
        allPayments.forEach(p => {
            if (!paymentsByInvoice[p.invoiceNo]) paymentsByInvoice[p.invoiceNo] = [];
            paymentsByInvoice[p.invoiceNo].push(p);
        });

        // Calculate returns for all invoices
        const invoicesWithReturns = invoices.map((invoice) => {
            const returns = returnsByInvoice[invoice.invoiceNo] || [];
            const payments = paymentsByInvoice[invoice.invoiceNo] || [];
            const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
            return {
                ...invoice,
                totalReturns,
                adjustedBalanceDue: invoice.balanceDue - totalReturns,
                returns,
                payments
            };
        });

        // Get customer details from the most recent invoice
        const mostRecentInvoice = invoicesWithReturns[0];
        const customerPhone = mostRecentInvoice.customerPhone || 'Not specified';
        const customerAddress = mostRecentInvoice.customerAddress || 'Not specified';

        // Calculate totals
        const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
        const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);
        const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;



        // CUSTOMER INFORMATION SECTION
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('CUSTOMER INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        doc.text(`Name: ${customerName}`, margin, yPos);
        yPos += 4;
        doc.text(`Phone: ${customerPhone}`, margin, yPos);
        yPos += 4;
        doc.text(`Address: ${customerAddress}`, margin, yPos);
        yPos += 10;

        // Process each invoice separately
        for (let i = 0; i < invoicesWithReturns.length; i++) {
            const invoice = invoicesWithReturns[i];

            // Check if we need a new page before starting a new invoice
            if (yPos > 240) {
                doc.addPage();
                yPos = 20;
            }

            // INVOICE HEADER
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text(`INVOICE #${invoice.invoiceNo} - ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, margin, yPos);
            yPos += 6;

            // Simple underline for invoice header
            doc.setDrawColor(...grayColor);
            doc.setLineWidth(0.3);
            doc.line(margin, yPos, margin + 60, yPos);
            yPos += 8;

            // Invoice details table
            const invoiceTableHeaders = [['S.No.', 'Description', 'Qty', 'Rate', 'Amount']];
            const invoiceTableData = invoice.products.map((product, index) => [
                (index + 1).toString(),
                product.description,
                product.qty.toString(),
                Utils.formatCurrency(product.rate),
                Utils.formatCurrency(product.amount)
            ]);

            doc.autoTable({
                startY: yPos,
                head: invoiceTableHeaders,
                body: invoiceTableData,
                theme: 'grid',
                headStyles: {
                    fillColor: [240, 240, 240],
                    textColor: primaryColor,
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: 3,
                    lineWidth: 0.3
                },
                bodyStyles: {
                    fontSize: 8,
                    cellPadding: 2,
                    lineColor: [220, 220, 220],
                    lineWidth: 0.1
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 'auto', halign: 'left' },
                    2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 20, halign: 'right' },
                    4: { cellWidth: 22, halign: 'right' }
                },
                margin: { left: margin, right: margin },
                styles: {
                    lineColor: [200, 200, 200],
                    lineWidth: 0.2
                }
            });

            yPos = doc.lastAutoTable.finalY + 8;

            // Check if we need a new page before invoice summary
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }



            // Add return information if applicable for this invoice
            if (invoice.totalReturns > 0 && invoice.returns && invoice.returns.length > 0) {
                // Check if we need a new page
                if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.text('RETURN INFORMATION', margin, yPos);
                yPos += 7;

                const returnTableHeaders = [['Date', 'Product', 'Qty', 'Rate', 'Amount']];
                const returnTableData = invoice.returns.map((returnItem, index) => [
                    new Date(returnItem.returnDate).toLocaleDateString('en-IN'),
                    returnItem.description,
                    returnItem.qty.toString(),
                    Utils.formatCurrency(returnItem.rate),
                    Utils.formatCurrency(returnItem.returnAmount)
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: returnTableHeaders,
                    body: returnTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: primaryColor,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3
                    },
                    bodyStyles: {
                        fontSize: 7,
                        cellPadding: 2,
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { cellWidth: 22, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 15, halign: 'center' },
                        3: { cellWidth: 20, halign: 'right' },
                        4: { cellWidth: 22, halign: 'right' }
                    },
                    margin: { left: margin, right: margin }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }

            // Add payment history for this invoice
            if (invoice.payments && invoice.payments.length > 0) {
                // Check if we need a new page for payment history
                if (yPos > 200) {
                    doc.addPage();
                    yPos = 20;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...primaryColor);
                doc.text('PAYMENT HISTORY', margin, yPos);
                yPos += 7;

                // Create payment history table for this invoice
                const paymentTableHeaders = [['Date', 'Description', 'Amount', 'Balance']];
                const paymentTableData = generatePaymentTableData(invoice.payments, invoice.grandTotal, invoice.totalReturns);

                doc.autoTable({
                    startY: yPos,
                    head: paymentTableHeaders,
                    body: paymentTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: primaryColor,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3
                    },
                    bodyStyles: {
                        fontSize: 8,
                        cellPadding: 2,
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { cellWidth: 25, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 25, halign: 'right' },
                        3: { cellWidth: 25, halign: 'right' }
                    },
                    margin: { left: margin, right: margin }
                });

                yPos = doc.lastAutoTable.finalY + 15;
            }

            // Add spacing between invoices
            if (i < invoicesWithReturns.length - 1) {
                // Simple separator line between invoices
                doc.setDrawColor(220, 220, 220);
                doc.setLineWidth(0.2);
                doc.line(margin, yPos, pageWidth - margin, yPos);
                yPos += 8;
            }
        }



        // FOOTER
        yPos = pageHeight - 20;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('This is a computer-generated statement. No signature is required.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('For any queries, please contact: 90872 93268, 9092779599', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('Software created by Sabarish', pageWidth / 2, yPos, { align: 'center' });

        // Generate filename and save
        const today = new Date();
        const dateFolder = today.toISOString().split('T')[0];
        const fileName = `Statement_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateFolder}.pdf`;

        doc.save(fileName);

        setTimeout(() => {
            Utils.showToast('Success', `Combined statement saved as: ${fileName}`, 'success');
        }, 500);

        hideLoading();

    } catch (error) {
        hideLoading();
        console.error('Error generating combined PDF statement:', error);
        throw error;
    }
}

// Trigger for the Easy Combined Statement
async function generateCombinedStatementEasy(customerName) {
    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            Utils.showToast('Notification', 'No invoices found for this customer.', 'info');
            return;
        }

        await generateCombinedPDFStatementEasy(customerName, customerInvoices);
    } catch (error) {
        console.error('Error generating easy combined statement:', error);
        Utils.showToast('Error', 'Error generating easy combined statement.', 'error');
    }
}

// Generates a simplified, easy-to-read PDF layout
async function generateCombinedPDFStatementEasy(customerName, invoices) {
    try {
        showLoading('Generating Easy Statement', 'Creating simplified view...');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;

        const primaryColor = [0, 0, 0];
        const grayColor = [100, 100, 100]; // Gray

        // Add Watermark and Logo if available
        if (typeof PDFGenerator !== 'undefined' && PDFGenerator.checkImageExists()) {
            const logoBase64 = PDFGenerator.getImageBase64();
            // Watermark
            doc.setGState(new doc.GState({opacity: 0.1}));
            doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 75, pageHeight / 2 - 75, 150, 150);
            doc.setGState(new doc.GState({opacity: 1.0}));
            // Logo in header
            doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 15, yPos, 30, 25);
            yPos += 30; // Push text down
        }

        // --- HEADER ---
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('SANTHAMANI TEXTILES', pageWidth / 2, yPos, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('No.16/1, 25A, Thirumalai Nagar South, 1st Street, TIRUPUR - 641 602.', pageWidth / 2, yPos + 5, { align: 'center' });
        doc.text('Cell: 90872 93268, 9092779599', pageWidth / 2, yPos + 10, { align: 'center' });

        yPos += 20;

        // TITLE
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('COMBINED ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });

        // Underline Title
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 42, yPos + 2, pageWidth / 2 + 42, yPos + 2);

        yPos += 15;

        // Sort invoices chronologically (oldest first for a ledger feel)
        invoices.sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));

        // Get customer details from their most recent invoice
        const newestInvoice = invoices[invoices.length - 1] || {};
        const customerPhone = newestInvoice.customerPhone || 'Not specified';
        const customerAddress = newestInvoice.customerAddress || 'Not specified';

        // --- CUSTOMER INFORMATION ---
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('CUSTOMER INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text(`Name: ${customerName}`, margin, yPos);
        yPos += 5;
        doc.text(`Phone: ${customerPhone}`, margin, yPos);
        yPos += 5;
        doc.text(`Address: ${customerAddress}`, margin, yPos);
        yPos += 10;

        // --- PREPARE TABLE DATA ---
        const tableData = [];
        let totalBill = 0;
        let totalPaid = 0;
        let totalReturnAmt = 0;

        // OPTIMIZATION: Fetch all returns once
        const allReturns = await db.getAllReturns();
        const returnsByInvoice = {};
        allReturns.forEach(r => {
            if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
            returnsByInvoice[r.invoiceNo].push(r);
        });

        // Fetch return amounts for precise calculations
        const processedInvoices = invoices.map((inv) => {
            const returns = returnsByInvoice[inv.invoiceNo] || [];
            const retAmt = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
            return { ...inv, returnAmt: retAmt };
        });

        processedInvoices.forEach(inv => {
            // Simplify Particulars (Combine product descriptions)
            const productSummary = inv.products && inv.products.length > 0
                ? inv.products.map(p => p.description).join(', ')
                : 'Products Purchased';

            // Truncate if it's too long
            let particulars = productSummary.length > 50 
                ? productSummary.substring(0, 47) + '...' 
                : productSummary;
            
            // Note returns directly in the particulars column to save space
            if (inv.returnAmt > 0) {
                 particulars += `\n(Returns deducted: -Rs. ${Utils.formatCurrency(inv.returnAmt)})`;
            }

            tableData.push([
                inv.invoiceNo,
                new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
                particulars,
                Utils.formatCurrency(inv.subtotal),
                Utils.formatCurrency(inv.amountPaid)
            ]);

            totalBill += inv.subtotal;
            totalPaid += inv.amountPaid;
            totalReturnAmt += inv.returnAmt;
        });

        // --- SIMPLE TABLE GENERATION ---
        doc.autoTable({
            startY: yPos,
            head: [['Invoice', 'Date', 'Particulars', 'Amount', 'Received']],
            body: tableData,
            theme: 'plain', // Very clean layout
            headStyles: {
                fontStyle: 'bold',
                textColor: [0, 0, 0],
                fillColor: [255, 255, 255], 
                lineWidth: { bottom: 0.5 },
                lineColor: [0, 0, 0]
            },
            bodyStyles: {
                textColor: [30, 30, 30],
                fillColor: [255, 255, 255], 
                cellPadding: 4,
                lineWidth: { bottom: 0.1 },
                lineColor: [220, 220, 220]
            },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 25 },
                2: { cellWidth: 'auto' },
                3: { cellWidth: 30, halign: 'right' },
                4: { cellWidth: 30, halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 12;

        // Check if we need a new page for totals and footer
        if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = 20;
        }

        // --- FOOTER TOTALS ---
        const finalBalance = totalBill - totalPaid - totalReturnAmt;

        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);

        // Align totals to the right
        const labelX = pageWidth - 70;
        const valueX = pageWidth - margin;

        doc.text('Total Amount:', labelX, yPos);
        doc.text(`Rs. ${Utils.formatCurrency(totalBill)}`, valueX, yPos, { align: 'right' });
        yPos += 6;

        doc.text('Total Received:', labelX, yPos);
        doc.text(`Rs. ${Utils.formatCurrency(totalPaid)}`, valueX, yPos, { align: 'right' });
        yPos += 6;

        if (totalReturnAmt > 0) {
            doc.text('Total Returns:', labelX, yPos);
            doc.text(`-Rs. ${Utils.formatCurrency(totalReturnAmt)}`, valueX, yPos, { align: 'right' });
            yPos += 6;
        }

        // Bold line before balance
        doc.setLineWidth(0.5);
        doc.line(labelX, yPos, valueX, yPos);
        yPos += 6;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Balance Due:', labelX, yPos);
        doc.text(`Rs. ${Utils.formatCurrency(finalBalance)}`, valueX, yPos, { align: 'right' });

        // --- PAGE FOOTER ---
        let footerY = pageHeight - 20;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('This is a computer-generated statement. No signature is required.', pageWidth / 2, footerY, { align: 'center' });
        footerY += 4;
        doc.text('For any queries, please contact: 90872 93268, 9092779599', pageWidth / 2, footerY, { align: 'center' });
        footerY += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, footerY, { align: 'center' });

        // Save
        const dateStr = new Date().toISOString().split('T')[0];
        const fileName = `Statement_Easy_${customerName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`;
        
        doc.save(fileName);
        
        setTimeout(() => {
            Utils.showToast('Success', `Easy Statement saved as: ${fileName}`, 'success');
        }, 500);

        hideLoading();

    } catch (error) {
        hideLoading();
        console.error('Error generating easy combined PDF statement:', error);
        throw error;
    }
}

// Load and display recent invoices (last 5 by invoice number) - with skeleton loading
async function loadRecentInvoices() {
    try {
        // Show skeleton loading for recent invoices
        showSkeletonLoadingRecentInvoices(5);

        const invoices = await db.getAllInvoices();

        // Sort by invoice number in descending order (highest numbers first)
        const recentInvoices = invoices
            .sort((a, b) => {
                // Convert invoice numbers to numbers for proper numerical sorting
                const numA = parseInt(a.invoiceNo) || 0;
                const numB = parseInt(b.invoiceNo) || 0;
                return numB - numA; // Descending order (highest first)
            })
            .slice(0, 5);

        displayRecentInvoices(recentInvoices);
    } catch (error) {
        console.error('Error loading recent invoices:', error);
        // Display error message
        const recentInvoicesList = document.getElementById('recentInvoicesList');
        recentInvoicesList.innerHTML = '<p class="error-state">Error loading recent invoices.</p>';
    }
}
// Display recent invoices at the top
function displayRecentInvoices(invoices) {
    const recentInvoicesList = document.getElementById('recentInvoicesList');

    if (invoices.length === 0) {
        recentInvoicesList.innerHTML = '<p class="no-recent-invoices">No recent invoices found.</p>';
        return;
    }

    recentInvoicesList.innerHTML = invoices.map(invoice => `
        <div class="recent-invoice-item" onclick="filterByInvoice('${invoice.invoiceNo}')">
            <span class="invoice-number">#${invoice.invoiceNo}</span>
            <span class="invoice-customer">${invoice.customerName}</span>
            <span class="invoice-date">${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
            <span class="invoice-amount">₹${Utils.formatCurrency(invoice.subtotal)}</span>
        </div>
    `).join('');
}

// Filter invoices by specific invoice number
function filterByInvoice(invoiceNo) {
    document.getElementById('searchInput').value = invoiceNo;
    loadInvoices();
}

// Update loadInvoices function
async function loadInvoices() {
    try {
        // Show skeleton loading
        showSkeletonLoading(3);

        const invoices = await db.getAllInvoices();
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const fromInvoiceNo = document.getElementById('fromInvoiceNo').value;
        const toInvoiceNo = document.getElementById('toInvoiceNo').value;

        let filteredInvoices = invoices;

        // Apply search filter
        if (searchTerm) {
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.customerName.toLowerCase().includes(searchTerm) ||
                invoice.invoiceNo.toLowerCase().includes(searchTerm)
            );
        }

        // Apply date filters
        if (fromDate) {
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.invoiceDate >= fromDate
            );
        }

        if (toDate) {
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.invoiceDate <= toDate
            );
        }

        // Apply invoice number range filter
        if (fromInvoiceNo || toInvoiceNo) {
            filteredInvoices = filteredInvoices.filter(invoice => {
                const invoiceNum = parseInt(invoice.invoiceNo) || 0;

                if (fromInvoiceNo && toInvoiceNo) {
                    return invoiceNum >= parseInt(fromInvoiceNo) && invoiceNum <= parseInt(toInvoiceNo);
                } else if (fromInvoiceNo) {
                    return invoiceNum >= parseInt(fromInvoiceNo);
                } else if (toInvoiceNo) {
                    return invoiceNum <= parseInt(toInvoiceNo);
                }
                return true;
            });
        }

        // Sort by invoice date and number (newest first)
        filteredInvoices.sort((a, b) => {
            const dateCompare = new Date(b.invoiceDate) - new Date(a.invoiceDate);
            if (dateCompare !== 0) return dateCompare;

            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        displayInvoices(filteredInvoices);

    } catch (error) {
        console.error('Error loading invoices:', error);
        const invoicesList = document.getElementById('invoicesList');
        invoicesList.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 16px;"></i>
                <p>Error loading invoices. Please try again.</p>
                <button onclick="loadInvoices()" class="btn-retry">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// Modify the displayInvoices function to show date-wise grouping
async function displayInvoices(invoices) {
    const invoicesList = document.getElementById('invoicesList');

    if (invoices.length === 0) {
        invoicesList.innerHTML = '<p class="no-invoices">No invoices found.</p>';
        return;
    }

    // Group invoices by date
    const groupedInvoices = groupInvoicesByDate(invoices);

    let htmlContent = '';

    // OPTIMIZATION: Fetch all returns once
    const allReturns = await db.getAllReturns();
    const returnsByInvoice = {};
    allReturns.forEach(r => {
        if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
        returnsByInvoice[r.invoiceNo].push(r);
    });

    // OPTIMIZATION: Fetch all payments once
    const allPayments = await db.getAllPayments();
    const paymentsByInvoice = {};
    allPayments.forEach(p => {
        if (!paymentsByInvoice[p.invoiceNo]) paymentsByInvoice[p.invoiceNo] = [];
        paymentsByInvoice[p.invoiceNo].push(p);
    });

    // Determine the latest invoice for each customer to show "Add Payment" only for the latest bill
    const allGlobalInvoices = await db.getAllInvoices();
    allGlobalInvoices.sort((a, b) => {
        const dateA = a.invoiceDate ? new Date(a.invoiceDate) : new Date(0);
        const dateB = b.invoiceDate ? new Date(b.invoiceDate) : new Date(0);
        const dateDiff = dateB - dateA;
        if (dateDiff !== 0) return dateDiff;
        
        const numA = parseInt(a.invoiceNo) || 0;
        const numB = parseInt(b.invoiceNo) || 0;
        return numB - numA;
    });

    const latestInvoicePerCustomer = {};
    allGlobalInvoices.forEach(inv => {
        if (!latestInvoicePerCustomer[inv.customerName]) {
            latestInvoicePerCustomer[inv.customerName] = inv.invoiceNo;
        }
    });

    // Generate HTML for each date group
    for (const group of groupedInvoices) {
        // Calculate returns and payments for all invoices in this date group first
        const invoicesWithReturns = group.invoices.map((invoice) => {
            const returns = returnsByInvoice[invoice.invoiceNo] || [];
            const payments = paymentsByInvoice[invoice.invoiceNo] || [];
            const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
            const adjustedBalanceDue = invoice.balanceDue - totalReturns;

            return {
                ...invoice,
                returns,
                payments,
                totalReturns,
                adjustedBalanceDue,
                isCurrentAdjustedBalance: true
            };
        });

        // Add date group header (only date and count)
        htmlContent += `
            <div class="date-group">
                <div class="date-group-header">
                    <h3 class="date-title">
                        <i class="fas fa-calendar-day"></i>
                        ${group.date}
                    </h3>
                    <div class="date-summary">
                        <span class="invoice-count">${group.totalInvoices} Invoice${group.totalInvoices > 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="date-invoices-list">
        `;

        // Add individual invoices for this date
        htmlContent += invoicesWithReturns.map(invoice => {
            const payments = invoice.payments || [];
            const returns = invoice.returns || [];

            // Calculate previous bill amount
            const previousBillAmount = (invoice.previousBalance || 0) + (invoice.manualPreviousBalance || 0);

            return `
            <div class="invoice-item">
                <div class="invoice-info">
                    <h3>Invoice #${invoice.invoiceNo}</h3>
                    <p><strong>Customer:</strong> ${invoice.customerName}</p>
                    
                    <p><strong>Current Bill Amount:</strong> ₹${Utils.formatCurrency(invoice.subtotal)}</p>
                    <p><strong>Previous Balance:</strong> ₹${Utils.formatCurrency(previousBillAmount)}</p>
                    ${invoice.discountAmount ? `<p><strong>Discount Amount:</strong> -₹${Utils.formatCurrency(invoice.discountAmount)}</p>` : ''}
                    <p><strong>Total Amount:</strong> ₹${Utils.formatCurrency(invoice.grandTotal)}</p>
                    <p><strong>Amount Paid:</strong> ₹${Utils.formatCurrency(invoice.amountPaid)} 
                        ${invoice.paymentMethod ? `<span class="payment-method-badge payment-method-${invoice.paymentMethod}">${invoice.paymentMethod.toUpperCase()}</span>` : ''}
                    </p>
                    ${invoice.totalReturns > 0 ? `
                        <p><strong>Return Amount:</strong> <span style="color: #dc3545;">-₹${Utils.formatCurrency(invoice.totalReturns)}</span></p>
                        <p><strong>Current Adjusted Balance Due:</strong> ₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}</p>
                    ` : `
                        <p><strong>Balance Due:</strong> ₹${Utils.formatCurrency(invoice.balanceDue)}</p>
                    `}
                    <details class="view-products-details" style="margin-top: 10px;">
                        <summary style="cursor: pointer; color: var(--primary-color); font-weight: 600;">View Details</summary>
                        <table style="width: 100%; margin-top: 5px; font-size: 0.9em; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <th style="text-align: left; padding: 4px;">Product</th>
                                    <th style="text-align: right; padding: 4px;">Qty</th>
                                    <th style="text-align: right; padding: 4px;">Rate</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${invoice.products && invoice.products.length > 0 ? invoice.products.map(p => `
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="text-align: left; padding: 4px;">${p.description}</td>
                                        <td style="text-align: right; padding: 4px;">${p.qty}</td>
                                        <td style="text-align: right; padding: 4px;">&#8377;${Utils.formatCurrency(p.rate)}</td>
                                    </tr>
                                `).join('') : '<tr><td colspan="3" style="text-align: center; padding: 4px;">No products found</td></tr>'}
                            </tbody>
                        </table>
                    </details>
                    ${(invoice.amountPaid > 0 || invoice.totalReturns > 0) ? `
                    <div class="history-details-container" style="margin-top: 10px;">
                          ${invoice.amountPaid > 0 ? `
                          <details class="payment-history-details" style="margin-bottom: 5px;">
                              <summary style="cursor: pointer; color: #2e7d32; font-weight: 600;">
                                  Payment History (&#8377;${Utils.formatCurrency(invoice.amountPaid)})
                              </summary>
                              <div style="margin-top: 5px; font-size: 0.9em; border: 1px solid #c8e6c9; padding: 10px; border-radius: 4px; background: #fff;">
                                  ${payments.map(payment => `
                                      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; margin-bottom: 8px;">
                                          <div>
                                              <div><strong>Date:</strong> ${new Date(payment.paymentDate || payment.date).toLocaleString('en-IN')}</div>
                                              <div style="color: #2e7d32; font-weight: bold;"><strong>Amount:</strong> &#8377;${Utils.formatCurrency(payment.amount)}</div>
                                              <div><strong>Method:</strong> ${payment.paymentMethod ? payment.paymentMethod.toUpperCase() : 'N/A'}</div>
                                              ${payment.notes ? `<div><strong>Notes:</strong> ${payment.notes}</div>` : ''}
                                              ${payment.paymentType === 'initial' ? '<span class="badge" style="background-color: #007bff; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">Initial Payment</span>' : ''}
                                          </div>
                                          <button onclick="undoPayment('${payment.id}', '${invoice.invoiceNo}')" style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 5px;" title="Undo Payment">
                                              <i class="fas fa-undo"></i>
                                          </button>
                                      </div>
                                  `).join('')}
                                  <div style="margin-top: 10px; font-weight: bold; color: #2e7d32;">
                                      Total Amount Paid: &#8377;${Utils.formatCurrency(payments.reduce((sum, p) => sum + p.amount, 0))}
                                  </div>
                                  
                              </div>
                          </details>
                          ` : ''}
                          ${invoice.totalReturns > 0 ? `
                          <details class="return-history-details" style="margin-bottom: 5px;">
                              <summary style="cursor: pointer; color: #dc3545; font-weight: 600;">
                                  Return History (&#8377;${Utils.formatCurrency(invoice.totalReturns)})
                              </summary>
                              <div style="margin-top: 5px; font-size: 0.9em; border: 1px solid #ffcdd2; padding: 10px; border-radius: 4px; background: #fff;">
                                  ${returns.map(ret => `
                                      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f5c6cb; padding-bottom: 8px; margin-bottom: 8px;">
                                          <div>
                                              <div><strong>Date:</strong> ${new Date(ret.returnDate || ret.date).toLocaleString('en-IN')}</div>
                                               ${ret.description ? `<div><strong>Product:</strong> ${ret.description}</div>` : ''}
                                               ${ret.qty ? `<div><strong>Qty:</strong> ${ret.qty}</div>` : ''}
                                               ${ret.rate ? `<div><strong>Rate:</strong> &#8377;${Utils.formatCurrency(ret.rate)}</div>` : ''}
                                              <div style="color: #dc3545; font-weight: bold;"><strong>Amount:</strong> -&#8377;${Utils.formatCurrency(ret.returnAmount)}</div>
                                              <div><strong>Reason:</strong> ${ret.reason || 'N/A'}</div>
                                          </div>
                                          <button onclick="undoReturn('${ret.id}', '${invoice.invoiceNo}')" style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 5px;" title="Undo Return">
                                              <i class="fas fa-undo"></i>
                                          </button>
                                      </div>
                                  `).join('')}
                                  <div style="margin-top: 10px; font-weight: bold; color: #dc3545;">
                                      Total Return Amount: -&#8377;${Utils.formatCurrency(returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0))}
                                  </div>
                                  
                              </div>
                          </details>
                          ` : ''}
                      </div>
                    ` : ''}
                </div>
                <div class="invoice-actions-container">
                    <div class="primary-actions">
                        <button class="btn-edit" onclick="editInvoice('${invoice.invoiceNo}')">Edit</button>
                        <button class="btn-delete" onclick="deleteInvoice('${invoice.invoiceNo}')">Delete</button>
                        ${invoice.invoiceNo === latestInvoicePerCustomer[invoice.customerName] ? 
                            `<button class="btn-payment" onclick="addPayment('${invoice.invoiceNo}')">Add Payment</button>` : ''}
                        <button class="btn-return" onclick="addReturn('${invoice.invoiceNo}')">Add Return</button>
                        <button class="btn-statement" onclick="generateStatement('${invoice.invoiceNo}')">Download Statement</button>
                        <button class="btn-share" onclick="shareInvoiceViaWhatsApp('${invoice.invoiceNo}')">
                            <i class="fab fa-whatsapp"></i> Share Statement
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        // Close date group
        htmlContent += `
                </div>
            </div>
        `;
    }

    invoicesList.innerHTML = htmlContent;
}


// Add this new function to group invoices by date
function groupInvoicesByDate(invoices) {
    const groupedInvoices = {};

    invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-IN');

        if (!groupedInvoices[invoiceDate]) {
            groupedInvoices[invoiceDate] = {
                date: invoiceDate,
                invoices: [],
                totalInvoices: 0
            };
        }

        groupedInvoices[invoiceDate].invoices.push(invoice);
        groupedInvoices[invoiceDate].totalInvoices++;
    });

    // Convert to array and sort by date (newest first)
    return Object.values(groupedInvoices).sort((a, b) => {
        return new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-'));
    });
}


// Add new function to filter by specific date
function filterByDate(selectedDate) {
    document.getElementById('fromDate').value = selectedDate;
    document.getElementById('toDate').value = selectedDate;
    loadInvoices();
}


async function shareCombinedStatementViaWhatsApp(customerName) {
    try {
        const invoices = await db.getAllInvoices();
        const customerInvoices = invoices.filter(invoice =>
            invoice.customerName.toLowerCase().includes(customerName.toLowerCase())
        );

        if (customerInvoices.length === 0) {
            Utils.showToast('Notification', 'No invoices found for this customer.', 'info');
            return;
        }

        // Sort invoices by invoice number (newest first)
        customerInvoices.sort((a, b) => {
            const numA = parseInt(a.invoiceNo) || 0;
            const numB = parseInt(b.invoiceNo) || 0;
            return numB - numA;
        });

        // OPTIMIZATION: Fetch all returns once
        const allReturns = await db.getAllReturns();
        const returnsByInvoice = {};
        allReturns.forEach(r => {
            if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
            returnsByInvoice[r.invoiceNo].push(r);
        });

        // Calculate returns for all invoices
        const invoicesWithReturns = customerInvoices.map((invoice) => {
            const returns = returnsByInvoice[invoice.invoiceNo] || [];
            const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
            return {
                ...invoice,
                totalReturns,
                returns,
                adjustedBalanceDue: invoice.balanceDue - totalReturns
            };
        });

        // Calculate totals with returns
        const totalInvoices = invoicesWithReturns.length;
        const totalCurrentBillAmount = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.subtotal, 0);
        const totalPaid = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
        const totalReturns = invoicesWithReturns.reduce((sum, invoice) => sum + invoice.totalReturns, 0);

        // Calculate payment breakdown totals
        const totalCashPaid = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.paymentBreakdown?.cash || 0), 0);
        const totalUpiPaid = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.paymentBreakdown?.upi || 0), 0);
        const totalAccountPaid = invoicesWithReturns.reduce((sum, invoice) => sum + (invoice.paymentBreakdown?.account || 0), 0);

        // Get adjusted balance from the most recent invoice
        const mostRecentInvoice = invoicesWithReturns[0];
        const adjustedBalanceDue = mostRecentInvoice.adjustedBalanceDue;

        // Get customer details from the most recent invoice
        const customerPhone = mostRecentInvoice.customerPhone;
        const customerAddress = mostRecentInvoice.customerAddress;

        // Create WhatsApp message with professional formatting
        const message = `*SANTHAMANI TEXTILES - ACCOUNT STATEMENT*


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*CUSTOMER DETAILS*
────────────────────────────────
👤 Customer: ${customerName}
📍 Address: ${customerAddress || 'Not specified'}
📊 Total Invoices: ${totalInvoices}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${invoicesWithReturns.map((invoice, index) => {
            const previousBalance = (invoice.previousBalance || 0) + (invoice.manualPreviousBalance || 0);

            // Build payment breakdown for each invoice
            let paymentDetails = '';
            if (invoice.paymentBreakdown) {
                const payments = [];
                if (invoice.paymentBreakdown.cash > 0) payments.push(`💵 Cash: ₹${Utils.formatCurrency(invoice.paymentBreakdown.cash)}`);
                if (invoice.paymentBreakdown.upi > 0) payments.push(`📱 UPI: ₹${Utils.formatCurrency(invoice.paymentBreakdown.upi)}`);
                if (invoice.paymentBreakdown.account > 0) payments.push(`🏦 Account: ₹${Utils.formatCurrency(invoice.paymentBreakdown.account)}`);
                paymentDetails = payments.length > 0 ? `\n💳 ${payments.join(' | ')}` : '';
            }

            // Build product details
            const productDetails = invoice.products && invoice.products.length > 0 ?
                `\n📦 *PRODUCTS:*\n${invoice.products.map((product, index) =>
                    `   ${index + 1}. ${product.description}\n      Qty: ${product.qty} × Rate: ₹${Utils.formatCurrency(product.rate)} = ₹${Utils.formatCurrency(product.amount)}`
                ).join('\n')}` : '';

            // Build return details
            const returnDetails = invoice.returns && invoice.returns.length > 0 ?
                `\n🔄 *RETURNS:*\n${invoice.returns.map((returnItem, index) =>
                    `   ${index + 1}. ${returnItem.description}\n      Qty: ${returnItem.qty} × Rate: ₹${Utils.formatCurrency(returnItem.rate)} = -₹${Utils.formatCurrency(returnItem.returnAmount)}${returnItem.reason ? `\n      Reason: ${returnItem.reason}` : ''}`
                ).join('\n')}` : '';

            return `*INVOICE #${invoice.invoiceNo}* ${index < invoicesWithReturns.length - 1 ? '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄' : ''}
📅 Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}

💰 *BILL SUMMARY:*
   Current Bill: ₹${Utils.formatCurrency(invoice.subtotal)}
   ${previousBalance > 0 ? `Previous Balance: ₹${Utils.formatCurrency(previousBalance)}` : ''}
   ${invoice.discountAmount ? `Discount Amount: -₹${Utils.formatCurrency(invoice.discountAmount)}` : ''}
   Total Amount: ₹${Utils.formatCurrency(invoice.grandTotal)}
   Amount Paid: ₹${Utils.formatCurrency(invoice.amountPaid)}${paymentDetails}
   ${invoice.totalReturns > 0 ? `Returns: -₹${Utils.formatCurrency(invoice.totalReturns)}` : ''}

${productDetails}${returnDetails}

${invoice.totalReturns > 0 ?
                    `✅ *ADJUSTED BALANCE DUE: ₹${Utils.formatCurrency(invoice.adjustedBalanceDue)}*` :
                    `✅ *BALANCE DUE: ₹${Utils.formatCurrency(invoice.balanceDue)}*`}`;
        }).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*OVERALL ACCOUNT SUMMARY*
────────────────────────────────
📊 Total Invoices: ${totalInvoices}
💰 Total Current Bill Amount: ₹${Utils.formatCurrency(totalCurrentBillAmount)}
💳 Total Amount Paid: ₹${Utils.formatCurrency(totalPaid)}
${totalCashPaid > 0 ? `   💵 Cash: ₹${Utils.formatCurrency(totalCashPaid)}` : ''}
${totalUpiPaid > 0 ? `   📱 UPI: ₹${Utils.formatCurrency(totalUpiPaid)}` : ''}
${totalAccountPaid > 0 ? `   🏦 Account: ₹${Utils.formatCurrency(totalAccountPaid)}` : ''}
${totalReturns > 0 ? `🔄 Total Returns: -₹${Utils.formatCurrency(totalReturns)}` : ''}

${totalReturns > 0 ?
                `✅ *ADJUSTED OUTSTANDING BALANCE: ₹${Utils.formatCurrency(adjustedBalanceDue)}*` :
                `✅ *OUTSTANDING BALANCE: ₹${Utils.formatCurrency(mostRecentInvoice.balanceDue)}*`}

${totalReturns > 0 ? `
*RETURN SUMMARY*
────────────────────────────────
📦 Total Return Amount: ₹${Utils.formatCurrency(totalReturns)}
` : ''}

*INVOICE NUMBERS*
────────────────────────────────
${invoicesWithReturns.map(invoice =>
                    `• #${invoice.invoiceNo} - ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')} - Due: ₹${Utils.formatCurrency(invoice.totalReturns > 0 ? invoice.adjustedBalanceDue : invoice.balanceDue)}`
                ).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*CONTACT INFORMATION*
────────────────────────────────
🏢 *SANTHAMANI TEXTILES*
📍 Palladam
📞 *Phone: 90872 93268, 9092779599*

_This is an automated statement. Please contact us for any queries._`;

        // Open WhatsApp with the message
        openWhatsApp(customerPhone, message);

    } catch (error) {
        console.error('Error sharing combined statement:', error);
        Utils.showToast('Error', 'Error sharing statement. Please try again.', 'error');
    }
}

// Share individual invoice via WhatsApp with Mobile-Optimized Box Alignment & Full Details
async function shareInvoiceViaWhatsApp(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        const payments = await db.getPaymentsByInvoice(invoiceNo);

        if (!invoiceData) {
            Utils.showToast('Error', 'Invoice not found!', 'error');
            return;
        }

        // Re-use the PDF generation but share instead of download
        await generatePDFStatement(invoiceData, payments, true);

    } catch (error) {
        console.error('Error sharing invoice statement:', error);
        Utils.showToast('Error', 'Error sharing statement. Please try again.', 'error');
    }
}

// One-click solution with automatic clipboard
function openWhatsApp(phoneNumber, message) {
    // Clean phone number and add country code for India
    let cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : '';

    // Add country code if missing
    if (cleanPhone && !cleanPhone.startsWith('91')) {
        // Remove leading 0 if present and add country code
        cleanPhone = cleanPhone.replace(/^0+/, '');
        if (!cleanPhone.startsWith('91')) {
            cleanPhone = '91' + cleanPhone;
        }
    }

    if (!cleanPhone) {
        Utils.showToast('Error', 'Customer phone number not found. Please check customer details.', 'error');
        return;
    }

    // Validate phone number length (should be 12 digits: 91 + 10 digit number)
    if (cleanPhone.length !== 12) {
        Utils.showToast('Error', `Invalid phone number format. Please ensure it's a 10-digit Indian number. Current: ${cleanPhone}`, 'error');
        return;
    }

    // Always copy to clipboard first
    copyToClipboard(message);

    // Then open WhatsApp
    message += '\n\nSoftware created by Sabarish R.\nFor custom billing solutions, contact: 7845081278';
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    const newWindow = window.open(whatsappUrl, '_blank');

    if (!newWindow) {
        Utils.showToast('Success', 'Message copied to clipboard! Popup was blocked - please open WhatsApp manually and paste the message.', 'success');
    } else {
        setTimeout(() => {
            Utils.showToast('Success', 'Message copied to clipboard! If not auto-pasted in WhatsApp, click in chat and press Ctrl+V (Windows) or Cmd+V (Mac).', 'success');
        }, 1000);
    }
}


// Enhanced clipboard function
function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(resolve).catch(reject);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                resolve();
            } catch (err) {
                reject(err);
            }
            document.body.removeChild(textArea);
        }
    });
}




// Add payment to an invoice with multiple payment methods
async function addPayment(invoiceNo) {
    // Create a custom dialog for payment input with multiple payment methods
    const paymentDialog = document.createElement('div');
    paymentDialog.className = 'payment-dialog-overlay';
    paymentDialog.innerHTML = `
        <div class="payment-dialog">
            <h3>Add Payment - Invoice #${invoiceNo}</h3>
            <div class="payment-form">
                <div class="payment-methods-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin: 15px 0; padding: 15px; background: #f4f6f8; border-radius: 8px; border: 1px solid #e0e4e8;">
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 12px; font-weight: 600; color: #495057; display: flex; align-items: center; gap: 6px;"><i class="fas fa-money-bill-wave" style="color: #28a745;"></i> CASH</label>
                        <input type="number" id="cashPayment" step="0.01" min="0" placeholder="0.00" value="0" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; text-align: right;">
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 12px; font-weight: 600; color: #495057; display: flex; align-items: center; gap: 6px;"><i class="fas fa-mobile-alt" style="color: #007bff;"></i> UPI</label>
                        <input type="number" id="upiPayment" step="0.01" min="0" placeholder="0.00" value="0" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; text-align: right;">
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <label style="font-size: 12px; font-weight: 600; color: #495057; display: flex; align-items: center; gap: 6px;"><i class="fas fa-university" style="color: #6f42c1;"></i> ACCOUNT</label>
                        <input type="number" id="accountPayment" step="0.01" min="0" placeholder="0.00" value="0" style="width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px; text-align: right;">
                    </div>
                    
                    <div style="display: flex; flex-direction: column; justify-content: flex-end;">
                        <div style="display: flex; justify-content: space-between; align-items: center; background: #e7f3ff; padding: 8px 12px; border-radius: 4px; border: 1px solid #b3d9ff; height: 38px;">
                            <span style="font-size: 13px; font-weight: bold; color: #2c3e50;">Total:</span>
                            <span id="totalPaymentAmount" style="color: #007bff; font-weight: bold; font-size: 15px;">₹0.00</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="paymentDate">Payment Date:</label>
                    <input type="date" id="paymentDate" value="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div class="payment-dialog-actions">
                    <button id="confirmPayment" class="btn-confirm">Add Payment</button>
                    <button id="cancelPayment" class="btn-cancel">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(paymentDialog);

    // Add focus styles to inputs
    const paymentInputs = paymentDialog.querySelectorAll('input[type="number"]');
    paymentInputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.style.borderColor = '#007bff';
            this.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.25)';
        });
        input.addEventListener('blur', function () {
            this.style.borderColor = '#ced4da';
            this.style.boxShadow = 'none';
        });
    });

    // Add event listeners for payment inputs to update total
    const updateTotalPayment = () => {
        const cash = parseFloat(document.getElementById('cashPayment').value) || 0;
        const upi = parseFloat(document.getElementById('upiPayment').value) || 0;
        const account = parseFloat(document.getElementById('accountPayment').value) || 0;
        const total = cash + upi + account;
        document.getElementById('totalPaymentAmount').textContent = `₹${Utils.formatCurrency(total)}`;
    };

    document.getElementById('cashPayment').addEventListener('input', updateTotalPayment);
    document.getElementById('upiPayment').addEventListener('input', updateTotalPayment);
    document.getElementById('accountPayment').addEventListener('input', updateTotalPayment);

    // Focus on first payment input
    setTimeout(() => {
        document.getElementById('cashPayment').focus();
    }, 100);

    // Return a promise to handle the payment
    return new Promise((resolve) => {
        document.getElementById('confirmPayment').addEventListener('click', async function () {
            const cashAmount = parseFloat(document.getElementById('cashPayment').value) || 0;
            const upiAmount = parseFloat(document.getElementById('upiPayment').value) || 0;
            const accountAmount = parseFloat(document.getElementById('accountPayment').value) || 0;
            
            const dateInput = document.getElementById('paymentDate').value;
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0]; // 'HH:MM:SS'
            const paymentDate = dateInput ? `${dateInput}T${timeString}` : '';

            const totalPayment = cashAmount + upiAmount + accountAmount;

            if (totalPayment <= 0) {
                Utils.showToast('Warning', 'Please enter a valid payment amount in at least one payment method.', 'warning');
                return;
            }

            if (!paymentDate) {
                Utils.showToast('Warning', 'Please select a payment date.', 'warning');
                return;
            }

            try {

                showLoading('Processing Payment', 'Updating invoice and customer records...');

                const invoiceData = await db.getInvoice(invoiceNo);
                if (invoiceData) {
                    // Update invoice payment breakdown
                    const currentPaymentBreakdown = invoiceData.paymentBreakdown || {
                        cash: 0,
                        upi: 0,
                        account: 0
                    };

                    // Add new payments to existing breakdown
                    const updatedPaymentBreakdown = {
                        cash: currentPaymentBreakdown.cash + cashAmount,
                        upi: currentPaymentBreakdown.upi + upiAmount,
                        account: currentPaymentBreakdown.account + accountAmount
                    };

                    // Update invoice totals
                    const newAmountPaid = invoiceData.amountPaid + totalPayment;
                    invoiceData.amountPaid = newAmountPaid;
                    invoiceData.balanceDue = invoiceData.grandTotal - newAmountPaid;
                    invoiceData.paymentBreakdown = updatedPaymentBreakdown;

                    await db.saveInvoice(invoiceData);

                    // Save individual payment records
                    if (cashAmount > 0) {
                        const cashPaymentData = {
                            invoiceNo: invoiceNo,
                            paymentDate: paymentDate,
                            amount: cashAmount,
                            paymentMethod: 'cash',
                            paymentType: 'additional'
                        };
                        await db.savePayment(cashPaymentData);
                    }

                    if (upiAmount > 0) {
                        const upiPaymentData = {
                            invoiceNo: invoiceNo,
                            paymentDate: paymentDate,
                            amount: upiAmount,
                            paymentMethod: 'gpay',
                            paymentType: 'additional'
                        };
                        await db.savePayment(upiPaymentData);
                    }

                    if (accountAmount > 0) {
                        const accountPaymentData = {
                            invoiceNo: invoiceNo,
                            paymentDate: paymentDate,
                            amount: accountAmount,
                            paymentMethod: 'account',
                            paymentType: 'additional'
                        };
                        await db.savePayment(accountPaymentData);
                    }

                    // Update all subsequent invoices
                    await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);


                    hideLoading();

                    document.body.removeChild(paymentDialog);

                    showLoading('Payment Successful', 'Refreshing invoice list...');
                    setTimeout(() => {
                        hideLoading();
                        loadInvoices();
                    }, 1000);

                    // Show success message with payment breakdown
                    let successMessage = `Payment of ₹${Utils.formatCurrency(totalPayment)} added successfully!`;
                    const paymentMethods = [];
                    if (cashAmount > 0) paymentMethods.push(`Cash: ₹${Utils.formatCurrency(cashAmount)}`);
                    if (upiAmount > 0) paymentMethods.push(`UPI: ₹${Utils.formatCurrency(upiAmount)}`);
                    if (accountAmount > 0) paymentMethods.push(`Account: ₹${Utils.formatCurrency(accountAmount)}`);

                    if (paymentMethods.length > 0) {
                        successMessage += `\nBreakdown: ${paymentMethods.join(', ')}`;
                    }

                    Utils.showToast('Success', successMessage, 'success');
                    loadInvoices(); // Refresh the list
                    resolve(true);
                } else {
                    hideLoading();
                    Utils.showToast('Error', 'Invoice not found!', 'error');
                    resolve(false);
                }
            } catch (error) {
                hideLoading();
                console.error('Error adding payment:', error);
                Utils.showToast('Error', 'Error adding payment.', 'error');
                resolve(false);
            }
        });

        document.getElementById('cancelPayment').addEventListener('click', function () {
            document.body.removeChild(paymentDialog);
            resolve(false);
        });

        // Close on overlay click
        paymentDialog.addEventListener('click', function (e) {
            if (e.target === paymentDialog) {
                document.body.removeChild(paymentDialog);
                resolve(false);
            }
        });
    });
}





// In invoice-history.js - Update viewPaymentHistory function
async function viewPaymentHistory(invoiceNo) {
    try {
        const payments = await db.getPaymentsByInvoice(invoiceNo);
        const invoiceData = await db.getInvoice(invoiceNo);

        if (payments.length === 0) {
            Utils.showToast('Notification', 'No payment records found for this invoice.', 'info');
            return;
        }

        const paymentHistoryHTML = `
            <div class="payment-history-dialog">
                <div class="payment-history-header">
                    <h3>Payment History - Invoice #${invoiceNo}</h3>
                    <button class="close-payment-history">&times;</button>
                </div>
                <div class="payment-history-content">
                    <div class="customer-info">
                        <h4>${invoiceData.customerName}</h4>
                        <p>Total Payments: ${payments.length}</p>
                        <p>Current Balance Due: ₹${Utils.formatCurrency(invoiceData.balanceDue)}</p>
                    </div>
                    
                    <div class="payments-list">
                        ${payments.map((payment, index) => {
            // Ensure we have a valid payment ID
            const paymentId = payment.id || payment.docId || `payment_${index}`;
            return `
                            <div class="payment-record" data-payment-id="${paymentId}">
                                <div class="payment-record-header">
                                    <strong>Payment #${index + 1}</strong>
                                    <span class="payment-date">${new Date(payment.paymentDate).toLocaleDateString('en-IN')}</span>
                                </div>
                                <div class="payment-details">
                                    <p><strong>Amount:</strong> ₹${Utils.formatCurrency(payment.amount)}</p>
                                    <p><strong>Method:</strong> ${payment.paymentMethod ? payment.paymentMethod.toUpperCase() : 'CASH'}</p>
                                    <p><strong>Type:</strong> ${payment.paymentType === 'initial' ? 'Initial Payment' : 'Additional Payment'}</p>
                                    <p><strong>Date:</strong> ${new Date(payment.paymentDate).toLocaleString('en-IN')}</p>
                                    <p><strong>Payment ID:</strong> ${paymentId}</p>
                                </div>
                                <div class="payment-actions">
                                    <button class="btn-undo-payment" onclick="undoPayment('${paymentId}', '${invoiceNo}')">
                                        <i class="fas fa-undo"></i> Undo This Payment
                                    </button>
                                </div>
                            </div>
                            `;
        }).join('')}
                    </div>

                    </div>
                    <div class="payment-total">
                        <strong>Total Amount Paid: ₹${Utils.formatCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0))}</strong>
                    </div>
                    
                    <div class="bulk-actions">
                        
                    </div>
                </div>
        `;

        const paymentHistoryDialog = document.createElement('div');
        paymentHistoryDialog.className = 'payment-history-overlay';
        paymentHistoryDialog.innerHTML = paymentHistoryHTML;

        document.body.appendChild(paymentHistoryDialog);

        paymentHistoryDialog.querySelector('.close-payment-history').addEventListener('click', () => {
            document.body.removeChild(paymentHistoryDialog);
        });

        paymentHistoryDialog.addEventListener('click', (e) => {
            if (e.target === paymentHistoryDialog) {
                document.body.removeChild(paymentHistoryDialog);
            }
        });

    } catch (error) {
        console.error('Error viewing payment history:', error);
        Utils.showToast('Error', 'Error loading payment history.', 'error');
    }
}



// Update undoPayment function
async function undoPayment(paymentId, invoiceNo) {
    console.log('Undoing payment with ID:', paymentId);

    if (!confirm('Are you sure you want to undo this payment? This will add the payment amount back to the balance due.')) {
        return;
    }

    try {
        showLoading('Undoing Payment', 'Reverting payment and recalculating balance...');
        // Get payment details before deleting
        const payments = await db.getPaymentsByInvoice(invoiceNo);

        // Try to find the payment by different ID formats
        let paymentToDelete = payments.find(p => p.id === paymentId);
        if (!paymentToDelete) {
            paymentToDelete = payments.find(p => p.id === paymentId.toString());
        }
        if (!paymentToDelete) {
            // Try without the "payment_" prefix
            const cleanId = paymentId.replace('payment_', '');
            paymentToDelete = payments.find(p => p.id === cleanId);
        }

        if (!paymentToDelete) {
            console.log('Available payments:', payments);
            Utils.showToast('Error', `Payment not found! Looking for ID: ${paymentId}. Available IDs: ${payments.map(p => p.id).join(', ')}`, 'error');
            return;
        }

        console.log('Found payment to delete:', paymentToDelete);

        // Delete the payment record
        await db.deletePayment(paymentToDelete.id);

        Utils.showToast('Success', `Payment of ₹${Utils.formatCurrency(paymentToDelete.amount)} has been successfully undone!`, 'success');

        // Close the dialog and refresh the display
        const paymentHistoryDialog = document.querySelector('.payment-history-overlay');
        if (paymentHistoryDialog) {
            document.body.removeChild(paymentHistoryDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing payment:', error);
        Utils.showToast('Error', 'Error undoing payment: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}


// Update undoAllPayments function
async function undoAllPayments(invoiceNo) {
    if (!confirm('Are you sure you want to undo ALL payments for this invoice? This will set the balance due back to the original invoice amount.')) {
        return;
    }

    try {
        showLoading('Undoing All Payments', 'Reverting all payments and recalculating balance...');
        const payments = await db.getPaymentsByInvoice(invoiceNo);

        if (payments.length === 0) {
            Utils.showToast('Notification', 'No payments found for this invoice.', 'info');
            return;
        }

        // Get invoice data
        const invoiceData = await db.getInvoice(invoiceNo);
        const totalPaymentAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);

        // Delete all payment records
        for (const payment of payments) {
            await db.deletePayment(payment.id);
        }

        // Reset invoice payment information
        invoiceData.amountPaid = 0;
        invoiceData.balanceDue = invoiceData.grandTotal;
        invoiceData.paymentBreakdown = {
            cash: 0,
            upi: 0,
            account: 0
        };

        await db.saveInvoice(invoiceData);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        Utils.showToast('Success', `All ${payments.length} payments (total: ₹${Utils.formatCurrency(totalPaymentAmount)}) have been successfully undone!`, 'success');

        // Close the dialog and refresh the display
        const paymentHistoryDialog = document.querySelector('.payment-history-overlay');
        if (paymentHistoryDialog) {
            document.body.removeChild(paymentHistoryDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing all payments:', error);
        Utils.showToast('Error', 'Error undoing payments. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}


// Delete payment record from database
async function deletePayment(paymentId) {
    return new Promise((resolve, reject) => {
        const transaction = db.db.transaction(['payments'], 'readwrite');
        const store = transaction.objectStore('payments');
        const request = store.delete(paymentId);

        request.onsuccess = () => {
            console.log('Payment deleted successfully');
            resolve();
        };

        request.onerror = () => {
            console.error('Error deleting payment');
            reject(request.error);
        };
    });
}


// Add Return to an invoice - UPDATED to show current adjusted balance
// SIMPLER SOLUTION: Store products in dialog dataset
async function addReturn(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (!invoiceData) {
            Utils.showToast('Error', 'Invoice not found!', 'error');
            return;
        }

        // Calculate current returns to get adjusted balance
        const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
        const currentAdjustedBalance = invoiceData.balanceDue - totalReturns;

        // Create return dialog
        const returnDialog = document.createElement('div');
        returnDialog.className = 'return-dialog-overlay';
        returnDialog.innerHTML = `
            <div class="return-dialog" data-products='${JSON.stringify(invoiceData.products || [])}'>
                <div class="return-dialog-header">
                    <h3>Process Return - Invoice #${invoiceNo}</h3>
                    <button class="close-return-dialog">&times;</button>
                </div>
                
                <div class="return-customer-info">
                    <h4>Customer: ${invoiceData.customerName}</h4>
                    <p>Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}</p>
                    ${totalReturns > 0 ? `<p style="color: #dc3545; font-weight: bold;">Previous Returns: ₹${Utils.formatCurrency(totalReturns)}</p>` : ''}
                </div>

                <div class="return-form-section">
                    <div class="form-group">
                        <label for="returnDate">Return Date:</label>
                        <input type="date" id="returnDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <div class="return-products-section">
                        <h4>Return Products</h4>
                        <div class="return-products-list" id="returnProductsList">
                            </div>
                        <button type="button" class="btn-add-return-item" onclick="addReturnItemFromDialog()">
                            <i class="fas fa-plus"></i> Add Return Item
                        </button>
                    </div>

                    <div class="return-summary">
                        <div class="summary-item">
                            <span>Original Balance Due:</span>
                            <span>₹${Utils.formatCurrency(invoiceData.balanceDue)}</span>
                        </div>
                        ${totalReturns > 0 ? `
                        <div class="summary-item">
                            <span>Previous Returns:</span>
                            <span style="color: #dc3545;">-₹${Utils.formatCurrency(totalReturns)}</span>
                        </div>
                        <div class="summary-item">
                            <span>Current Balance Before This Return:</span>
                            <span>₹${Utils.formatCurrency(currentAdjustedBalance)}</span>
                        </div>
                        ` : ''}
                        <div class="summary-item">
                            <span>This Return Amount:</span>
                            <span id="totalReturnAmount">₹0.00</span>
                        </div>
                        <div class="summary-item total">
                            <span>New Adjusted Balance Due:</span>
                            <span id="adjustedBalanceDue">₹${Utils.formatCurrency(currentAdjustedBalance)}</span>
                        </div>
                    </div>

                    <div class="return-dialog-actions">
                        <button type="button" class="btn-save-return" onclick="saveReturn('${invoiceNo}')">
                            <i class="fas fa-save"></i> Save Return
                        </button>

                        <button type="button" class="btn-cancel-return">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(returnDialog);

        // Store the current adjusted balance in a data attribute for calculations
        returnDialog.querySelector('.return-dialog').dataset.currentBalance = currentAdjustedBalance;

        // Initialize with one return item
        addReturnItemFromDialog();

        // Event listeners
        returnDialog.querySelector('.close-return-dialog').addEventListener('click', () => {
            document.body.removeChild(returnDialog);
        });

        returnDialog.querySelector('.btn-cancel-return').addEventListener('click', () => {
            document.body.removeChild(returnDialog);
        });

        returnDialog.addEventListener('click', (e) => {
            if (e.target === returnDialog) {
                document.body.removeChild(returnDialog);
            }
        });

    } catch (error) {
        console.error('Error opening return dialog:', error);
        Utils.showToast('Error', 'Error processing return.', 'error');
    }
}

// Simple function to add return item using products from dialog dataset
function addReturnItemFromDialog() {
    const returnDialog = document.querySelector('.return-dialog');
    if (!returnDialog) return;

    const productsData = returnDialog.dataset.products;
    const originalProducts = productsData ? JSON.parse(productsData) : [];

    addReturnItem(originalProducts);
}


// Add return item row
function addReturnItem(originalProducts = []) {
    const returnProductsList = document.getElementById('returnProductsList');
    const itemIndex = returnProductsList.children.length;

    const returnItemHTML = `
        <div class="return-item" data-index="${itemIndex}">
            <div class="return-item-header">
                <span>Return Item ${itemIndex + 1}</span>
                <button type="button" class="btn-remove-return-item" onclick="removeReturnItem(${itemIndex})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="return-item-fields" style="display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e9ecef; margin-bottom: 10px;">
                <div class="form-group" style="flex: 3; min-width: 200px; margin-bottom: 0;">
                    <label for="productDescription${itemIndex}" style="font-size: 12px;">Product Description:</label>
                    <select id="productDescription${itemIndex}" class="product-description-select" onchange="updateReturnProductInfo(${itemIndex})" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px;">
                        <option value="">-- Select from invoice or enter custom --</option>
                        ${originalProducts.map(product =>
        `<option value="${product.description}" data-rate="${product.rate}" data-maxqty="${product.qty}">
                                ${product.description} (Avail: ${product.qty} @ ₹${Utils.formatCurrency(product.rate)})
                            </option>`
    ).join('')}
                        <option value="custom">-- Enter Custom Product --</option>
                    </select>
                    <input type="text" id="customProduct${itemIndex}" class="custom-product-input" placeholder="Enter custom product" style="display: none; width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; margin-top: 5px;">
                </div>

                <div class="form-group" style="flex: 1; min-width: 70px; margin-bottom: 0;">
                    <label for="returnQty${itemIndex}" style="font-size: 12px;">Qty:</label>
                    <input type="number" id="returnQty${itemIndex}" class="return-qty" min="0" step="1" value="0" onchange="calculateReturnAmount(${itemIndex})" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px;">
                </div>

                <div class="form-group" style="flex: 1.5; min-width: 90px; margin-bottom: 0;">
                    <label for="returnRate${itemIndex}" style="font-size: 12px;">Rate (₹):</label>
                    <input type="number" id="returnRate${itemIndex}" class="return-rate" min="0" step="0.01" value="0" onchange="calculateReturnAmount(${itemIndex})" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px;">
                </div>

                <div class="form-group" style="flex: 1.5; min-width: 90px; margin-bottom: 0;">
                    <label for="returnAmount${itemIndex}" style="font-size: 12px;">Amount (₹):</label>
                    <input type="number" id="returnAmount${itemIndex}" class="return-amount" readonly value="0" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px; background: #e9ecef;">
                </div>

                <div class="form-group" style="flex: 2; min-width: 120px; margin-bottom: 0;">
                    <label for="returnReason${itemIndex}" style="font-size: 12px;">Reason:</label>
                    <input type="text" id="returnReason${itemIndex}" class="return-reason" placeholder="Reason for return" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 13px;">
                </div>
            </div>
        </div>
    `;

    returnProductsList.insertAdjacentHTML('beforeend', returnItemHTML);
}

// Remove return item
function removeReturnItem(index) {
    const returnItem = document.querySelector(`.return-item[data-index="${index}"]`);
    if (returnItem) {
        returnItem.remove();
        updateReturnSummary();
    }
}

// Update product info when selection changes
function updateReturnProductInfo(index) {
    const select = document.getElementById(`productDescription${index}`);
    const customInput = document.getElementById(`customProduct${index}`);
    const rateInput = document.getElementById(`returnRate${index}`);
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption.value === 'custom') {
        customInput.style.display = 'block';
        customInput.value = '';
        rateInput.value = '0';
    } else {
        customInput.style.display = 'none';
        if (selectedOption.dataset.rate) {
            rateInput.value = selectedOption.dataset.rate;
            calculateReturnAmount(index);
        }
    }
}

// Calculate return amount for an item
function calculateReturnAmount(index) {
    const qty = parseFloat(document.getElementById(`returnQty${index}`).value) || 0;
    const rate = parseFloat(document.getElementById(`returnRate${index}`).value) || 0;
    const amount = qty * rate;

    document.getElementById(`returnAmount${index}`).value = amount.toFixed(2);
    updateReturnSummary();
}

// Update return summary - FIXED to use current adjusted balance
function updateReturnSummary() {
    let totalReturnAmount = 0;
    const returnItems = document.querySelectorAll('.return-item');

    returnItems.forEach(item => {
        const amount = parseFloat(item.querySelector('.return-amount').value) || 0;
        totalReturnAmount += amount;
    });

    document.getElementById('totalReturnAmount').textContent = `₹${Utils.formatCurrency(totalReturnAmount)}`;

    // Get current balance from data attribute instead of original balance
    const returnDialog = document.querySelector('.return-dialog');
    const currentBalance = parseFloat(returnDialog.dataset.currentBalance) || 0;
    const newAdjustedBalance = currentBalance - totalReturnAmount;

    document.getElementById('adjustedBalanceDue').textContent = `₹${Utils.formatCurrency(newAdjustedBalance)}`;
}


// Save return - UPDATED to handle multiple returns correctly
async function saveReturn(invoiceNo) {
    const saveButton = document.querySelector('.btn-save-return');
    if (saveButton) {
        if (saveButton.disabled) return;
        saveButton.disabled = true;
    }

    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        const returnDate = document.getElementById('returnDate').value;
        const returnItems = document.querySelectorAll('.return-item');

        if (!returnDate) {
            Utils.showToast('Warning', 'Please select a return date.', 'warning');
            if (saveButton) saveButton.disabled = false;
            return;
        }

        if (returnItems.length === 0) {
            Utils.showToast('Warning', 'Please add at least one return item.', 'warning');
            if (saveButton) saveButton.disabled = false;
            return;
        }

        const returns = [];
        let totalReturnAmount = 0;

        // Collect return items
        for (const item of returnItems) {
            const index = item.dataset.index;
            const descriptionSelect = document.getElementById(`productDescription${index}`);
            const customInput = document.getElementById(`customProduct${index}`);
            const description = descriptionSelect.value === 'custom' ? customInput.value : descriptionSelect.value;
            const qty = parseFloat(document.getElementById(`returnQty${index}`).value) || 0;
            const rate = parseFloat(document.getElementById(`returnRate${index}`).value) || 0;
            const amount = parseFloat(document.getElementById(`returnAmount${index}`).value) || 0;
            const reason = document.getElementById(`returnReason${index}`).value;

            if (!description || qty <= 0 || rate <= 0) {
                Utils.showToast('Warning', 'Please fill all required fields for return item ' + (parseInt(index) + 1), 'warning');
                if (saveButton) saveButton.disabled = false;
                return;
            }

            // Check if returning more than available quantity for invoice products
            if (descriptionSelect.value !== 'custom' && descriptionSelect.value !== '') {
                const selectedOption = descriptionSelect.options[descriptionSelect.selectedIndex];
                const maxQty = parseFloat(selectedOption.dataset.maxqty) || 0;
                const alreadyReturnedQty = await getAlreadyReturnedQty(invoiceNo, description);

                if ((qty + alreadyReturnedQty) > maxQty) {
                    Utils.showToast('Error', `Cannot return ${qty} items. Only ${maxQty - alreadyReturnedQty} items available for return for "${description}".`, 'error');
                    if (saveButton) saveButton.disabled = false;
                    return;
                }
            }

            returns.push({
                description,
                qty,
                rate,
                returnAmount: amount,
                reason,
                returnDate
            });

            totalReturnAmount += amount;
        }

        // Validate that return amount doesn't exceed current balance
        const currentReturns = await Utils.calculateTotalReturns(invoiceNo);
        const currentBalance = invoiceData.balanceDue - currentReturns;

        if (totalReturnAmount > currentBalance) {
            Utils.showToast('Error', `Return amount (₹${Utils.formatCurrency(totalReturnAmount)}) cannot exceed current balance (₹${Utils.formatCurrency(currentBalance)})`, 'error');
            if (saveButton) saveButton.disabled = false;
            return;
        }

        showLoading('Processing Return', 'Saving return data...');

        // Save return records
        for (const returnItem of returns) {
            const returnData = {
                invoiceNo: invoiceNo,
                customerName: invoiceData.customerName,
                ...returnItem,
                createdAt: new Date().toISOString()
            };
            await db.saveReturn(returnData);
        }

        // Update invoice with return information
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        hideLoading();
        Utils.showToast('Success', `Return processed successfully! Total return amount: ₹${Utils.formatCurrency(totalReturnAmount)}`, 'success');

        // Close dialog and refresh
        const dialog = document.querySelector('.return-dialog-overlay');
        if (dialog) dialog.remove();
        loadInvoices();

    } catch (error) {
        hideLoading();
        const saveButton = document.querySelector('.btn-save-return');
        if (saveButton) saveButton.disabled = false;
        console.error('Error saving return:', error);
        Utils.showToast('Error', 'Error processing return.', 'error');
    }
}


// Helper function to get already returned quantity for a product
async function getAlreadyReturnedQty(invoiceNo, productDescription) {
    try {
        const returns = await db.getReturnsByInvoice(invoiceNo);
        const productReturns = returns.filter(returnItem =>
            returnItem.description === productDescription
        );

        return productReturns.reduce((total, returnItem) => total + returnItem.qty, 0);
    } catch (error) {
        console.error('Error getting already returned quantity:', error);
        return 0;
    }
}

// View return status with undo option
async function viewReturnStatus(invoiceNo) {
    try {
        const returns = await db.getReturnsByInvoice(invoiceNo);
        const invoiceData = await db.getInvoice(invoiceNo);

        if (returns.length === 0) {
            Utils.showToast('Notification', 'No return records found for this invoice.', 'info');
            return;
        }

        const returnStatusHTML = `
            <div class="return-status-dialog">
                <div class="return-status-header">
                    <h3>Return Status - Invoice #${invoiceNo}</h3>
                    <button class="close-return-status">&times;</button>
                </div>
                <div class="return-status-content">
                    <div class="customer-info">
                        <h4>${invoiceData.customerName}</h4>
                        <p>Total Returns: ${returns.length}</p>
                    </div>
                    
                    <div class="returns-list">
                        ${returns.map((returnItem, index) => `
                            <div class="return-record" data-return-id="${returnItem.id}">
                                <div class="return-record-header">
                                    <strong>Return #${index + 1}</strong>
                                    <span class="return-date">${new Date(returnItem.returnDate).toLocaleDateString('en-IN')}</span>
                                </div>
                                <div class="return-details">
                                    <p><strong>Product:</strong> ${returnItem.description}</p>
                                    <p><strong>Quantity:</strong> ${returnItem.qty}</p>
                                    <p><strong>Rate:</strong> ₹${Utils.formatCurrency(returnItem.rate)}</p>
                                    <p><strong>Amount:</strong> ₹${Utils.formatCurrency(returnItem.returnAmount)}</p>
                                    <p><strong>Reason:</strong> ${returnItem.reason}</p>
                                </div>
                                <div class="return-actions">
                                    <button class="btn-undo-return" onclick="undoReturn('${returnItem.id}', '${invoiceNo}')">
                                        <i class="fas fa-undo"></i> Undo This Return
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    </div>
                    <div class="return-total">
                        <strong>Total Return Amount: ₹${Utils.formatCurrency(returns.reduce((sum, item) => sum + item.returnAmount, 0))}</strong>
                    </div>
                    
                    <div class="bulk-actions">
                        
                    </div>
                </div>
        `;

        const existingDialog = document.querySelector('.return-status-overlay');
        if (existingDialog) {
            existingDialog.remove();
        }

        const returnStatusDialog = document.createElement('div');
        returnStatusDialog.className = 'return-status-overlay';
        returnStatusDialog.innerHTML = returnStatusHTML;

        document.body.appendChild(returnStatusDialog);

        returnStatusDialog.querySelector('.close-return-status').addEventListener('click', () => {
            document.body.removeChild(returnStatusDialog);
        });

        returnStatusDialog.addEventListener('click', (e) => {
            if (e.target === returnStatusDialog) {
                document.body.removeChild(returnStatusDialog);
            }
        });

    } catch (error) {
        console.error('Error viewing return status:', error);
        Utils.showToast('Error', 'Error loading return status.', 'error');
    }
}



// Undo a specific return
async function undoReturn(returnId, invoiceNo) {
    if (!confirm('Are you sure you want to undo this return? This action cannot be reversed.')) {
        return;
    }

    try {
        showLoading('Undoing Return', 'Reverting return and recalculating balance...');
        // Delete the return record
        await db.deleteReturn(returnId);

        // Update invoice with recalculated returns
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Get invoice data for customer name
        const invoiceData = await db.getInvoice(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        Utils.showToast('Success', 'Return has been successfully undone!', 'success');

        // Close the dialog and refresh the display
        const returnStatusDialog = document.querySelector('.return-status-overlay');
        if (returnStatusDialog) {
            document.body.removeChild(returnStatusDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing return:', error);
        Utils.showToast('Error', 'Error undoing return. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}


// Undo all returns for an invoice
async function undoAllReturns(invoiceNo) {
    if (!confirm('Are you sure you want to undo ALL returns for this invoice? This action cannot be reversed.')) {
        return;
    }

    try {
        showLoading('Undoing All Returns', 'Reverting all returns and recalculating balance...');
        const returns = await db.getReturnsByInvoice(invoiceNo);

        if (returns.length === 0) {
            Utils.showToast('Notification', 'No returns found for this invoice.', 'info');
            return;
        }

        // Delete all return records
        for (const returnItem of returns) {
            await db.deleteReturn(returnItem.id);
        }

        // Update invoice with recalculated returns (should be 0 now)
        await Utils.updateInvoiceWithReturns(invoiceNo);

        // Get invoice data for customer name
        const invoiceData = await db.getInvoice(invoiceNo);

        // Update all subsequent invoices
        await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

        Utils.showToast('Success', `All ${returns.length} returns have been successfully undone!`, 'success');

        // Close the dialog and refresh the display
        const returnStatusDialog = document.querySelector('.return-status-overlay');
        if (returnStatusDialog) {
            document.body.removeChild(returnStatusDialog);
        }

        // Refresh the invoices list
        loadInvoices();

    } catch (error) {
        console.error('Error undoing all returns:', error);
        Utils.showToast('Error', 'Error undoing returns. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}



// Generate statement for an invoice with PDF download
async function generateStatement(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        const payments = await db.getPaymentsByInvoice(invoiceNo);

        if (invoiceData) {
            await generatePDFStatement(invoiceData, payments);
        } else {
            Utils.showToast('Error', 'Invoice not found!', 'error');
        }
    } catch (error) {
        console.error('Error generating statement:', error);
        Utils.showToast('Error', 'Error generating statement.', 'error');
    }
}



// Generate PDF statement with organized file naming - SIMPLE & PROFESSIONAL
async function generatePDFStatement(invoiceData, payments, share = false) {
    try {
        // Calculate returns for this invoice
        const totalReturns = await Utils.calculateTotalReturns(invoiceData.invoiceNo);
        const adjustedBalanceDue = invoiceData.balanceDue - totalReturns;

        // Create PDF document
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Set initial y position
        let yPos = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);

        // Simple color scheme
        const primaryColor = [0, 0, 0]; // Black
        const accentColor = [0, 100, 0]; // Dark Green
        const grayColor = [100, 100, 100]; // Gray

        // Add Watermark and Logo if available
        if (typeof PDFGenerator !== 'undefined' && PDFGenerator.checkImageExists()) {
            const logoBase64 = PDFGenerator.getImageBase64();
            // Watermark
            doc.setGState(new doc.GState({opacity: 0.1}));
            doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 75, pageHeight / 2 - 75, 150, 150);
            doc.setGState(new doc.GState({opacity: 1.0}));
            // Logo in header
            doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - 15, yPos, 30, 25);
            yPos += 30; // Push text down
        }

        // HEADER
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('SANTHAMANI TEXTILES', pageWidth / 2, yPos, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('No.16/1, 25A, Thirumalai Nagar South, 1st Street, TIRUPUR - 641 602.', pageWidth / 2, yPos + 5, { align: 'center' });
        doc.text('Cell: 90872 93268, 9092779599', pageWidth / 2, yPos + 10, { align: 'center' });

        yPos += 20;

        // TITLE
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('ACCOUNT STATEMENT', pageWidth / 2, yPos, { align: 'center' });

        // Underline
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - 40, yPos + 2, pageWidth / 2 + 40, yPos + 2);

        yPos += 15;



        // CUSTOMER INFORMATION
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('CUSTOMER INFORMATION', margin, yPos);
        yPos += 7;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);

        doc.text(`Name: ${invoiceData.customerName}`, margin, yPos);
        yPos += 4;
        doc.text(`Invoice No: ${invoiceData.invoiceNo}`, margin, yPos);
        yPos += 4;
        doc.text(`Address: ${invoiceData.customerAddress || 'Not specified'}`, margin, yPos);
        yPos += 4;
        doc.text(`Phone: ${invoiceData.customerPhone || 'Not specified'}`, margin, yPos);
        yPos += 4;
        doc.text(`Invoice Date: ${new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}`, margin, yPos);
        yPos += 10;

        // Check if we need a new page
        if (yPos > 240) {
            doc.addPage();
            yPos = 20;
        }

        // INVOICE DETAILS
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('INVOICE DETAILS', margin, yPos);
        yPos += 6;

        // Simple underline
        doc.setDrawColor(...grayColor);
        doc.setLineWidth(0.3);
        doc.line(margin, yPos, margin + 40, yPos);
        yPos += 8;

        // Create invoice details table
        const invoiceTableHeaders = [['S.No.', 'Description', 'Qty', 'Rate', 'Amount']];
        const invoiceTableData = invoiceData.products.map((product, index) => [
            (index + 1).toString(),
            product.description,
            product.qty.toString(),
            Utils.formatCurrency(product.rate),
            Utils.formatCurrency(product.amount)
        ]);

        doc.autoTable({
            startY: yPos,
            head: invoiceTableHeaders,
            body: invoiceTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: primaryColor,
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 3,
                lineWidth: 0.3
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 12, halign: 'center' },
                1: { cellWidth: 'auto', halign: 'left' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 20, halign: 'right' },
                4: { cellWidth: 22, halign: 'right' }
            },
            margin: { left: margin, right: margin },
            styles: {
                lineColor: [200, 200, 200],
                lineWidth: 0.2
            }
        });

        yPos = doc.lastAutoTable.finalY + 8;

        // SUMMARY TOTALS
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...primaryColor);

        const currentBillAmt = invoiceData.subtotal || invoiceData.grandTotal;
        const prevBalAmt = (invoiceData.previousBalance || 0) + (invoiceData.manualPreviousBalance || 0);
        const discountAmt = parseFloat(invoiceData.discountAmount) || parseFloat(invoiceData.discount) || 0;
        const totalAmt = invoiceData.grandTotal;
        const amountPaid = invoiceData.payment?.totalPaid || invoiceData.amountPaid || 0;

        let rightAlignX = pageWidth - margin;
        
        doc.text(`Current Bill Amount: Rs. ${Utils.formatCurrency(currentBillAmt)}`, rightAlignX, yPos, { align: 'right' });
        yPos += 5;
        if (prevBalAmt > 0) {
            doc.text(`Previous Balance: Rs. ${Utils.formatCurrency(prevBalAmt)}`, rightAlignX, yPos, { align: 'right' });
            yPos += 5;
        }
        if (discountAmt > 0) {
            doc.text(`Discount Amount: -Rs. ${Utils.formatCurrency(discountAmt)}`, rightAlignX, yPos, { align: 'right' });
            yPos += 5;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`Total Amount: Rs. ${Utils.formatCurrency(totalAmt)}`, rightAlignX, yPos, { align: 'right' });
        yPos += 5;
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Amount Paid: Rs. ${Utils.formatCurrency(amountPaid)}`, rightAlignX, yPos, { align: 'right' });
        yPos += 5;

        // Balance Due
        doc.setFont('helvetica', 'bold');
        if (totalReturns > 0) {
            doc.setTextColor(220, 53, 69); // Red for returns
            doc.text(`Total Returns: -Rs. ${Utils.formatCurrency(totalReturns)}`, rightAlignX, yPos, { align: 'right' });
            yPos += 5;
            doc.setTextColor(...primaryColor);
            doc.text(`Adjusted Balance Due: Rs. ${Utils.formatCurrency(adjustedBalanceDue)}`, rightAlignX, yPos, { align: 'right' });
        } else {
            doc.text(`Balance Due: Rs. ${Utils.formatCurrency(adjustedBalanceDue)}`, rightAlignX, yPos, { align: 'right' });
        }
        yPos += 15;

        // Check if we need a new page
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }



        // Add return information if applicable
        if (totalReturns > 0) {
            // Check if we need a new page
            if (yPos > 220) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...primaryColor);
            doc.text('RETURN INFORMATION', margin, yPos);
            yPos += 7;

            // Get return details
            const returns = await db.getReturnsByInvoice(invoiceData.invoiceNo);

            if (returns.length > 0) {
                const returnTableHeaders = [['Date', 'Product', 'Qty', 'Rate', 'Amount']];
                const returnTableData = returns.map((returnItem, index) => [
                    new Date(returnItem.returnDate).toLocaleDateString('en-IN'),
                    returnItem.description,
                    returnItem.qty.toString(),
                    Utils.formatCurrency(returnItem.rate),
                    Utils.formatCurrency(returnItem.returnAmount)
                ]);

                doc.autoTable({
                    startY: yPos,
                    head: returnTableHeaders,
                    body: returnTableData,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: primaryColor,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3
                    },
                    bodyStyles: {
                        fontSize: 7,
                        cellPadding: 2,
                        lineColor: [220, 220, 220],
                        lineWidth: 0.1
                    },
                    columnStyles: {
                        0: { cellWidth: 22, halign: 'center' },
                        1: { cellWidth: 'auto', halign: 'left' },
                        2: { cellWidth: 15, halign: 'center' },
                        3: { cellWidth: 20, halign: 'right' },
                        4: { cellWidth: 22, halign: 'right' }
                    },
                    margin: { left: margin, right: margin }
                });

                yPos = doc.lastAutoTable.finalY + 10;
            }
        }

        // Check if we need a new page for payment history
        if (yPos > 200) {
            doc.addPage();
            yPos = 20;
        }

        // PAYMENT HISTORY
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('PAYMENT HISTORY', margin, yPos);
        yPos += 7;

        // Create payment history table
        const paymentTableHeaders = [['Date', 'Description', 'Amount', 'Balance']];
        const paymentTableData = generatePaymentTableData(payments, invoiceData.grandTotal, totalReturns);

        doc.autoTable({
            startY: yPos,
            head: paymentTableHeaders,
            body: paymentTableData,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: primaryColor,
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 3
            },
            bodyStyles: {
                fontSize: 8,
                cellPadding: 2,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 25, halign: 'center' },
                1: { cellWidth: 'auto', halign: 'left' },
                2: { cellWidth: 25, halign: 'right' },
                3: { cellWidth: 25, halign: 'right' }
            },
            margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;



        // FOOTER
        yPos = pageHeight - 20;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...grayColor);
        doc.text('This is a computer-generated statement. No signature is required.', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('For any queries, please contact: 90872 93268, 9092779599', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;
        doc.text('Software created by Sabarish', pageWidth / 2, yPos, { align: 'center' });

        // Generate filename and save
        const today = new Date();
        const dateFolder = today.toISOString().split('T')[0];
        const fileName = `Statement_${invoiceData.invoiceNo}_${invoiceData.customerName}_${dateFolder}.pdf`;

        if (share) {


            try {


                const pdfBlob = doc.output('blob');


                const file = new File([pdfBlob], fileName, { type: 'application/pdf' });


                


                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {


                    await navigator.share({


                        title: `Statement for Invoice #${invoiceData.invoiceNo}`,


                        text: `Please find the statement for Invoice #${invoiceData.invoiceNo} attached.`,


                        files: [file]


                    });


                    Utils.showToast('Success', 'Statement shared successfully!', 'success');


                } else {


                    Utils.showToast('Warning', 'Sharing not supported on this device. Downloading instead.', 'warning');


                    doc.save(fileName);


                }


            } catch (err) {


                if (err.name !== 'AbortError') {


                    console.error('Error sharing PDF:', err);


                    Utils.showToast('Error', 'Could not share the file.', 'error');


                }


            }


        } else {


            doc.save(fileName);


            setTimeout(() => {


                Utils.showToast('Success', `Statement saved as: ${fileName}`, 'success');


            }, 500);


        }

    } catch (error) {
        console.error('Error generating PDF statement:', error);
        throw error;
    }
}



// In the payment table data generation, update to include returns
function generatePaymentTableData(payments, grandTotal, totalReturns = 0) {
    const tableData = [];
    let runningBalance = grandTotal;

    // Sort payments by date
    payments.sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate));

    // Add initial invoice row
    tableData.push([
        new Date().toLocaleDateString('en-IN'),
        'Invoice - Goods/Services',
        Utils.formatCurrency(grandTotal),
        Utils.formatCurrency(runningBalance)
    ]);

    // Add payment rows
    payments.forEach(payment => {
        runningBalance -= payment.amount;
        tableData.push([
            new Date(payment.paymentDate).toLocaleDateString('en-IN'),
            `Payment - ${payment.paymentType === 'initial' ? 'Initial' : 'Additional'} (${payment.paymentMethod?.toUpperCase() || 'CASH'})`,
            `-Rs. ${Utils.formatCurrency(payment.amount)}`,
            Utils.formatCurrency(runningBalance)
        ]);
    });

    // Add return row if applicable
    if (totalReturns > 0) {
        runningBalance -= totalReturns;
        tableData.push([
            'Multiple Dates',
            'Product Returns',
            `-Rs. ${Utils.formatCurrency(totalReturns)}`,
            Utils.formatCurrency(runningBalance)
        ]);
    }

    return tableData;
}



// Clear filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('fromInvoiceNo').value = '';
    document.getElementById('toInvoiceNo').value = '';
    loadInvoices();
}

// Edit invoice
function editInvoice(invoiceNo) {
    window.location.href = `sales?edit=${invoiceNo}`;
}

// View invoice
function viewInvoice(invoiceNo) {
    // In a real application, you might have a dedicated view page
    // For now, we'll redirect to the main page with edit parameter
    editInvoice(invoiceNo);
}

// Generate PDF for a specific invoice
async function generateInvoicePDF(invoiceNo) {
    try {
        const invoiceData = await db.getInvoice(invoiceNo);
        if (invoiceData) {
            // Temporarily set form data to generate PDF
            const originalData = Utils.getFormData();
            Utils.setFormData(invoiceData);

            // Generate PDF
            await PDFGenerator.generatePDF();

            // Restore original form data
            Utils.setFormData(originalData);
        } else {
            Utils.showToast('Error', 'Invoice not found!', 'error');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        Utils.showToast('Error', 'Error generating PDF.', 'error');
    }
}

// Update deleteInvoice function with professional UI
async function deleteInvoice(invoiceNo) {
    try {
        const payments = await db.getPaymentsByInvoice(invoiceNo);
        const returns = await db.getReturnsByInvoice(invoiceNo);

        if ((payments && payments.length > 0) || (returns && returns.length > 0)) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Action Denied',
                    text: 'Please undo all the payment and return history first before deleting this bill.',
                    confirmButtonColor: '#3085d6'
                });
            } else {
                Utils.showToast('Action Denied', 'Please undo all the payment and return history first before deleting the bill.', 'error');
            }
            return;
        }
    } catch (err) {
        console.error("Error checking invoice history:", err);
    }

    // Create professional confirmation dialog
    const deleteDialog = document.createElement('div');
    deleteDialog.className = 'delete-dialog-overlay';
    deleteDialog.innerHTML = `
        <div class="delete-dialog">
            <div class="delete-dialog-header">
                <div class="delete-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3>Confirm Deletion</h3>
            </div>
            
            <div class="delete-dialog-content">
                <p class="delete-warning-text">
                    You are about to delete Invoice <strong>#${invoiceNo}</strong>. 
                    This action will move the item to the recycle bin:
                </p>
                
                <ul class="delete-consequences">
                    <li><i class="fas fa-file-invoice"></i> The invoice record</li>
                    <li><i class="fas fa-money-bill-wave"></i> All payment history</li>
                    <li><i class="fas fa-undo"></i> All return records</li>
                    <li><i class="fas fa-chart-line"></i> Customer balance calculations</li>
                </ul>
                
                <div class="delete-final-warning">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>This action cannot be undone!</span>
                </div>
                
                <div class="confirmation-input">
                    <label for="confirmInvoiceNo">
                        Type the invoice number <strong>${invoiceNo}</strong> to confirm:
                    </label>
                    <input type="text" id="confirmInvoiceNo" placeholder="Enter invoice number" autocomplete="off">
                </div>
            </div>
            
            <div class="delete-dialog-actions">
                <button class="btn-cancel-delete" onclick="closeDeleteDialog()">
                    <i class="fas fa-times"></i> Cancel
                </button>
                <button class="btn-confirm-delete" id="confirmDeleteBtn" disabled onclick="proceedWithDelete('${invoiceNo}')">
                    <i class="fas fa-trash"></i> Delete Permanently
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(deleteDialog);

    // Add input validation
    const confirmInput = document.getElementById('confirmInvoiceNo');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    confirmInput.addEventListener('input', function () {
        const isConfirmed = this.value.trim() === invoiceNo;
        confirmBtn.disabled = !isConfirmed;

        if (isConfirmed) {
            this.style.borderColor = '#28a745';
            this.style.boxShadow = '0 0 0 2px rgba(40, 167, 69, 0.25)';
        } else {
            this.style.borderColor = '#dc3545';
            this.style.boxShadow = '0 0 0 2px rgba(220, 53, 69, 0.25)';
        }
    });

    // Enter key support
    confirmInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !confirmBtn.disabled) {
            proceedWithDelete(invoiceNo);
        }
    });

    // Focus on input
    setTimeout(() => {
        confirmInput.focus();
    }, 100);
}

// Close delete dialog
function closeDeleteDialog() {
    const deleteDialog = document.querySelector('.delete-dialog-overlay');
    if (deleteDialog) {
        deleteDialog.remove();
    }
}

// Proceed with deletion after confirmation
async function proceedWithDelete(invoiceNo) {
    try {
        closeDeleteDialog();

        showLoading('Deleting Invoice', 'Please wait while we securely remove the invoice and all related data...');

        await db.deleteInvoice(invoiceNo);

        hideLoading();

        // Show success message
        showSuccessMessage(`Invoice #${invoiceNo} and all related data have been permanently deleted.`);

        await loadInvoices();

    } catch (error) {
        hideLoading();
        console.error('Error deleting invoice:', error);
        showErrorMessage('Error deleting invoice: ' + error.message);
        await loadInvoices();
    }
}

// Show success message
function showSuccessMessage(message) {
    const successToast = document.createElement('div');
    successToast.className = 'operation-toast toast-success';
    successToast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(successToast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (successToast.parentElement) {
            successToast.remove();
        }
    }, 5000);
}

// Show error message
function showErrorMessage(message) {
    const errorToast = document.createElement('div');
    errorToast.className = 'operation-toast toast-error';
    errorToast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(errorToast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorToast.parentElement) {
            errorToast.remove();
        }
    }, 5000);
}




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

// Show skeleton loading for invoice list (main content)
function showSkeletonLoading(count = 3) {
    const invoicesList = document.getElementById('invoicesList');
    if (!invoicesList) return;

    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `<div class="skeleton-loader skeleton-invoice-item"></div>`;
    }

    invoicesList.innerHTML = skeletonHTML;
}

// NEW: Show skeleton loading for recent invoices
function showSkeletonLoadingRecentInvoices(count = 5) {
    const recentInvoicesList = document.getElementById('recentInvoicesList');
    if (!recentInvoicesList) return;

    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        // Use a slightly different skeleton style for the horizontal layout
        skeletonHTML += `<div class="skeleton-loader skeleton-recent-item"></div>`;
    }
    recentInvoicesList.innerHTML = skeletonHTML;
}

// NEW: Show skeleton loading for customer statement search results
function showSkeletonLoadingCustomerStatement(count = 3) {
    const customerStatementResults = document.getElementById('customerStatementResults');
    if (!customerStatementResults) return;

    let skeletonHTML = `
        <div class="skeleton-loader skeleton-summary-stats"></div>
        <div class="skeleton-loader skeleton-customer-invoice"></div>
        <div class="skeleton-loader skeleton-customer-invoice"></div>
        <div class="skeleton-loader skeleton-customer-invoice"></div>
    `;
    customerStatementResults.innerHTML = skeletonHTML;
}


// Enhanced loading with timeout
function showLoadingWithTimeout(message, subtext = '', timeout = 30000) {
    showLoading(message, subtext);

    // Auto-hide after timeout to prevent stuck loading
    setTimeout(() => {
        hideLoading();
    }, timeout);
}



// Add this function to get date statistics (optional)
async function getDateWiseStatistics() {
    try {
        const invoices = await db.getAllInvoices();
        const groupedInvoices = groupInvoicesByDate(invoices);

        return {
            totalDays: groupedInvoices.length,
            dateGroups: groupedInvoices,
            overallStats: {
                totalInvoices: invoices.length
            }
        };
    } catch (error) {
        console.error('Error getting date statistics:', error);
        return null;
    }
}

