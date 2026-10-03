// manage-suppliers.js

// Authentication check
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) return;

    try {
        await db.init();
        setupEventListeners();
        await loadSuppliers();
    } catch (error) {
        console.error('Error initializing manage suppliers page:', error);
        alert('Failed to initialize data. See console for details.');
    }
});

let allSuppliers = [];

function setupEventListeners() {
    const form = document.getElementById('addSupplierForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addSupplier();
        });
    }
}

async function loadSuppliers() {
    try {
        allSuppliers = await db.getAllSuppliers();
        displaySuppliers(allSuppliers);
    } catch (error) {
        console.error('Error loading suppliers:', error);
    }
}

function displaySuppliers(suppliers) {
    const tbody = document.getElementById('supplierTableBody');
    if (!tbody) return;

    if (!suppliers || suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No suppliers found.</td></tr>';
        return;
    }

    tbody.innerHTML = suppliers.map((s, index) => {
        const safeId = s.phone ? s.phone.replace(/[^a-zA-Z0-9]/g, '') : 'supp_' + index;
        return `
        <tr id="row-${safeId}">
            <td>
                <span id="display-name-${safeId}">${escapeHtml(s.name)}</span>
                <input id="edit-name-${safeId}" type="text" value="${escapeHtml(s.name)}" style="display:none; width:100%; padding:4px;">
            </td>
            <td>
                <span id="display-phone-${safeId}">${escapeHtml(s.phone || 'N/A')}</span>
                <input id="edit-phone-${safeId}" type="text" value="${escapeHtml(s.phone || '')}" style="display:none; width:100%; padding:4px;">
            </td>
            <td>
                <span id="display-address-${safeId}">${escapeHtml(s.address || 'N/A')}</span>
                <input id="edit-address-${safeId}" type="text" value="${escapeHtml(s.address || '')}" style="display:none; width:100%; padding:4px;">
            </td>
            <td style="white-space: nowrap; text-align: center;">
                <button class="btn-primary" id="edit-btn-${safeId}" onclick="startEdit('${safeId}')" style="padding: 6px 12px; width: 85px; text-align: center;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-primary" id="save-btn-${safeId}" onclick="saveEdit('${safeId}', '${escapeHtml(s.phone)}', '${escapeHtml(s.name)}')" style="display:none; background-color: #2ecc71; padding: 6px 12px; width: 85px; text-align: center;">
                    <i class="fas fa-save"></i> Save
                </button>
                <button class="btn-danger" onclick="deleteSupplier('${escapeHtml(s.phone)}')" style="padding: 6px 12px; width: 85px; text-align: center; margin-left: 5px;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function addSupplier() {
    const phone = document.getElementById('newSupplierPhone').value.trim();
    const name = document.getElementById('newSupplierName').value.trim();
    const address = document.getElementById('newSupplierAddress').value.trim();

    if (!phone || phone.length < 10) {
        alert("Please enter a valid phone number (at least 10 digits).");
        return;
    }
    if (!name) {
        alert("Supplier name is required.");
        return;
    }

    try {
        const existing = await db.getSupplier(phone);
        if (existing) {
            alert("A supplier with this phone number already exists.");
            return;
        }

        await db.saveSupplier({ phone, name, address });
        
        // Reset form
        document.getElementById('addSupplierForm').reset();
        
        // Reload list
        await loadSuppliers();
        alert("Supplier added successfully!");
    } catch (error) {
        console.error('Error adding supplier:', error);
        alert('Failed to add supplier.');
    }
}

function startEdit(safeId) {
    ['name', 'phone', 'address'].forEach(field => {
        const display = document.getElementById(`display-${field}-${safeId}`);
        const input = document.getElementById(`edit-${field}-${safeId}`);
        if (display) display.style.display = 'none';
        if (input) input.style.display = 'inline-block';
    });
    
    document.getElementById(`edit-btn-${safeId}`).style.display = 'none';
    document.getElementById(`save-btn-${safeId}`).style.display = 'inline-block';
}

async function saveEdit(safeId, originalPhone, originalName) {
    const newName = document.getElementById(`edit-name-${safeId}`).value.trim();
    const newPhone = document.getElementById(`edit-phone-${safeId}`).value.trim();
    const newAddress = document.getElementById(`edit-address-${safeId}`).value.trim();
    
    if (!newName) {
        alert("Name cannot be empty.");
        return;
    }
    if (!newPhone || newPhone.length < 10) {
        alert("Please enter a valid phone number.");
        return;
    }

    try {
        if (newPhone !== originalPhone) {
            const existing = await db.getSupplier(newPhone);
            if (existing) {
                alert("A supplier with the new phone number already exists.");
                return;
            }
        }

        // Persist update in Firebase — update all purchase bills with this supplier name/phone
        const bills = await db.getAllPurchaseBills();
        const toUpdate = bills.filter(b => (b.supplierName || '').trim() === originalName);

        for (const bill of toUpdate) {
            const updated = {
                ...bill,
                supplierName: newName,
                supplierPhone: newPhone,
                supplierAddress: newAddress || bill.supplierAddress || ''
            };
            await db.savePurchaseBill(updated);
        }
        
        // Also update the supplier document
        await db.saveSupplier({
            name: newName,
            phone: newPhone,
            address: newAddress
        });
        
        // If phone changed, we must delete the old document manually
        if (newPhone !== originalPhone) {
            try {
                await db.firestore.collection('suppliers').doc(originalPhone).delete();
                db._cache.suppliers = null;
            } catch(e) {
                console.error("Failed to delete old supplier record:", e);
            }
        }

        await loadSuppliers();
        alert("Supplier updated successfully!");
    } catch (error) {
        console.error("Error updating supplier:", error);
        alert("Failed to update supplier.");
    }
}

async function deleteSupplier(phone) {
    if (!phone) return;
    
    const confirmDelete = confirm("Are you sure you want to delete this supplier?");
    
    if (confirmDelete) {
        try {
            await db.deleteSupplier(phone);
            await loadSuppliers();
            alert("Supplier deleted successfully.");
        } catch (error) {
            console.error("Error deleting supplier:", error);
            alert("Failed to delete supplier.");
        }
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
