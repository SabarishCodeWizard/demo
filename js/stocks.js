document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Toggle ---
    const menuToggle = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');
    if (menuToggle && menuPanel) {
        menuToggle.addEventListener('click', () => {
            menuPanel.classList.toggle('menu-open');
        });
    }

    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href='login.html';
        return;
    }

    const stocksList = document.getElementById('stocksList');
    const searchInput = document.getElementById('searchInput');
    let allStocks = [];

    // Modal elements
    const modal = document.getElementById('stockDetailsModal');
    const closeModal = document.querySelector('.close-modal');
    const modalProductTitle = document.getElementById('modalProductTitle');
    const purchaseHistoryBody = document.getElementById('purchaseHistoryBody');
    const salesHistoryBody = document.getElementById('salesHistoryBody');

    async function loadStocks() {
        try {
            stocksList.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading stocks...</td></tr>';
            
            await db.ensureInitialized();

            const purchaseBills = await db.getAllPurchaseBills();
            const salesInvoices = await db.getAllInvoices();
            const openingStocksList = await db.getAllOpeningStocks();

            const stockMap = new Map();
            
            // Seed stock map with opening stocks
            openingStocksList.forEach(stock => {
                const desc = stock.description.trim();
                const qty = parseFloat(stock.qty) || 0;
                if (!stockMap.has(desc)) {
                    stockMap.set(desc, { opening: qty, purchased: 0, sold: 0, purchaseHistory: [], salesHistory: [] });
                } else {
                    stockMap.get(desc).opening = qty;
                }
            });
            
            let totalSalesRevenue = 0;
            let cashCollectedRevenue = 0;
            let totalPurchaseCosts = 0;

            // Aggregate Purchases
            purchaseBills.forEach(bill => {
                totalPurchaseCosts += parseFloat(bill.grandTotal) || 0;
                
                if (bill.products && Array.isArray(bill.products)) {
                    bill.products.forEach(product => {
                        if (!product.description) return;
                        const desc = product.description.trim();
                        const qty = parseFloat(product.qty) || 0;
                        if (!stockMap.has(desc)) {
                            stockMap.set(desc, { opening: 0, purchased: 0, sold: 0, purchaseHistory: [], salesHistory: [] });
                        }
                        const stock = stockMap.get(desc);
                        stock.purchased += qty;
                        stock.purchaseHistory.push({
                            date: bill.invoiceDate || bill.date || '',
                            supplier: bill.supplierName || 'Unknown',
                            qty: qty,
                            rate: product.rate || 0,
                            invoiceNo: bill.invoiceNo || '',
                            amount: (qty * (product.rate || 0)).toFixed(2)
                        });
                    });
                }
            });

            // Aggregate Sales
            salesInvoices.forEach(invoice => {
                totalSalesRevenue += parseFloat(invoice.grandTotal) || 0;
                cashCollectedRevenue += parseFloat(invoice.amountPaid) || 0;
                
                if (invoice.products && Array.isArray(invoice.products)) {
                    invoice.products.forEach(product => {
                        if (!product.description) return;
                        const desc = product.description.trim();
                        const qty = parseFloat(product.qty) || 0;
                        if (!stockMap.has(desc)) {
                            stockMap.set(desc, { opening: 0, purchased: 0, sold: 0, purchaseHistory: [], salesHistory: [] });
                        }
                        const stock = stockMap.get(desc);
                        stock.sold += qty;
                        stock.salesHistory.push({
                            date: invoice.invoiceDate || invoice.date || '',
                            customer: invoice.customerName || 'Unknown',
                            qty: qty,
                            rate: product.rate || 0,
                            invoiceNo: invoice.invoiceNo || '',
                            amount: (qty * (product.rate || 0)).toFixed(2)
                        });
                    });
                }
            });

            // Update Financial Summary UI
            const netProfitLoss = totalSalesRevenue - totalPurchaseCosts;
            
            const formatCurrency = (val) => Number(val).toFixed(2);
            
            document.getElementById('totalSalesRevenue').textContent = '₹' + formatCurrency(totalSalesRevenue);
            document.getElementById('totalPurchaseCostsUI').textContent = '₹' + formatCurrency(totalPurchaseCosts);
            document.getElementById('cashCollectedRevenue').textContent = '₹' + formatCurrency(cashCollectedRevenue);
            
            const netProfitLossEl = document.getElementById('netProfitLoss');
            const netProfitLossCard = document.getElementById('netProfitLossCard');
            netProfitLossEl.textContent = '₹' + formatCurrency(netProfitLoss);
            
            if (netProfitLoss < 0) {
                netProfitLossEl.style.color = '#d32f2f';
                netProfitLossCard.style.borderLeftColor = '#d32f2f';
            } else {
                netProfitLossEl.style.color = '#2e7d32';
                netProfitLossCard.style.borderLeftColor = '#2e7d32';
            }

            // Convert to array
            allStocks = Array.from(stockMap, ([description, data]) => {
                const openingRounded = Math.round(data.opening * 1000) / 1000;
                const purchasedRounded = Math.round(data.purchased * 1000) / 1000;
                const soldRounded = Math.round(data.sold * 1000) / 1000;
                const availableRounded = Math.round((openingRounded + purchasedRounded - soldRounded) * 1000) / 1000;
                return {
                    description,
                    opening: openingRounded,
                    purchased: purchasedRounded,
                    sold: soldRounded,
                    available: availableRounded,
                    purchaseHistory: data.purchaseHistory.sort((a, b) => new Date(b.date) - new Date(a.date)),
                    salesHistory: data.salesHistory.sort((a, b) => new Date(b.date) - new Date(a.date))
                };
            });

            // Sort alphabetically by description
            allStocks.sort((a, b) => a.description.localeCompare(b.description));

            displayStocks(allStocks);
        } catch (error) {
            console.error('Error loading stocks:', error);
            stocksList.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading stocks. Please refresh the page.</td></tr>';
        }
    }

    function displayStocks(stocks) {
        if (stocks.length === 0) {
            stocksList.innerHTML = '<tr><td colspan="6" style="text-align: center;">No stock data available.</td></tr>';
            return;
        }

        stocksList.innerHTML = stocks.map((stock, index) => {
            let stockClass = 'stock-zero';
            if (stock.available > 0) stockClass = 'stock-positive';
            else if (stock.available < 0) stockClass = 'stock-negative';

            let openingDisplay = `<span style="color: #aaa;">0</span>`;
            let openingButtons = `
                <button class="action-btn" onclick="updateOpeningStock('${escapeHtml(stock.description.replace(/'/g, "\\'"))}', 0)" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;" title="Add Old Stock">
                    <i class="fas fa-plus"></i> Add Old Stock
                </button>
            `;

            if (stock.opening > 0) {
                openingDisplay = `<span style="background: #e1f5fe; color: #0277bd; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 0.9em;">${stock.opening}</span>`;
                openingButtons = `
                    <button class="action-btn" onclick="updateOpeningStock('${escapeHtml(stock.description.replace(/'/g, "\\'"))}', ${stock.opening})" style="background: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;" title="Edit Old Stock">
                        <i class="fas fa-edit"></i> Edit Old Stock
                    </button>
                    <button class="action-btn" onclick="deleteOpeningStock('${escapeHtml(stock.description.replace(/'/g, "\\'"))}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;" title="Delete Old Stock">
                        <i class="fas fa-trash"></i> Delete Old Stock
                    </button>
                `;
            }

            return `
                <tr>
                    <td style="font-weight: 500;">${escapeHtml(stock.description)}</td>
                    <td>${openingDisplay}</td>
                    <td>${stock.purchased}</td>
                    <td>${stock.sold}</td>
                    <td class="${stockClass}">${stock.available}</td>
                    <td>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                            <button class="action-btn view-btn" onclick="openStockDetails(${index})" style="background: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 0.8em;">
                                <i class="fas fa-eye"></i> View History
                            </button>
                            ${openingButtons}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Global function to update opening stock
    window.updateOpeningStock = async function(description, currentQty) {
        if (typeof Swal !== 'undefined') {
            const { value: qty } = await Swal.fire({
                title: 'Set Opening / Old Stock',
                text: `Enter opening stock quantity for "${description}"`,
                input: 'number',
                inputLabel: 'Quantity',
                inputValue: currentQty,
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value || isNaN(parseFloat(value))) {
                        return 'You need to write a valid number!'
                    }
                }
            });

            if (qty !== undefined) {
                try {
                    await db.saveOpeningStock(description, parseFloat(qty));
                    Swal.fire('Saved!', 'Opening stock updated successfully.', 'success');
                    loadStocks();
                } catch (err) {
                    Swal.fire('Error', 'Failed to save opening stock.', 'error');
                }
            }
        } else {
            const qty = prompt(`Enter opening stock quantity for "${description}":`, currentQty);
            if (qty !== null && !isNaN(parseFloat(qty))) {
                try {
                    await db.saveOpeningStock(description, parseFloat(qty));
                    alert('Opening stock updated successfully.');
                    loadStocks();
                } catch (err) {
                    alert('Failed to save opening stock.');
                }
            }
        }
    };

    window.deleteOpeningStock = async function(description) {
        if (typeof Swal !== 'undefined') {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: `Do you want to delete the opening stock for "${description}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            });

            if (result.isConfirmed) {
                try {
                    await db.deleteOpeningStock(description);
                    Swal.fire('Deleted!', 'Opening stock has been deleted.', 'success');
                    loadStocks();
                } catch (err) {
                    Swal.fire('Error', 'Failed to delete opening stock.', 'error');
                }
            }
        } else {
            if (confirm(`Are you sure you want to delete the opening stock for "${description}"?`)) {
                try {
                    await db.deleteOpeningStock(description);
                    alert('Opening stock deleted successfully.');
                    loadStocks();
                } catch (err) {
                    alert('Failed to delete opening stock.');
                }
            }
        }
    };

    function escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Global function to handle modal opening
    window.openStockDetails = function(index) {
        const stock = allStocks[index];
        if (!stock) return;

        modalProductTitle.textContent = stock.description;

        // Render Purchase History
        if (stock.purchaseHistory.length === 0) {
            purchaseHistoryBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 10px;">No purchases found.</td></tr>';
        } else {
            purchaseHistoryBody.innerHTML = stock.purchaseHistory.map(p => `
                <tr>
                    <td>${formatDate(p.date)}</td>
                    <td>${escapeHtml(p.invoiceNo.replace('P-',''))}</td>
                    <td>${escapeHtml(p.supplier)}</td>
                    <td>${p.qty}</td>
                    <td>₹${parseFloat(p.rate).toFixed(2)}</td>
                    <td>₹${parseFloat(p.amount).toFixed(2)}</td>
                </tr>
            `).join('') + `
                <tr style="font-weight:bold;">
                    <td colspan="5" style="text-align:right;">Total</td>
                    <td>₹${stock.purchaseHistory.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)}</td>
                </tr>
            `;
        }

        // Render Sales History
        if (stock.salesHistory.length === 0) {
            salesHistoryBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 10px;">No sales found.</td></tr>';
        } else {
            salesHistoryBody.innerHTML = stock.salesHistory.map(s => `
                <tr>
                    <td>${formatDate(s.date)}</td>
                    <td>${escapeHtml(s.invoiceNo.replace('P-',''))}</td>
                    <td>${escapeHtml(s.customer)}</td>
                    <td>${s.qty}</td>
                    <td>₹${parseFloat(s.rate).toFixed(2)}</td>
                    <td>₹${parseFloat(s.amount).toFixed(2)}</td>
                </tr>
            `).join('') + `
                <tr style="font-weight:bold;">
                    <td colspan="5" style="text-align:right;">Total</td>
                    <td>₹${stock.salesHistory.reduce((sum, s) => sum + parseFloat(s.amount), 0).toFixed(2)}</td>
                </tr>
            `;
        }

        modal.style.display = 'flex';
    };

    function formatDate(dateStr) {
        if (!dateStr) return '';
        // Firestore Timestamp objects have a toDate() method
        if (typeof dateStr.toDate === 'function') {
            dateStr = dateStr.toDate();
        }
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr; // return raw if unparsable
        return d.toLocaleDateString();
    }

    // Modal close event listeners
    if (closeModal) {
        closeModal.onclick = function() {
            modal.style.display = 'none';
        }
    }
    
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredStocks = allStocks.filter(stock => 
                stock.description.toLowerCase().includes(searchTerm)
            );
            displayStocks(filteredStocks);
        });
    }

    // Initialize
    loadStocks();
});
