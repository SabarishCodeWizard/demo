// supplier-details.js - Supplier Details page for Purchase Bills

function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href='login.html';
        return false;
    }
    return true;
}

function logout() {
    localStorage.clear();
    window.location.href='login.html';
}

// ─── Globals ─────────────────────────────────────────────────────────────────
let allSuppliers = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) return;

    setupEventListeners();

    try {
        await db.init();
        await loadAllSuppliers();
    } catch (error) {
        console.error('Error initializing supplier details page:', error);
        showError('Failed to load supplier data: ' + error.message);
    }
});

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const menuPanel  = document.getElementById('menuPanel');
    if (menuToggle && menuPanel) {
        menuToggle.addEventListener('click', () => menuPanel.classList.toggle('menu-open'));
    }

    const searchBtn    = document.getElementById('searchBtn');
    const clearBtn     = document.getElementById('clearSearch');
    const refreshBtn   = document.getElementById('refreshBtn');
    const exportBtn    = document.getElementById('exportBtn');
    const searchInput  = document.getElementById('customerSearch');

    if (searchBtn)   searchBtn.addEventListener('click', doSearch);
    if (clearBtn)    clearBtn.addEventListener('click', clearSearch);
    if (refreshBtn)  refreshBtn.addEventListener('click', loadAllSuppliers);
    if (exportBtn)   exportBtn.addEventListener('click', exportCSV);
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
}

// ─── Load & Process ──────────────────────────────────────────────────────────
async function loadAllSuppliers() {
    try {
        const bills = await db.getAllPurchaseBills();
        allSuppliers = processSupplierData(bills);
        updateStats(allSuppliers);
        displaySuppliers(allSuppliers);
    } catch (error) {
        console.error('Error loading supplier data:', error);
        showError('Error loading supplier data: ' + error.message);
    }
}

function processSupplierData(bills) {
    if (!bills || !Array.isArray(bills)) return [];

    const supplierMap = new Map();

    bills.forEach(bill => {
        if (!bill || !bill.supplierName) return;

        const key = bill.supplierName.trim();

        if (!supplierMap.has(key)) {
            supplierMap.set(key, {
                name:          key,
                phone:         bill.supplierPhone   || '',
                address:       bill.supplierAddress || '',
                totalBills:    0,
                totalAmount:   0,
                totalPaid:     0,
                totalDiscount: 0,
                balanceDue:    0,
                invoiceNos:    []
            });
        }

        const s = supplierMap.get(key);
        s.totalBills++;
        s.totalAmount   += parseFloat(bill.grandTotal)       || 0;
        s.totalPaid     += parseFloat(bill.payment?.totalPaid || bill.amountPaid) || 0;
        s.totalDiscount += parseFloat(bill.discount)         || 0;
        s.balanceDue    += parseFloat(bill.payment?.balanceDue || bill.balanceDue) || 0;

        // Clean invoice number (strip P- prefix, zero-pad to 3 digits)
        if (bill.invoiceNo) {
            let inv = bill.invoiceNo.toString();
            if (inv.startsWith('P-')) inv = inv.substring(2);
            const num = parseInt(inv, 10);
            inv = isNaN(num) ? inv : String(num).padStart(3, '0');
            s.invoiceNos.push(inv);
        }
    });

    // Sort invoice numbers descending inside each supplier
    supplierMap.forEach(s => {
        s.invoiceNos.sort((a, b) => parseInt(b) - parseInt(a));
    });

    return Array.from(supplierMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Stats ────────────────────────────────────────────────────────────────────
function updateStats(suppliers) {
    const totalSuppliers = suppliers.length;
    const totalBills     = suppliers.reduce((s, x) => s + x.totalBills, 0);
    const totalAmount    = suppliers.reduce((s, x) => s + x.totalAmount, 0);
    const totalPaid      = suppliers.reduce((s, x) => s + x.totalPaid, 0);
    const totalDiscount  = suppliers.reduce((s, x) => s + x.totalDiscount, 0);
    const totalBalance   = suppliers.reduce((s, x) => s + x.balanceDue, 0);

    setEl('totalCustomers', totalSuppliers);
    setEl('totalInvoices',  totalBills);
    setEl('totalRevenue',   '₹' + fmt(totalAmount));
    setEl('totalPaid',      '₹' + fmt(totalPaid));
    setEl('totalDiscount',  '₹' + fmt(totalDiscount));
    setEl('pendingBalance', '₹' + fmt(totalBalance));
}

// ─── Display ──────────────────────────────────────────────────────────────────
function displaySuppliers(suppliers) {
    const tbody     = document.getElementById('customerTableBody');
    const noSection = document.getElementById('noCustomers');

    if (!suppliers || suppliers.length === 0) {
        tbody.innerHTML = '';
        noSection.style.display = 'block';
        return;
    }

    noSection.style.display = 'none';

    tbody.innerHTML = suppliers.map((s, index) => {
        const safeId = s.phone
            ? s.phone.replace(/[^a-zA-Z0-9]/g, '')
            : 'supplier_' + index;

        const balanceColor = s.balanceDue > 0
            ? 'color:#c62828;font-weight:bold;'
            : 'color:#2e7d32;';

        return `
        <tr id="row-${safeId}">
            <td>
                <span id="display-name-${safeId}"><strong>${escHtml(s.name)}</strong></span>
                <input id="edit-name-${safeId}" type="text" value="${escHtml(s.name)}"
                    style="display:none;width:100%;padding:4px;border:1px solid #ccc;border-radius:4px;">
            </td>
            <td class="phone-number" title="Click to reveal full number" onclick="if(document.getElementById('edit-phone-${safeId}').style.display === 'none') togglePhoneNumber(document.getElementById('display-phone-${safeId}'), '${escHtml(s.phone || '')}')">
                <span id="display-phone-${safeId}">${s.phone ? escHtml(formatPhoneNumber(s.phone)) : '—'}</span>
                <input id="edit-phone-${safeId}" type="text" value="${escHtml(s.phone)}"
                    style="display:none;width:120px;padding:4px;border:1px solid #ccc;border-radius:4px;">
            </td>
            <td>
                <span id="display-address-${safeId}">${escHtml(s.address) || '—'}</span>
                <input id="edit-address-${safeId}" type="text" value="${escHtml(s.address)}"
                    style="display:none;width:100%;padding:4px;border:1px solid #ccc;border-radius:4px;">
            </td>
            <td style="text-align:center;">${s.totalBills}</td>
            <td>₹${fmt(s.totalAmount)}</td>
            <td>₹${fmt(s.totalPaid)}</td>
            <td>₹${fmt(s.totalDiscount)}</td>
            <td style="${balanceColor}">₹${fmt(s.balanceDue)}</td>

        </tr>`;
    }).join('');
}

// ─── Inline Edit / Save ───────────────────────────────────────────────────────
function editSupplier(safeId) {
    // Show input fields, hide display spans
    ['name', 'phone', 'address'].forEach(field => {
        const display = document.getElementById(`display-${field}-${safeId}`);
        const input   = document.getElementById(`edit-${field}-${safeId}`);
        if (display) display.style.display = 'none';
        if (input)   input.style.display   = 'inline-block';
    });
    // Swap Edit → Save
    document.getElementById(`edit-btn-${safeId}`).style.display = 'none';
    document.getElementById(`save-btn-${safeId}`).style.display = 'inline-block';
}

async function saveSupplier(safeId, origName) {
    const newName    = (document.getElementById(`edit-name-${safeId}`)?.value    || '').trim();
    const newPhone   = (document.getElementById(`edit-phone-${safeId}`)?.value   || '').trim();
    const newAddress = (document.getElementById(`edit-address-${safeId}`)?.value || '').trim();

    if (!newName) { alert('Supplier name cannot be empty.'); return; }

    if (newPhone && newPhone.length > 0 && newPhone.length < 10) {
        alert('Please enter a valid 10-digit phone number.');
        return;
    }

    try {
        // Update display spans immediately (optimistic UI)
        const nameDisp = document.getElementById(`display-name-${safeId}`);
        if (nameDisp) { nameDisp.innerHTML = `<strong>${escHtml(newName)}</strong>`; nameDisp.style.display = ''; }

        const phoneDisp = document.getElementById(`display-phone-${safeId}`);
        if (phoneDisp) {
            phoneDisp.textContent = newPhone ? formatPhoneNumber(newPhone) : '—';
            phoneDisp.style.display = '';
            phoneDisp.classList.remove('phone-revealed');
        }

        const addrDisp = document.getElementById(`display-address-${safeId}`);
        if (addrDisp) { addrDisp.textContent = newAddress || '—'; addrDisp.style.display = ''; }

        // Hide inputs
        ['name', 'phone', 'address'].forEach(field => {
            const input = document.getElementById(`edit-${field}-${safeId}`);
            if (input) input.style.display = 'none';
        });

        // Restore buttons
        document.getElementById(`edit-btn-${safeId}`).style.display = 'inline-block';
        document.getElementById(`save-btn-${safeId}`).style.display = 'none';

        // Persist update in Firebase — update all purchase bills with this supplier name
        const bills = await db.getAllPurchaseBills();
        const toUpdate = bills.filter(b => (b.supplierName || '').trim() === origName);

        for (const bill of toUpdate) {
            const updated = {
                ...bill,
                supplierName:    newName,
                supplierPhone:   newPhone   || bill.supplierPhone   || '',
                supplierAddress: newAddress || bill.supplierAddress || ''
            };
            await db.savePurchaseBill(updated);
        }
        
        // Also update the supplier document if phone is provided
        if (newPhone) {
            await db.saveSupplier({
                name: newName,
                phone: newPhone,
                address: newAddress
            });
        }

        // Update local cache
        const sup = allSuppliers.find(s => s.name === origName);
        if (sup) { sup.name = newName; sup.phone = newPhone; sup.address = newAddress; }

        alert(`✅ Supplier "${newName}" updated successfully!`);

    } catch (err) {
        console.error('Error saving supplier:', err);
        alert('❌ Failed to save changes. Please try again.');
    }
}

// ─── Search ───────────────────────────────────────────────────────────────────
function doSearch() {
    const q = (document.getElementById('customerSearch').value || '').toLowerCase().trim();
    if (!q) { displaySuppliers(allSuppliers); return; }
    const filtered = allSuppliers.filter(s =>
        s.name.toLowerCase().includes(q)    ||
        s.phone.toLowerCase().includes(q)   ||
        s.address.toLowerCase().includes(q)
    );
    displaySuppliers(filtered);
}

// ─── Phone Masking Utilities ──────────────────────────────────────────────────
function formatPhoneNumber(phone) {
    if (!phone) return 'N/A';
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length <= 3) return cleanPhone;
    
    const visibleDigits = 3;
    const maskedPart = '*'.repeat(cleanPhone.length - visibleDigits);
    const visiblePart = cleanPhone.slice(-visibleDigits);
    return maskedPart + visiblePart;
}

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

function clearSearch() {
    document.getElementById('customerSearch').value = '';
    displaySuppliers(allSuppliers);
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV() {
    if (!allSuppliers.length) { alert('No supplier data to export.'); return; }

    const headers = ['Supplier Name','Phone','Address','Total Bills','Total Amount','Amount Paid','Discount','Balance Due','Invoice Numbers'];
    const rows = allSuppliers.map(s => [
        s.name,
        s.phone,
        s.address,
        s.totalBills,
        s.totalAmount.toFixed(2),
        s.totalPaid.toFixed(2),
        s.totalDiscount.toFixed(2),
        s.balanceDue.toFixed(2),
        s.invoiceNos.join('; ')
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `supplier-details-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(num) {
    return parseFloat(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function showError(msg) {
    const tbody = document.getElementById('customerTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="color:#c62828;text-align:center;padding:20px;">${msg}</td></tr>`;
}
