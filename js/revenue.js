
document.addEventListener('DOMContentLoaded', async () => {
    await db.init();
    await loadRevenueTracking();
});

let allRevenueData = [];

async function loadRevenueTracking() {
    const tableBody = document.getElementById('revenueTableBody');
    
    try {
        const invoices = await db.getAllInvoices();
        const purchaseBills = await db.getAllPurchaseBills();
        
        // Calculate average purchase rate per product
        const productStats = {};
        purchaseBills.forEach(bill => {
            if (bill.products && Array.isArray(bill.products)) {
                bill.products.forEach(p => {
                    if (!p.description) return;
                    const desc = p.description.trim().toUpperCase();
                    if (!productStats[desc]) productStats[desc] = { qty: 0, cost: 0 };
                    productStats[desc].qty += parseFloat(p.qty) || 0;
                    productStats[desc].cost += (parseFloat(p.qty) || 0) * (parseFloat(p.rate) || 0);
                });
            }
        });
        
        const getAvgCost = (desc) => {
            if (!desc) return 0;
            const stats = productStats[desc.trim().toUpperCase()];
            if (!stats || stats.qty === 0) return 0;
            return stats.cost / stats.qty;
        };
        
        // Compute revenue and profit per bill
        const revenueData = invoices.map(invoice => {
            let totalCost = 0;
            let totalBillProfit = 0;
            let detailsHtml = '';
            
            if (invoice.products && Array.isArray(invoice.products)) {
                invoice.products.forEach(p => {
                    const desc = p.description || 'Unknown Item';
                    const qty = parseFloat(p.qty) || 0;
                    const sellingRate = parseFloat(p.rate) || 0;
                    
                    const costRate = getAvgCost(desc);
                    const productCost = qty * costRate;
                    totalCost += productCost;
                    
                    const profitPerUnit = sellingRate - costRate;
                    const totalProfitForProduct = profitPerUnit * qty;
                    totalBillProfit += totalProfitForProduct;
                    
                    detailsHtml += `<div style="margin-bottom: 4px; white-space: nowrap;">
                        ${desc} (&#8377;${Utils.formatCurrency(sellingRate)} - &#8377;${Utils.formatCurrency(costRate)}) 
                        &#8377;${Utils.formatCurrency(profitPerUnit)} &times; ${qty} = <strong>&#8377;${Utils.formatCurrency(totalProfitForProduct)}</strong>
                    </div>`;
                });
            }
            
            const discount = parseFloat(invoice.discountAmount) || parseFloat(invoice.discount) || 0;
            if (discount > 0) {
                detailsHtml += `<div style="margin-bottom: 4px; white-space: nowrap; color: #d32f2f;">
                    Discount: -&#8377;${Utils.formatCurrency(discount)}
                </div>`;
            }
            
            const profit = totalBillProfit - discount;
            
            return {
                billNo: String(invoice.invoiceNo).replace('INV-', ''),
                rawBillNo: invoice.invoiceNo,
                name: invoice.customerName || 'Unknown',
                profit: profit,
                revenue: invoice.subtotal || totalBillProfit + totalCost,
                cost: totalCost,
                detailsHtml: detailsHtml,
                date: invoice.invoiceDate || invoice.date || 'Unknown'
            };
        });
        
        // Sort in order (by bill no ascending)
        revenueData.sort((a, b) => parseInt(a.billNo) - parseInt(b.billNo));
        
        allRevenueData = revenueData;
        renderRevenue(allRevenueData);
        
    } catch (error) {
        console.error("Error loading revenue:", error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Error loading data.</td></tr>';
    }
}

function renderRevenue(revenueToRender) {
    const tableBody = document.getElementById('revenueTableBody');
    let html = '';
    let totalProfit = 0;
        
        revenueToRender.forEach(data => {
            html += `
                <tr>
                    <td><a href="sales.html?edit=${data.rawBillNo}" style="color: #2a5298; text-decoration: none; font-weight: bold; cursor: pointer;">#${data.billNo}</a></td>
                    <td>${data.date}</td>
                    <td>${data.name}</td>
                    <td style="font-size: 0.85em; color: #333; line-height: 1.4;">
                        ${data.detailsHtml}
                    </td>
                    <td style="color: ${data.profit >= 0 ? '#2e7d32' : '#d32f2f'}; font-weight: 600;">
                        &#8377;${Utils.formatCurrency(data.profit)}
                    </td>
                </tr>
            `;
            totalProfit += data.profit;
        });
        
        if (revenueToRender.length === 0) {
            html = '<tr><td colspan="5" style="text-align:center;">No bills found.</td></tr>';
        } else {
            html += `
                <tr style="background-color: #f8f9fa; font-weight: bold;">
                    <td colspan="4" style="text-align: right;">Total Net Profit:</td>
                    <td style="color: ${totalProfit >= 0 ? '#2e7d32' : '#d32f2f'};">
                        &#8377;${Utils.formatCurrency(totalProfit)}
                    </td>
                </tr>
            `;
        }
        
        tableBody.innerHTML = html;
}

// Search functionality
document.addEventListener('DOMContentLoaded', () => {
    const searchDateInput = document.getElementById('searchDateInput');
    const searchNameInput = document.getElementById('searchNameInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    function filterRevenue() {
        const dateTerm = searchDateInput.value.toLowerCase().trim();
        const nameTerm = searchNameInput.value.toLowerCase().trim();
        
        if (!dateTerm && !nameTerm) {
            renderRevenue(allRevenueData);
            return;
        }

        const filtered = allRevenueData.filter(data => {
            const matchesDate = !dateTerm || (data.date && data.date.includes(dateTerm));
            const matchesName = !nameTerm || (data.name && data.name.toLowerCase().includes(nameTerm));
            return matchesDate && matchesName;
        });
        
        renderRevenue(filtered);
    }

    if (searchDateInput) searchDateInput.addEventListener('input', filterRevenue);
    if (searchNameInput) searchNameInput.addEventListener('input', filterRevenue);
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchDateInput.value = '';
            searchNameInput.value = '';
            renderRevenue(allRevenueData);
        });
    }
});

