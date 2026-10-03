document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    try {
        await db.init();
        console.log("Database initialized for Purchase");

        // Populate supplier datalist
        const suppliers = await db.getAllSuppliers();
        const supplierList = document.getElementById('supplierList');
        if (supplierList && suppliers) {
            supplierList.innerHTML = suppliers.map(s => '<option value="' + (s.phone || '') + '">' + (s.name || '') + ' - ' + (s.phone || '') + '</option>').join('');
        }
    } catch (error) {
        console.error("Failed to initialize database:", error);
        showMessage("Failed to connect to database. Please check your connection.", "error");
    }

    const supplierPhoneInput = document.getElementById('supplierPhone');
    const supplierNameInput = document.getElementById('supplierName');
    const supplierAddressInput = document.getElementById('supplierAddress');
    const messageArea = document.getElementById('messageArea');

    // Menu toggle is handled globally by utils.js

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('loginTime');
            window.location.href = 'login.html';
        });
    }

    // Initialize Date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    document.getElementById('invoiceDate').value = `${year}-${month}-${day}`;

    // Fetch purchase invoice suggestions
    async function updatePurchaseInvoiceSuggestions() {
        try {
            const invoices = await db.getAllPurchaseBills();

            if (invoices.length === 0) {
                document.getElementById('lastInvoiceNo').textContent = 'No invoices yet';
                document.getElementById('nextInvoiceNo').textContent = '001';
                document.getElementById('nextInvoiceNo').dataset.suggestedNumber = '001';
            } else {
                // Find the highest number
                let maxNum = 0;
                let lastInvoiceStr = '';

                invoices.forEach(inv => {
                    if (inv.invoiceNo) {
                        let invStr = inv.invoiceNo.toString();
                        if (invStr.startsWith('P-')) invStr = invStr.substring(2);
                        const num = parseInt(invStr, 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                            lastInvoiceStr = invStr; // store without P- prefix
                        }
                    }
                });

                if (maxNum > 0) {
                    const nextNum = maxNum + 1;
                    const nextInvoiceStr = String(nextNum).padStart(3, '0');
                    const lastInvoicePadded = String(maxNum).padStart(3, '0');

                    document.getElementById('lastInvoiceNo').textContent = lastInvoicePadded;
                    document.getElementById('nextInvoiceNo').textContent = nextInvoiceStr;
                    document.getElementById('nextInvoiceNo').dataset.suggestedNumber = nextInvoiceStr;
                } else {
                    document.getElementById('lastInvoiceNo').textContent = '001';
                    document.getElementById('nextInvoiceNo').textContent = '001';
                    document.getElementById('nextInvoiceNo').dataset.suggestedNumber = '001';
                }
            }
        } catch (error) {
            console.error("Error fetching purchase invoices for suggestions:", error);
            document.getElementById('lastInvoiceNo').textContent = 'Error loading';
            document.getElementById('nextInvoiceNo').textContent = '001';
            document.getElementById('nextInvoiceNo').dataset.suggestedNumber = '001';
        }
    }

    updatePurchaseInvoiceSuggestions();

    document.getElementById('applySuggestion').addEventListener('click', () => {
        const suggestedNumber = document.getElementById('nextInvoiceNo').dataset.suggestedNumber;
        if (suggestedNumber && suggestedNumber !== '-') {
            document.getElementById('invoiceNo').value = suggestedNumber;
            const applyBtn = document.getElementById('applySuggestion');
            const originalText = applyBtn.innerHTML;
            const originalBackground = applyBtn.style.background;

            applyBtn.innerHTML = '<i class="fas fa-check"></i> Applied!';
            applyBtn.style.background = '#20c997';

            setTimeout(() => {
                applyBtn.innerHTML = originalText;
                applyBtn.style.background = originalBackground;
            }, 2000);
        }
    });


    let supplierPhoneTimeout;
    // Auto-fetch supplier details on phone number input
    supplierPhoneInput.addEventListener('input', async (e) => {
        const phone = e.target.value.trim();
        if (phone.length >= 10) {
            try {
                const supplier = await db.getSupplier(phone);
                if (supplier) {
                    supplierNameInput.value = supplier.name || '';
                    supplierAddressInput.value = supplier.address || '';
                    showMessage("Supplier details loaded.", "success");
                    if (typeof Utils !== 'undefined' && Utils.calculateAndSetSupplierPreviousBalance) {
                        Utils.calculateAndSetSupplierPreviousBalance();
                    }
                } else {
                    supplierNameInput.value = '';
                    supplierAddressInput.value = '';
                    if (document.getElementById('previousBalance')) document.getElementById('previousBalance').textContent = '0.00';
                    updateCalculations();
                }
            } catch (error) {
                console.error("Error fetching supplier:", error);
            }
        } else {
            // clear if they delete
            if (phone.length === 0) {
                supplierNameInput.value = '';
                supplierAddressInput.value = '';
                if (document.getElementById('previousBalance')) document.getElementById('previousBalance').textContent = '0.00';
                updateCalculations();
            }
        }
    });

    let supplierNameTimeout;
    supplierNameInput.addEventListener('input', () => {
        clearTimeout(supplierNameTimeout);
        supplierNameTimeout = setTimeout(() => {
            if (typeof Utils !== 'undefined' && Utils.calculateAndSetSupplierPreviousBalance) {
                Utils.calculateAndSetSupplierPreviousBalance();
            }
        }, 500);
    });

    // Handle initial calculation check
    document.getElementById('invoiceNo').addEventListener('input', () => {
        if (typeof Utils !== 'undefined' && Utils.calculateAndSetSupplierPreviousBalance) {
            Utils.calculateAndSetSupplierPreviousBalance();
        }
    });



    function showMessage(text, type) {
        if (typeof Swal !== 'undefined') {
            const Toast = Swal.mixin({
                toast: true,
                position: 'bottom-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: type,
                title: text
            });
        } else {
            messageArea.textContent = text;
            messageArea.style.display = 'block';

            if (type === 'error') {
                messageArea.style.backgroundColor = '#f8d7da';
                messageArea.style.color = '#721c24';
                messageArea.style.border = '1px solid #f5c6cb';
            } else {
                messageArea.style.backgroundColor = '#d4edda';
                messageArea.style.color = '#155724';
                messageArea.style.border = '1px solid #c3e6cb';
            }

            // Hide after 3 seconds
            setTimeout(() => {
                messageArea.style.display = 'none';
            }, 3000);
        }
    }

    // --- Save Purchase Bill Logic ---
    const savePurchaseBillBtn = document.getElementById('savePurchaseBillBtn');
    if (savePurchaseBillBtn) {
        savePurchaseBillBtn.addEventListener('click', async () => {
            const invoiceNo = document.getElementById('invoiceNo').value.trim();
            const invoiceDate = document.getElementById('invoiceDate').value;
            const supplierPhone = document.getElementById('supplierPhone').value.trim();
            const supplierName = document.getElementById('supplierName').value.trim();
            const supplierAddress = document.getElementById('supplierAddress').value.trim();

            if (!invoiceNo) {
                showMessage("Please enter an Invoice Number.", "error");
                document.getElementById('invoiceNo').focus();
                return;
            }

            if (!invoiceDate) {
                showMessage("Please select an Invoice Date.", "error");
                document.getElementById('invoiceDate').focus();
                return;
            }

            if (!supplierName) {
                showMessage("Please enter the Supplier Name.", "error");
                document.getElementById('supplierName').focus();
                return;
            }

            if (!supplierPhone) {
                showMessage("Please enter the Supplier Phone Number.", "error");
                document.getElementById('supplierPhone').focus();
                return;
            }

            // Gather products
            const products = [];
            const shortcuts = await getAllShortcuts();
            let allProductsValid = true;
            const rows = document.querySelectorAll('#productTableBody tr');
            for (const row of rows) {
                const description = row.querySelector('.product-description').value.trim();
                const qty = parseFloat(row.querySelector('.qty').value) || 0;
                const rate = parseFloat(row.querySelector('.rate').value) || 0;

                if (description && qty > 0) {
                    const isValid = shortcuts.some(s => s.fullDescription.toLowerCase().trim() === description.toLowerCase());
                    if (!isValid) {
                        allProductsValid = false;
                    }
                    products.push({ description, qty, rate, amount: qty * rate });
                }
            }

            if (products.length === 0) {
                showMessage("Please add at least one product with a valid quantity.", "error");
                return;
            }

            if (!allProductsValid) {
                showMessage("Please select products only from the suggestions list.", "error");
                return;
            }

            const invoiceData = {
                invoiceNo,
                invoiceDate,
                supplierPhone: supplierPhone,
                supplierName: supplierName,
                supplierAddress: supplierAddress,
                products,
                subtotal: parseFloat(document.getElementById('subTotal').textContent) || 0,
                previousBalance: parseFloat(document.getElementById('previousBalance')?.textContent.replace(/[^0-9.-]+/g, "")) || 0,
                manualPreviousBalance: parseFloat(document.getElementById('manualPreviousBalance')?.value) || 0,
                discount: parseFloat(document.getElementById('discountAmount').value) || 0,
                grandTotal: parseFloat(document.getElementById('grandTotal').textContent) || 0,
                payment: {
                    cash: parseFloat(document.getElementById('cashPaid').value) || 0,
                    upi: parseFloat(document.getElementById('upiPaid').value) || 0,
                    account: parseFloat(document.getElementById('accountPaid').value) || 0,
                    totalPaid: parseFloat(document.getElementById('totalAmountPaid').textContent) || 0,
                    balanceDue: parseFloat(document.getElementById('balanceDue').textContent) || 0
                }
            };

            try {
                savePurchaseBillBtn.disabled = true;
                savePurchaseBillBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

                await db.savePurchaseBill(invoiceData);

                // Check products for rate updates
                const shortcuts = await getAllShortcuts();
                const savePromises = [];

                // Save supplier details for future auto-fill
                if (supplierPhone) {
                    savePromises.push(db.saveSupplier({
                        phone: supplierPhone,
                        name: supplierName,
                        address: supplierAddress,
                        lastUpdated: new Date().toISOString()
                    }));
                }

                // (Removed checking products for rate updates because purchase rate is constant)
                if (savePromises.length > 0) {
                    await Promise.all(savePromises);
                }
                showMessage("Purchase Bill saved successfully!", "success");

                // Update suggestions for the next bill
                await updatePurchaseInvoiceSuggestions();

            } catch (error) {
                console.error("Error saving purchase bill:", error);
                showMessage("Error saving purchase bill.", "error");
            } finally {
                savePurchaseBillBtn.disabled = false;
                savePurchaseBillBtn.innerHTML = '<i class="fas fa-file-invoice"></i> Save Purchase Bill';
            }
        });
    }

    // --- Product Table Logic ---
    const addRowBtn = document.getElementById('addRow');
    const productTableBody = document.getElementById('productTableBody');

    if (addRowBtn) {
        addRowBtn.addEventListener('click', addProductRow);
    }

    // Add a new product row
    function addProductRow() {
        const rowCount = productTableBody.rows.length;
        const newRow = productTableBody.insertRow();

        newRow.innerHTML = `
            <td>${rowCount + 1}</td>
            <td>
                <div class="product-description-container">
                    <input type="text" class="product-description">
                    <div class="autocomplete-dropdown"></div>
                </div>
            </td>
            <td><input type="number" class="qty" value="0" min="0" step="1"></td>
            <td><input type="number" class="rate" value="0.00" min="0" step="0.01"></td>
            <td class="amount">0.00</td>
            <td><button class="remove-row">X</button></td>
        `;

        newRow.querySelector('.remove-row').addEventListener('click', function () {
            this.closest('tr').remove();
            updateRowNumbers();
            updateCalculations();
        });
        setupAutoCompletionForRow(newRow);
    }

    function updateRowNumbers() {
        const rows = document.querySelectorAll('#productTableBody tr');
        rows.forEach((row, index) => {
            row.cells[0].textContent = index + 1;
        });
    }

    // Event delegation for input changes to calculate amounts
    productTableBody.addEventListener('input', function (e) {
        if (e.target.classList.contains('qty') || e.target.classList.contains('rate')) {
            const row = e.target.closest('tr');
            const qty = parseFloat(row.querySelector('.qty').value) || 0;
            const rate = parseFloat(row.querySelector('.rate').value) || 0;
            const amount = qty * rate;
            row.querySelector('.amount').textContent = amount.toFixed(2);
            updateCalculations();
        }
    });

    document.querySelectorAll('.remove-row').forEach(btn => {
        btn.addEventListener('click', function () {
            this.closest('tr').remove();
            updateRowNumbers();
            updateCalculations();
        });
    });

    // Auto-completion for product descriptions
    function setupAutoCompletion() {
        const productInputs = document.querySelectorAll('.product-description');

        productInputs.forEach(input => {
            let dropdown = input.parentNode.querySelector('.autocomplete-dropdown');

            if (!dropdown) {
                dropdown = document.createElement('div');
                dropdown.className = 'autocomplete-dropdown';

                const container = document.createElement('div');
                container.className = 'product-description-container';
                container.style.position = 'relative';

                input.parentNode.insertBefore(container, input);
                container.appendChild(input);
                container.appendChild(dropdown);
            }

            input.addEventListener('input', async (e) => {
                const value = e.target.value.trim();
                if (value.length >= 1) {
                    await showAutoCompleteSuggestions(value, dropdown, input);
                } else {
                    dropdown.style.display = 'none';
                }
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    dropdown.style.display = 'none';
                }, 200);
            });

            input.addEventListener('focus', async (e) => {
                const value = e.target.value.trim();
                if (value.length >= 1) {
                    await showAutoCompleteSuggestions(value, dropdown, input);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    handleKeyboardNavigation(e.key, dropdown, input);
                } else if (e.key === 'Enter' && dropdown.style.display === 'block') {
                    e.preventDefault();
                    const selectedItem = dropdown.querySelector('.autocomplete-item.highlighted');
                    if (selectedItem) {
                        input.value = selectedItem.dataset.full;
                        dropdown.style.display = 'none';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else if (e.key === 'Escape') {
                    dropdown.style.display = 'none';
                }
            });
        });
    }

    function setupAutoCompletionForRow(row) {
        const input = row.querySelector('.product-description');
        const dropdown = row.querySelector('.autocomplete-dropdown');

        if (input && dropdown) {
            input.addEventListener('input', async (e) => {
                const value = e.target.value.trim();
                if (value.length >= 1) {
                    await showAutoCompleteSuggestions(value, dropdown, input);
                } else {
                    dropdown.style.display = 'none';
                }
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    dropdown.style.display = 'none';
                }, 200);
            });

            input.addEventListener('focus', async (e) => {
                const value = e.target.value.trim();
                if (value.length >= 1) {
                    await showAutoCompleteSuggestions(value, dropdown, input);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    handleKeyboardNavigation(e.key, dropdown, input);
                } else if (e.key === 'Enter' && dropdown.style.display === 'block') {
                    e.preventDefault();
                    const selectedItem = dropdown.querySelector('.autocomplete-item.highlighted');
                    if (selectedItem) {
                        input.value = selectedItem.dataset.full;
                        dropdown.style.display = 'none';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                } else if (e.key === 'Escape') {
                    dropdown.style.display = 'none';
                }
            });
        }
    }

    function handleKeyboardNavigation(key, dropdown, input) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        let currentIndex = -1;
        items.forEach((item, index) => {
            if (item.classList.contains('highlighted')) {
                currentIndex = index;
                item.classList.remove('highlighted');
            }
        });

        if (key === 'ArrowDown') {
            currentIndex = (currentIndex + 1) % items.length;
        } else if (key === 'ArrowUp') {
            currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        }

        if (currentIndex !== -1) {
            items[currentIndex].classList.add('highlighted');
            items[currentIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    async function getAllShortcuts() {
        try {
            await db.ensureInitialized();
            const querySnapshot = await db.firestore.collection('shortcuts').get();
            const shortcuts = [];
            querySnapshot.forEach((doc) => {
                shortcuts.push(doc.data());
            });
            return shortcuts.sort((a, b) => a.shortcutKey.localeCompare(b.shortcutKey));
        } catch (error) {
            console.error('Error getting shortcuts from Firebase:', error);
            return [];
        }
    }

    async function showAutoCompleteSuggestions(query, dropdown, input) {
        try {
            dropdown.innerHTML = '<div class="autocomplete-loading">Searching...</div>';
            dropdown.style.display = 'block';

            const shortcuts = await getAllShortcuts();

            if (shortcuts.length === 0) {
                dropdown.style.display = 'none';
                return;
            }

            const matches = shortcuts.filter(shortcut =>
                shortcut.shortcutKey.toLowerCase().includes(query.toLowerCase()) ||
                shortcut.fullDescription.toLowerCase().includes(query.toLowerCase())
            );

            if (matches.length > 0) {
                dropdown.innerHTML = matches.map(shortcut => `
                    <div class="autocomplete-item" data-shortcut="${shortcut.shortcutKey}" data-full="${shortcut.fullDescription}">
                        <strong>${shortcut.shortcutKey}</strong> → ${shortcut.fullDescription}
                    </div>
                `).join('');

                dropdown.style.display = 'block';

                dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        input.value = item.dataset.full;
                        dropdown.style.display = 'none';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    });

                    item.addEventListener('mouseenter', () => {
                        dropdown.querySelectorAll('.autocomplete-item').forEach(i => {
                            i.classList.remove('highlighted');
                        });
                        item.classList.add('highlighted');
                    });
                });
            } else {
                dropdown.innerHTML = '<div class="autocomplete-no-results">No matching products found</div>';
                dropdown.style.display = 'block';

                setTimeout(() => {
                    if (dropdown.style.display === 'block') {
                        dropdown.style.display = 'none';
                    }
                }, 1500);
            }
        } catch (error) {
            console.error('Error in auto-complete:', error);
            dropdown.style.display = 'none';
        }
    }

    // --- Calculations Logic ---
    function updateCalculations() {
        // Calculate Subtotal
        let subtotal = 0;
        const amountCells = document.querySelectorAll('#productTableBody .amount');
        amountCells.forEach(cell => {
            const value = parseFloat(cell.textContent);
            if (!isNaN(value)) {
                subtotal += value;
            }
        });
        document.getElementById('subTotal').textContent = subtotal.toFixed(2);

        // Get Previous Balances
        const previousBalanceEl = document.getElementById('previousBalance');
        const previousBalance = previousBalanceEl ? (parseFloat(previousBalanceEl.textContent.replace(/[^0-9.-]+/g, "")) || 0) : 0;
        const manualPreviousBalanceEl = document.getElementById('manualPreviousBalance');
        const manualPreviousBalance = manualPreviousBalanceEl ? (parseFloat(manualPreviousBalanceEl.value) || 0) : 0;

        // Get Discount
        const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;

        // Calculate Grand Total (Subtotal + Previous Balances - Discount)
        let grandTotal = subtotal + previousBalance + manualPreviousBalance - discountAmount;
        if (grandTotal < 0) grandTotal = 0;
        document.getElementById('grandTotal').textContent = grandTotal.toFixed(2);

        // Get Payments
        const cashPaid = parseFloat(document.getElementById('cashPaid').value) || 0;
        const upiPaid = parseFloat(document.getElementById('upiPaid').value) || 0;
        const accountPaid = parseFloat(document.getElementById('accountPaid').value) || 0;

        // Calculate Total Paid
        const totalPaid = cashPaid + upiPaid + accountPaid;
        document.getElementById('totalAmountPaid').textContent = totalPaid.toFixed(2);

        // Calculate Balance Due
        let balanceDue = grandTotal - totalPaid;
        document.getElementById('balanceDue').textContent = balanceDue.toFixed(2);
    }

    // Listeners for payment and discount fields
    const calculationInputs = [
        'discountAmount',
        'manualPreviousBalance',
        'cashPaid',
        'upiPaid',
        'accountPaid'
    ];

    calculationInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateCalculations);
        }
    });

    setupAutoCompletion();

    // --- Share Acknowledgement Logic ---
    const shareAcknowledgementBtn = document.getElementById('shareAcknowledgementBtn');
    if (shareAcknowledgementBtn) {
        shareAcknowledgementBtn.addEventListener('click', async () => {
            const supplierName = document.getElementById('supplierName').value.trim();
            const grandTotal = document.getElementById('grandTotal').textContent;

            const products = [];
            const shortcuts = await getAllShortcuts();
            let allProductsValid = true;
            const rows = document.querySelectorAll('#productTableBody tr');
            for (const row of rows) {
                const description = row.querySelector('.product-description').value.trim();
                const qty = parseFloat(row.querySelector('.qty').value) || 0;
                const rate = parseFloat(row.querySelector('.rate').value) || 0;

                if (description && qty > 0) {
                    const isValid = shortcuts.some(s => s.fullDescription.toLowerCase().trim() === description.toLowerCase());
                    if (!isValid) {
                        allProductsValid = false;
                    }
                    products.push({ description, qty, rate, amount: qty * rate });
                }
            }

            if (products.length === 0) {
                showMessage("Please add at least one product before sharing.", "error");
                return;
            }

            if (!allProductsValid) {
                showMessage("Please select products only from the suggestions list.", "error");
                return;
            }

            let message = "";
            if (supplierName) {
                message += `Supplier: ${supplierName}\n\n`;
            }
            message += `Products Received:\n`;

            products.forEach((p, index) => {
                message += `${index + 1}. ${p.description} - Qty: ${p.qty} - Amount: ₹${p.amount.toFixed(2)}\n`;
            });

            message += `\nTotal Amount: ₹${grandTotal}\n\n`;
            message += `Santhamani Textiles has received the products mentioned above. Thank you.\n\nSoftware created by Sabarish R.\nFor custom billing solutions, contact: 7845081278`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'Acknowledgement',
                        text: message
                    });
                    showMessage("Acknowledgement shared successfully!", "success");
                } catch (error) {
                    console.log('Error sharing:', error);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(message);
                    showMessage("Message copied to clipboard! You can paste it to share.", "success");
                } catch (err) {
                    showMessage("Failed to share or copy to clipboard.", "error");
                }
            }
        });
    }

});