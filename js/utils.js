// Utility functions for the billing application
class Utils {
    // Format currency
    static formatCurrency(amount) {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) amount = 0;
        return new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    // Convert large Indian currency amounts to readable text (e.g. 1.5 Cr, 50 L)
    static formatAmountToText(amount) {
        if (!amount || isNaN(amount)) return '';
        const absAmount = Math.abs(amount);
        let formatted = '';
        
        if (absAmount >= 10000000) {
            formatted = (absAmount / 10000000).toFixed(2) + ' Cr';
        } else if (absAmount >= 100000) {
            formatted = (absAmount / 100000).toFixed(2) + ' L';
        } else if (absAmount >= 1000) {
            formatted = (absAmount / 1000).toFixed(2) + ' K';
        } else {
            return ''; // Don't show text for small amounts
        }
        
        // Remove trailing .00 if present
        formatted = formatted.replace('.00', '');
        
        return (amount < 0 ? '-' : '') + formatted;
    }

    // Calculate subtotal from product rows
    static calculateSubtotal() {
        let subtotal = 0;
        document.querySelectorAll('#productTableBody tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;
            subtotal += qty * rate;
        });
        return subtotal;
    }

    // Calculate grand total
    static calculateGrandTotal(subtotal) {
        const roundedTotal = Math.round(subtotal);
        const roundOff = roundedTotal - subtotal;

        return {
            grandTotal: roundedTotal,
            roundOff: roundOff
        };
    }


    // Calculate total return amount for an invoice
    static async calculateTotalReturns(invoiceNo) {
        try {
            const returns = await db.getReturnsByInvoice(invoiceNo);
            return returns.reduce((total, returnItem) => total + returnItem.returnAmount, 0);
        } catch (error) {
            console.error('Error calculating returns for invoice:', invoiceNo, error);
            return 0; // Return 0 if there's an error
        }
    }

    // Update invoice with return amounts
    static async updateInvoiceWithReturns(invoiceNo) {
        try {
            const totalReturns = await Utils.calculateTotalReturns(invoiceNo);
            const invoiceData = await db.getInvoice(invoiceNo);

            if (invoiceData) {
                invoiceData.totalReturns = totalReturns;
                invoiceData.adjustedBalanceDue = invoiceData.balanceDue - totalReturns;
                await db.saveInvoice(invoiceData);
            }
        } catch (error) {
            console.error('Error updating invoice with returns:', error);
        }
    }

    static async calculateTotalPurchaseReturns(invoiceNo) {
        try {
            const returns = await db.getPurchaseReturnsByInvoice(invoiceNo);
            return returns.reduce((total, returnItem) => total + (parseFloat(returnItem.returnAmount) || 0), 0);
        } catch (error) {
            console.error('Error calculating purchase returns for invoice:', invoiceNo, error);
            return 0;
        }
    }

    static async updatePurchaseBillWithReturns(invoiceNo) {
        try {
            const totalReturns = await Utils.calculateTotalPurchaseReturns(invoiceNo);
            const invoiceData = await db.getPurchaseBill(invoiceNo);

            if (invoiceData) {
                const invoiceBalanceDue = invoiceData.payment?.balanceDue !== undefined ? (parseFloat(invoiceData.payment.balanceDue) || 0) : (parseFloat(invoiceData.balanceDue) || 0);
                invoiceData.totalReturns = totalReturns;
                invoiceData.adjustedBalanceDue = invoiceBalanceDue - totalReturns;
                await db.savePurchaseBill(invoiceData);
            }
        } catch (error) {
            console.error('Error updating purchase bill with returns:', error);
        }
    }
    // Calculate customer's previous balance
    // Calculate customer's previous balance (only the most recent balance)
    static async calculateCustomerBalance(customerName, currentInvoiceNo = null) {
        try {
            const invoices = await db.getAllInvoices();

            // Filter customer invoices and exclude current invoice
            const customerInvoices = invoices.filter(invoice =>
                invoice.customerName === customerName &&
                invoice.invoiceNo !== currentInvoiceNo
            );

            if (customerInvoices.length === 0) {
                return {
                    totalPreviousBills: 0,
                    balanceCarriedForward: 0,
                    invoiceCount: 0,
                    lastInvoiceNo: null
                };
            }

            // Sort invoices by invoice number in descending order (newest first)
            customerInvoices.sort((a, b) => {
                const numA = parseInt(a.invoiceNo) || 0;
                const numB = parseInt(b.invoiceNo) || 0;
                return numB - numA;
            });

            // Get the most recent invoice's adjusted balance due
            const mostRecentInvoice = customerInvoices[0];
            const totalReturns = await Utils.calculateTotalReturns(mostRecentInvoice.invoiceNo);
            const adjustedBalanceDue = mostRecentInvoice.balanceDue - totalReturns;

            // Calculate total of all previous bills (for display only)
            const totalPreviousBills = customerInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0);

            return {
                totalPreviousBills,
                balanceCarriedForward: adjustedBalanceDue, // Use adjusted balance
                invoiceCount: customerInvoices.length,
                lastInvoiceNo: mostRecentInvoice.invoiceNo
            };
        } catch (error) {
            console.error('Error calculating customer balance:', error);
            return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0, lastInvoiceNo: null };
        }
    }

    // Calculate supplier's previous balance
    static async calculateSupplierBalance(supplierName, currentInvoiceNo = null) {
        try {
            const bills = await db.getAllPurchaseBills();
            
            const supplierBills = bills.filter(bill => 
                bill.supplierName === supplierName && 
                bill.invoiceNo !== currentInvoiceNo
            );

            if (supplierBills.length === 0) {
                return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0, lastInvoiceNo: null };
            }

            supplierBills.sort((a, b) => {
                const numA = parseInt(a.invoiceNo) || 0;
                const numB = parseInt(b.invoiceNo) || 0;
                return numB - numA;
            });

            const mostRecentBill = supplierBills[0];
            const adjustedBalanceDue = mostRecentBill.balanceDue || 0;

            const totalPreviousBills = supplierBills.reduce((sum, bill) => sum + bill.grandTotal, 0);

            return {
                totalPreviousBills,
                balanceCarriedForward: adjustedBalanceDue,
                invoiceCount: supplierBills.length,
                lastInvoiceNo: mostRecentBill.invoiceNo
            };
        } catch (error) {
            console.error('Error calculating supplier balance:', error);
            return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0, lastInvoiceNo: null };
        }
    }

    // Validate form data
    static validateForm() {
        const invoiceNo = document.getElementById('invoiceNo').value.trim();
        const invoiceDate = document.getElementById('invoiceDate').value;
        const customerName = document.getElementById('customerName').value.trim();

        if (!invoiceNo) {
            Utils.showToast('Missing Information', 'Please enter an invoice number', 'error');
            return false;
        }

        if (!invoiceDate) {
            Utils.showToast('Missing Information', 'Please select an invoice date', 'error');
            return false;
        }

        if (!customerName) {
            Utils.showToast('Missing Information', 'Please enter customer name', 'error');
            return false;
        }

        const phone = document.getElementById('customerPhone').value.trim();
        if (phone && phone.length > 0 && phone.length < 10) {
            Utils.showToast('Invalid Information', 'Please enter a valid 10-digit phone number', 'error');
            document.getElementById('customerPhone').focus();
            return false;
        }

        // Check if at least one product has description
        let hasProduct = false;
        let allProductsValid = true;
        document.querySelectorAll('.product-description').forEach(input => {
            const desc = input.value.trim();
            if (desc) {
                hasProduct = true;
                if (window.globalShortcutsCache) {
                    const shortcut = window.globalShortcutsCache.find(s => s.fullDescription.toLowerCase().trim() === desc.toLowerCase());
                    if (!shortcut) {
                        allProductsValid = false;
                    }
                }
            }
        });

        if (!hasProduct) {
            Utils.showToast('Empty Bill', 'Please add at least one item to the bill before saving or generating.', 'error');
            return false;
        }

        if (!allProductsValid) {
            Utils.showToast('Invalid Product', 'Please select products only from the suggestions list.', 'error');
            return false;
        }

        return true;
    }

    // Update getFormData method to include payment breakdown
    static getFormData() {
        const products = [];
        document.querySelectorAll('#productTableBody tr').forEach((row, index) => {
            const description = row.querySelector('.product-description').value;
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;

            if (description) {
                products.push({
                    sno: index + 1,
                    description: description,
                    qty: qty,
                    rate: rate,
                    amount: qty * rate
                });
            }
        });

        const subtotal = Utils.calculateSubtotal();
        const previousBalance = parseFloat(document.getElementById('previousBalance').textContent.replace(/[^0-9.-]+/g, "")) || 0;
        const manualPreviousBalance = parseFloat(document.getElementById('manualPreviousBalance')?.value) || 0;
        const discountAmount = parseFloat(document.getElementById('discountAmount')?.value) || 0;
        const totalAmount = subtotal + previousBalance + manualPreviousBalance - discountAmount;

        // Get payment breakdown
        const paymentBreakdown = Utils.getPaymentBreakdown();
        const totalAmountPaid = Utils.calculateTotalPaid();
        const balanceDue = totalAmount - totalAmountPaid;

        return {
            invoiceNo: document.getElementById('invoiceNo').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            customerName: document.getElementById('customerName').value,
            customerAddress: document.getElementById('customerAddress').value,
            customerPhone: document.getElementById('customerPhone').value,
            products: products,
            subtotal: subtotal,
            previousBalance: previousBalance,
            manualPreviousBalance: manualPreviousBalance,
            discountAmount: discountAmount,
            grandTotal: totalAmount,
            paymentBreakdown: paymentBreakdown, // Store individual payment methods
            amountPaid: totalAmountPaid, // Total paid
            balanceDue: balanceDue,
            createdAt: new Date().toISOString()
        };
    }
    // Calculate and set previous balance for new invoices
    static async calculateAndSetPreviousBalance() {
        const customerName = document.getElementById('customerName')?.value;
        const customerPhone = document.getElementById('customerPhone')?.value;
        const currentInvoiceNo = document.getElementById('invoiceNo')?.value;

        if (customerName || customerPhone) {
            const previousBalanceInfo = await Utils.calculatePreviousBalanceAtTime(customerName, customerPhone, currentInvoiceNo);
            const prevBalEl = document.getElementById('previousBalance');
            if (prevBalEl) {
                prevBalEl.textContent = Utils.formatCurrency(previousBalanceInfo.balanceCarriedForward);
            }

            // Update calculations with the new previous balance
            Utils.updateCalculations();
        }
    }

    // Calculate and set supplier previous balance for new purchase bills
    static async calculateAndSetSupplierPreviousBalance() {
        const supplierName = document.getElementById('supplierName')?.value;
        const supplierPhone = document.getElementById('supplierPhone')?.value;
        const currentInvoiceNo = document.getElementById('invoiceNo')?.value;

        if (supplierName || supplierPhone) {
            const previousBalanceInfo = await Utils.calculateSupplierPreviousBalanceAtTime(supplierName, supplierPhone, currentInvoiceNo);
            const prevBalEl = document.getElementById('previousBalance');
            if (prevBalEl) {
                prevBalEl.textContent = Utils.formatCurrency(previousBalanceInfo.balanceCarriedForward);
            }
            
            // Update calculations with the new previous balance
            if (typeof updateCalculations === 'function') {
                updateCalculations();
            } else if (typeof Utils.updateCalculations === 'function') {
                Utils.updateCalculations();
            }
        }
    }

    // Calculate previous balance as it was at the time of a specific invoice

    static async calculatePreviousBalanceAtTime(customerName, customerPhone = null, currentInvoiceNo = null) {
        try {
            const invoices = await db.getAllInvoices();

            // Filter customer invoices and sort by invoice number (ascending)
            const customerInvoices = invoices
                .filter(invoice => {
                    if (customerPhone && invoice.customerPhone && invoice.customerPhone.trim() !== '') {
                        return invoice.customerPhone.trim() === customerPhone.trim();
                    }
                    if (customerName && invoice.customerName) {
                        return invoice.customerName.trim().toLowerCase() === customerName.trim().toLowerCase();
                    }
                    return false;
                })
                .sort((a, b) => {
                    const numA = parseInt(a.invoiceNo) || 0;
                    const numB = parseInt(b.invoiceNo) || 0;
                    return numA - numB; // Sort oldest to newest
                });

            if (customerInvoices.length === 0) {
                return {
                    totalPreviousBills: 0,
                    balanceCarriedForward: 0,
                    invoiceCount: 0
                };
            }

            // If we're creating a new invoice, find the balance from the most recent existing invoice
            if (!currentInvoiceNo || !customerInvoices.find(inv => inv.invoiceNo === currentInvoiceNo)) {
                const mostRecentInvoice = customerInvoices[customerInvoices.length - 1];

                // Calculate adjusted balance considering returns
                const totalReturns = await Utils.calculateTotalReturns(mostRecentInvoice.invoiceNo);
                const adjustedBalance = mostRecentInvoice.balanceDue - totalReturns;

                return {
                    totalPreviousBills: customerInvoices.reduce((sum, invoice) => sum + invoice.grandTotal, 0),
                    balanceCarriedForward: adjustedBalance, // Use adjusted balance instead of original balance
                    invoiceCount: customerInvoices.length
                };
            }

            // If we're editing an existing invoice, calculate running balance up to the previous invoice
            const currentInvoiceIndex = customerInvoices.findIndex(inv => inv.invoiceNo === currentInvoiceNo);

            if (currentInvoiceIndex === 0) {
                // This is the first invoice for this customer
                return {
                    totalPreviousBills: 0,
                    balanceCarriedForward: 0,
                    invoiceCount: 0
                };
            }

            // OPTIMIZATION: Fetch all returns once
            const allReturns = await db.getAllReturns();
            const returnsByInvoice = {};
            allReturns.forEach(r => {
                if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
                returnsByInvoice[r.invoiceNo].push(r);
            });

            // Just take the previous invoice's balance
            const previousInvoice = customerInvoices[currentInvoiceIndex - 1];
            const returns = returnsByInvoice[previousInvoice.invoiceNo] || [];
            const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
            
            const runningBalance = previousInvoice.balanceDue - totalReturns;

            return {
                totalPreviousBills: customerInvoices.slice(0, currentInvoiceIndex).reduce((sum, invoice) => sum + invoice.grandTotal, 0),
                balanceCarriedForward: runningBalance,
                invoiceCount: currentInvoiceIndex
            };

        } catch (error) {
            console.error('Error calculating previous balance at time:', error);
            return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0 };
        }
    }

    // Calculate supplier previous balance at time
    static async calculateSupplierPreviousBalanceAtTime(supplierName, supplierPhone = null, currentInvoiceNo = null) {
        try {
            const bills = await db.getAllPurchaseBills();

            const supplierBills = bills
                .filter(bill => {
                    if (supplierPhone && bill.supplierPhone && bill.supplierPhone.trim() !== '') {
                        return bill.supplierPhone.trim() === supplierPhone.trim();
                    }
                    if (supplierName && bill.supplierName) {
                        return bill.supplierName.trim().toLowerCase() === supplierName.trim().toLowerCase();
                    }
                    return false;
                })
                .sort((a, b) => {
                    const numA = parseInt(a.invoiceNo) || 0;
                    const numB = parseInt(b.invoiceNo) || 0;
                    return numA - numB;
                });

            if (supplierBills.length === 0) {
                return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0 };
            }

            if (!currentInvoiceNo || !supplierBills.find(inv => inv.invoiceNo === currentInvoiceNo)) {
                const mostRecentBill = supplierBills[supplierBills.length - 1];
                const adjustedBalance = mostRecentBill.balanceDue || 0;

                return {
                    totalPreviousBills: supplierBills.reduce((sum, bill) => sum + bill.grandTotal, 0),
                    balanceCarriedForward: adjustedBalance,
                    invoiceCount: supplierBills.length
                };
            }

            const currentInvoiceIndex = supplierBills.findIndex(inv => inv.invoiceNo === currentInvoiceNo);

            if (currentInvoiceIndex === 0) {
                return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0 };
            }

            // Just take the previous bill's balance
            const previousBill = supplierBills[currentInvoiceIndex - 1];
            const runningBalance = previousBill.balanceDue || 0;

            return {
                totalPreviousBills: supplierBills.slice(0, currentInvoiceIndex).reduce((sum, bill) => sum + bill.grandTotal, 0),
                balanceCarriedForward: runningBalance,
                invoiceCount: currentInvoiceIndex
            };

        } catch (error) {
            console.error('Error calculating supplier previous balance at time:', error);
            return { totalPreviousBills: 0, balanceCarriedForward: 0, invoiceCount: 0 };
        }
    }

    // Update all subsequent invoices when a payment or return is made
    static async updateSubsequentInvoices(customerName, updatedInvoiceNo) {
        try {
            const invoices = await db.getAllInvoices();

            // Get all invoices for this customer sorted
            const customerInvoices = invoices
                .filter(invoice => invoice.customerName === customerName)
                .sort((a, b) => {
                    const numA = parseInt(a.invoiceNo) || 0;
                    const numB = parseInt(b.invoiceNo) || 0;
                    return numA - numB;
                });

            const updatedInvoiceIndex = customerInvoices.findIndex(inv => inv.invoiceNo === updatedInvoiceNo);

            if (updatedInvoiceIndex === -1 || updatedInvoiceIndex === customerInvoices.length - 1) {
                return; // No subsequent invoices to update
            }

            // OPTIMIZATION: Fetch all returns once
            const allReturns = await db.getAllReturns();
            const returnsByInvoice = {};
            allReturns.forEach(r => {
                if (!returnsByInvoice[r.invoiceNo]) returnsByInvoice[r.invoiceNo] = [];
                returnsByInvoice[r.invoiceNo].push(r);
            });

            // Calculate running balance up to the updated invoice
            let runningBalance = 0;
            for (let i = 0; i <= updatedInvoiceIndex; i++) {
                const invoice = customerInvoices[i];
                const returns = returnsByInvoice[invoice.invoiceNo] || [];
                const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
                
                runningBalance += invoice.grandTotal;
                runningBalance -= invoice.amountPaid;
                runningBalance -= totalReturns;
            }

            // Update all invoices after the changed one
            for (let i = updatedInvoiceIndex + 1; i < customerInvoices.length; i++) {
                const invoice = customerInvoices[i];

                const previousBalance = runningBalance;

                // Recalculate the totals
                const subtotal = invoice.products.reduce((sum, product) => sum + product.amount, 0);
                const totalAmount = subtotal + previousBalance;

                // Calculate returns for this invoice
                const returns = returnsByInvoice[invoice.invoiceNo] || [];
                const totalReturns = returns.reduce((sum, r) => sum + (parseFloat(r.returnAmount) || 0), 0);
                const balanceDue = totalAmount - invoice.amountPaid - totalReturns;

                // Update the invoice
                invoice.subtotal = subtotal;
                invoice.grandTotal = totalAmount;
                invoice.balanceDue = balanceDue;
                invoice.totalReturns = totalReturns;
                invoice.adjustedBalanceDue = balanceDue;

                // Save the updated invoice
                await db.saveInvoice(invoice);

                // Update running balance for the next iteration
                runningBalance += invoice.grandTotal;
                runningBalance -= invoice.amountPaid;
                runningBalance -= totalReturns;
            }

            console.log(`Updated ${customerInvoices.length - updatedInvoiceIndex - 1} subsequent invoices`);

        } catch (error) {
            console.error('Error updating subsequent invoices:', error);
        }
    }


    // Save customer details
    static async saveCustomerDetails(name, address, phone) {
        if (!phone) {
            console.error('Phone number is required to save customer');
            return;
        }

        try {
            const customerData = {
                phone: phone.trim(),
                name: name ? name.trim() : '',
                address: address ? address.trim() : '',
                lastUpdated: new Date().toISOString()
            };

            await db.saveCustomer(customerData);
            console.log('Customer details saved:', customerData);
        } catch (error) {
            console.error('Error saving customer details:', error);
        }
    }

    // Auto-fill customer details based on phone number
    static async autoFillCustomerDetails(phone) {
        if (!phone) return null;

        try {
            const customer = await db.getCustomer(phone.trim());
            if (customer) {
                // Auto-fill the form fields
                document.getElementById('customerName').value = customer.name || '';
                document.getElementById('customerAddress').value = customer.address || '';

                // Trigger balance calculation for existing customer
                await Utils.calculateAndSetPreviousBalance();

                return customer;
            }
            return null;
        } catch (error) {
            console.error('Error auto-filling customer details:', error);
            return null;
        }
    }

    // Check if customer exists and update form accordingly
    static async checkCustomerByPhone(phone) {
        if (!phone || phone.length < 10) return; // Wait for complete phone number

        const customer = await Utils.autoFillCustomerDetails(phone);
        if (customer) {
            // Show a subtle indicator that customer was found
            Utils.showCustomerFoundIndicator();
        }
    }

    // Show visual indicator when customer is found
    static showCustomerFoundIndicator() {
        const phoneInput = document.getElementById('customerPhone');
        phoneInput.style.borderColor = '#4CAF50';
        phoneInput.style.backgroundColor = '#f8fff8';

        // Remove the indicator after 2 seconds
        setTimeout(() => {
            phoneInput.style.borderColor = '';
            phoneInput.style.backgroundColor = '';
        }, 2000);
    }

    // Set form data from object
    static async setFormData(data) {
        document.getElementById('invoiceNo').value = data.invoiceNo || '';
        document.getElementById('invoiceDate').value = data.invoiceDate || '';
        document.getElementById('customerName').value = data.customerName || '';
        document.getElementById('customerAddress').value = data.customerAddress || '';
        document.getElementById('customerPhone').value = data.customerPhone || '';

        if (document.getElementById('discountAmount')) {
            document.getElementById('discountAmount').value = data.discountAmount || 0;
        }

        if (document.getElementById('manualPreviousBalance')) {
            document.getElementById('manualPreviousBalance').value = data.manualPreviousBalance !== undefined ? data.manualPreviousBalance : '';
        }

        // Set payment breakdown if available, otherwise set defaults
        if (data.paymentBreakdown) {
            document.getElementById('cashPaid').value = data.paymentBreakdown.cash || 0;
            document.getElementById('upiPaid').value = data.paymentBreakdown.upi || 0;
            document.getElementById('accountPaid').value = data.paymentBreakdown.account || 0;
        } else {
            // For backward compatibility with old invoices
            document.getElementById('cashPaid').value = data.amountPaid || 0;
            document.getElementById('upiPaid').value = 0;
            document.getElementById('accountPaid').value = 0;
        }

        // Clear existing product rows
        const tableBody = document.getElementById('productTableBody');
        tableBody.innerHTML = '';

        // Add product rows
        if (data.products && data.products.length > 0) {
            data.products.forEach((product, index) => {
                const newRow = tableBody.insertRow();
                newRow.innerHTML = `
            <td>${index + 1}</td>
            <td><input type="text" class="product-description" value="${product.description}"></td>
            <td><input type="number" class="qty" value="${product.qty}"></td>
            <td><input type="number" class="rate" value="${product.rate}"></td>
            <td class="amount">${Utils.formatCurrency(product.amount)}</td>
            <td><button class="remove-row">X</button></td>
        `;
            });
        } else {
            // Add one empty row if no products
            const newRow = tableBody.insertRow();
            newRow.innerHTML = `
        <td>1</td>
        <td><input type="text" class="product-description"></td>
        <td><input type="number" class="qty" value="0"></td>
        <td><input type="number" class="rate" value="0.00"></td>
        <td class="amount">0.00</td>
        <td><button class="remove-row">X</button></td>
    `;
        }

        // Set previous balance from data if available, otherwise calculate dynamically
        if (data.previousBalance !== undefined) {
            document.getElementById('previousBalance').textContent = Utils.formatCurrency(data.previousBalance);
        } else {
            // Always calculate previous balance dynamically if not available in data
            await Utils.calculateAndSetPreviousBalance();
        }

        // Update current calculations
        Utils.updateCalculations();
    }


    // Calculate total amount paid from all payment methods
    static calculateTotalPaid() {
        const cashPaid = parseFloat(document.getElementById('cashPaid').value) || 0;
        const upiPaid = parseFloat(document.getElementById('upiPaid').value) || 0;
        const accountPaid = parseFloat(document.getElementById('accountPaid').value) || 0;

        return cashPaid + upiPaid + accountPaid;
    }

    // Get payment breakdown as object
    static getPaymentBreakdown() {
        return {
            cash: parseFloat(document.getElementById('cashPaid').value) || 0,
            upi: parseFloat(document.getElementById('upiPaid').value) || 0,
            account: parseFloat(document.getElementById('accountPaid').value) || 0
        };
    }

    // Update the main calculations method to use multiple payments
    static updateCalculations() {
        const subtotal = Utils.calculateSubtotal();
        const previousBalance = parseFloat(document.getElementById('previousBalance').textContent.replace(/[^0-9.-]+/g, "")) || 0;
        const manualPreviousBalance = parseFloat(document.getElementById('manualPreviousBalance')?.value) || 0;
        const discountAmount = parseFloat(document.getElementById('discountAmount')?.value) || 0;
        const totalAmountPaid = Utils.calculateTotalPaid();

        const totalAmount = subtotal + previousBalance + manualPreviousBalance - discountAmount;
        const balanceDue = totalAmount - totalAmountPaid;

        // Update display
        document.getElementById('subTotal').textContent = Utils.formatCurrency(subtotal);
        document.getElementById('grandTotal').textContent = Utils.formatCurrency(totalAmount);
        document.getElementById('totalAmountPaid').textContent = Utils.formatCurrency(totalAmountPaid);
        document.getElementById('balanceDue').textContent = Utils.formatCurrency(balanceDue);

        // Update product amounts
        let totalPurchaseAmount = 0;
        document.querySelectorAll('#productTableBody tr').forEach(row => {
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;
            row.querySelector('.amount').textContent = Utils.formatCurrency(qty * rate);
            
        });
    }





    // Generate next invoice number suggestion
    static async generateNextInvoiceNumber() {
        try {
            const { highestNumber, highestInvoiceNo } = await Utils.getHighestInvoiceNumber();

            if (highestNumber === 0) {
                // No invoices yet, start with 001
                return {
                    lastInvoiceNo: 'No invoices yet',
                    nextInvoiceNo: '001',
                    nextNumber: 1
                };
            }

            // Generate next number with cycle from 1-999
            let nextNumber;
            if (highestNumber >= 999) {
                // Restart from 1 after reaching 999
                nextNumber = 1;
            } else {
                nextNumber = highestNumber + 1;
            }

            // Format as triple digits (001, 002, ..., 999)
            const formattedNextNumber = nextNumber.toString().padStart(3, '0');

            // Try to maintain the same format as the last invoice
            let nextInvoiceNo;
            if (highestInvoiceNo && highestInvoiceNo.match(/[A-Za-z]/)) {
                // If last invoice has letters, try to preserve the format
                const prefixMatch = highestInvoiceNo.match(/^[A-Za-z]+/);
                const suffixMatch = highestInvoiceNo.match(/[A-Za-z]+$/);

                if (prefixMatch && suffixMatch) {
                    nextInvoiceNo = `${prefixMatch[0]}${formattedNextNumber}${suffixMatch[0]}`;
                } else if (prefixMatch) {
                    nextInvoiceNo = `${prefixMatch[0]}${formattedNextNumber}`;
                } else if (suffixMatch) {
                    nextInvoiceNo = `${formattedNextNumber}${suffixMatch[0]}`;
                } else {
                    nextInvoiceNo = formattedNextNumber;
                }
            } else {
                // Pure numeric or no special format detected - use triple digits
                nextInvoiceNo = formattedNextNumber;
            }

            // Also format the last invoice number for display if it's numeric
            let formattedLastInvoiceNo = highestInvoiceNo;
            if (highestInvoiceNo && /^\d+$/.test(highestInvoiceNo)) {
                formattedLastInvoiceNo = highestInvoiceNo.padStart(3, '0');
            }

            return {
                lastInvoiceNo: formattedLastInvoiceNo,
                nextInvoiceNo: nextInvoiceNo,
                nextNumber: nextNumber
            };
        } catch (error) {
            console.error('Error generating next invoice number:', error);
            return {
                lastInvoiceNo: 'Error',
                nextInvoiceNo: '001',
                nextNumber: 1
            };
        }
    }

    // Helper to get financial year (Starts April 1st, Ends March 31st)
    static getFinancialYear(dateInput) {
        let date = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(date.getTime())) date = new Date();
        
        const year = date.getFullYear();
        const month = date.getMonth(); // 0 is January, 11 is December
        
        // If month is Jan, Feb, Mar (0, 1, 2), it belongs to the previous year's financial year
        return month < 3 ? year - 1 : year;
    }

    // Get the highest invoice number from all invoices in the current financial year
    static async getHighestInvoiceNumber() {
        try {
            const invoices = await db.getAllInvoices();

            // Get target date from form or use current date
            const invoiceDateInput = document.getElementById('invoiceDate');
            const targetDate = invoiceDateInput ? invoiceDateInput.value : new Date();
            const currentFY = Utils.getFinancialYear(targetDate);

            // Filter invoices by the same financial year
            const currentYearInvoices = invoices.filter(invoice => {
                if (!invoice.invoiceDate) return false;
                return Utils.getFinancialYear(invoice.invoiceDate) === currentFY;
            });

            if (currentYearInvoices.length === 0) {
                return {
                    highestNumber: 0,
                    highestInvoiceNo: null
                };
            }

            // Extract numeric parts from invoice numbers and find the highest
            let highestNumber = 0;
            let highestInvoiceNo = null;

            currentYearInvoices.forEach(invoice => {
                if (invoice.invoiceNo) {
                    // Try to extract numeric part from invoice number
                    const numericMatch = invoice.invoiceNo.match(/\d+/);
                    if (numericMatch) {
                        const currentNumber = parseInt(numericMatch[0]);
                        if (currentNumber > highestNumber) {
                            highestNumber = currentNumber;
                            highestInvoiceNo = invoice.invoiceNo;
                        }
                    }
                }
            });

            return {
                highestNumber,
                highestInvoiceNo
            };
        } catch (error) {
            console.error('Error getting highest invoice number:', error);
            return { highestNumber: 0, highestInvoiceNo: null };
        }
    }

    // Update invoice number suggestions in the UI
    static async updateInvoiceNumberSuggestions() {
        try {
            const suggestions = await Utils.generateNextInvoiceNumber();

            // Update the UI
            document.getElementById('lastInvoiceNo').textContent = suggestions.lastInvoiceNo;
            document.getElementById('nextInvoiceNo').textContent = suggestions.nextInvoiceNo;

            // Add cycle indicator if we're restarting from 001
            if (suggestions.nextNumber === 1 && suggestions.lastInvoiceNo && suggestions.lastInvoiceNo !== 'No invoices yet') {
                const cycleIndicator = document.createElement('span');
                cycleIndicator.className = 'cycle-indicator';
                cycleIndicator.textContent = ' (Cycle Restarted)';
                cycleIndicator.style.color = '#e74c3c';
                cycleIndicator.style.fontSize = '0.8em';
                cycleIndicator.style.marginLeft = '5px';

                const nextInvoiceElement = document.getElementById('nextInvoiceNo');
                nextInvoiceElement.appendChild(cycleIndicator);
            }

            // Store the suggested number for later use
            document.getElementById('nextInvoiceNo').dataset.suggestedNumber = suggestions.nextInvoiceNo;

            return suggestions;
        } catch (error) {
            console.error('Error updating invoice number suggestions:', error);
            document.getElementById('lastInvoiceNo').textContent = 'Error';
            document.getElementById('nextInvoiceNo').textContent = '001';
        }
    }

    // Optional: Add a method to check for duplicate invoice numbers when restarting cycle
    static async isInvoiceNumberAvailable(invoiceNo) {
        try {
            const invoices = await db.getAllInvoices();
            return !invoices.some(invoice => invoice.invoiceNo === invoiceNo);
        } catch (error) {
            console.error('Error checking invoice number availability:', error);
            return true;
        }
    }

    // Update customer balance display
    static updateCustomerBalanceDisplay(balanceInfo) {
        const balanceInfoDiv = document.getElementById('customerBalanceInfo');

        if (balanceInfo.invoiceCount > 0) {
            balanceInfoDiv.style.display = 'block';
            document.getElementById('totalPreviousBills').textContent = `₹${Utils.formatCurrency(balanceInfo.totalPreviousBills)}`;
            document.getElementById('balanceCarriedForward').textContent = `₹${Utils.formatCurrency(balanceInfo.balanceCarriedForward)}`;

            // Add more detailed information
            const balanceDetails = balanceInfoDiv.querySelector('.balance-details');
            if (balanceInfo.lastInvoiceNo) {
                // Add last invoice reference if not already present
                if (!document.getElementById('lastInvoiceReference')) {
                    const lastInvoiceRef = document.createElement('div');
                    lastInvoiceRef.className = 'balance-item';
                    lastInvoiceRef.id = 'lastInvoiceReference';
                    lastInvoiceRef.innerHTML = `
                    <span class="balance-label">Last Invoice:</span>
                    <span class="balance-value">#${balanceInfo.lastInvoiceNo}</span>
                `;
                    balanceDetails.appendChild(lastInvoiceRef);
                } else {
                    document.querySelector('#lastInvoiceReference .balance-value').textContent = `#${balanceInfo.lastInvoiceNo}`;
                }

                // Add invoice count if not already present
                if (!document.getElementById('invoiceCount')) {
                    const invoiceCount = document.createElement('div');
                    invoiceCount.className = 'balance-item';
                    invoiceCount.id = 'invoiceCount';
                    invoiceCount.innerHTML = `
                    <span class="balance-label">Total Invoices:</span>
                    <span class="balance-value">${balanceInfo.invoiceCount}</span>
                `;
                    balanceDetails.appendChild(invoiceCount);
                } else {
                    document.querySelector('#invoiceCount .balance-value').textContent = balanceInfo.invoiceCount;
                }
            }
        } else {
            balanceInfoDiv.style.display = 'none';
        }
    }
    // Reset form to default state
    static resetForm() {
        document.getElementById('invoiceNo').value = '';
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('invoiceDate').value = `${year}-${month}-${day}`;
        document.getElementById('customerName').value = '';
        document.getElementById('customerAddress').value = '';
        document.getElementById('customerPhone').value = '';
        // Reset the new payment method fields instead of the old ones
        document.getElementById('manualPreviousBalance').value = 0;
        document.getElementById('discountAmount').value = 0;
        document.getElementById('cashPaid').value = 0;
        document.getElementById('upiPaid').value = 0;
        document.getElementById('accountPaid').value = 0;

        // document.getElementById('transportMode').value = '';
        // document.getElementById('vehicleNumber').value = '';
        // document.getElementById('supplyDate').value = '';
        // document.getElementById('placeOfSupply').value = '';
        // document.getElementById('amountPaid').value = 0;
        // document.getElementById('paymentMethod').value = 'cash';

        // Reset product table
        const tableBody = document.getElementById('productTableBody');
        tableBody.innerHTML = '';
        const newRow = tableBody.insertRow();
        newRow.innerHTML = `
            <td>1</td>
            <td><input type="text" class="product-description"></td>
            <td><input type="number" class="qty" value="0"></td>
            <td><input type="number" class="rate" value="0.00"></td>
            <td class="amount">0.00</td>
            <td><button class="remove-row">X</button></td>
        `;

        Utils.updateCalculations();
    }

    // Professional Toast Notification
    static showToast(title, message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-exclamation-circle';

        const toast = document.createElement('div');
        toast.className = `toast-message ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="toast-content">
                <h4>${title}</h4>
                <p>${message}</p>
            </div>
        `;

        container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 4000);
    }

    // Professional Confirm Notification
    static showConfirm(title, message, type = 'warning', confirmText = 'OK', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            let iconClass = 'fa-exclamation-triangle';
            if (type === 'danger') iconClass = 'fa-times-circle';

            const overlay = document.createElement('div');
            overlay.className = 'custom-confirm-overlay';
            overlay.innerHTML = `
                <div class="custom-confirm-modal">
                    <div class="custom-confirm-icon ${type}">
                        <i class="fas ${iconClass}"></i>
                    </div>
                    <h3>${title}</h3>
                    <p>${message}</p>
                    <div class="custom-confirm-actions">
                        <button class="custom-confirm-btn btn-cancel">${cancelText}</button>
                        <button class="custom-confirm-btn btn-confirm">${confirmText}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Animate in
            setTimeout(() => overlay.classList.add('show'), 10);

            const cleanup = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(result);
                }, 200);
            };

            overlay.querySelector('.btn-cancel').addEventListener('click', () => cleanup(false));
            overlay.querySelector('.btn-confirm').addEventListener('click', () => cleanup(true));
        });
    }

    // Number to words converter
    static numberToWords(number) {
        let num = Math.round(number);
        if (num === 0) return 'Zero';
        if (isNaN(num)) return '';

        const single = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const formatTenth = (digit, prev) => 0 == digit ? "" : " " + (1 == digit ? single[digit * 10 + prev] : tens[digit]);

        const getWords = (n) => {
            let str = '';
            if (n > 99) {
                str += single[Math.floor(n / 100)] + 'Hundred ';
                n %= 100;
            }
            if (n > 19) {
                str += tens[Math.floor(n / 10)] + ' ';
                n %= 10;
            }
            if (n > 0) {
                str += single[n];
            }
            return str;
        };

        let result = '';
        if (num >= 10000000) {
            result += getWords(Math.floor(num / 10000000)) + 'Crore ';
            num %= 10000000;
        }
        if (num >= 100000) {
            result += getWords(Math.floor(num / 100000)) + 'Lakh ';
            num %= 100000;
        }
        if (num >= 1000) {
            result += getWords(Math.floor(num / 1000)) + 'Thousand ';
            num %= 1000;
        }
        if (num > 0) {
            result += getWords(num);
        }

        return 'Rupees ' + result.trim() + ' Only';
    }
}

// Global mobile menu toggle logic for all pages
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');

    if (menuToggle && menuPanel) {
        menuToggle.addEventListener('click', () => {
            menuPanel.classList.toggle('menu-open');
        });

        // Close menu when a link is clicked on mobile
        const navLinks = menuPanel.querySelectorAll('a, button');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 992) {
                    menuPanel.classList.remove('menu-open');
                }
            });
        });
        
        // Highlight active navigation item
        let currentPath = window.location.pathname.split('/').pop().split('.')[0];
        if (!currentPath || currentPath === '' || currentPath === 'index') {
            currentPath = 'index';
        }
        
        const navItems = menuPanel.querySelectorAll('.nav-buttons > a');
        navItems.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.includes(currentPath)) {
                link.classList.add('active-nav-item');
            } else {
                link.classList.remove('active-nav-item');
            }
        });
    }
});
