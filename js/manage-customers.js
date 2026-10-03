// manage-customers.js

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
        await loadCustomers();
    } catch (error) {
        console.error('Error initializing manage customers page:', error);
        alert('Failed to initialize data. See console for details.');
    }
});

let allCustomers = [];

function setupEventListeners() {
    const form = document.getElementById('addCustomerForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addCustomer();
        });
    }
}

async function loadCustomers() {
    try {
        allCustomers = await db.getAllCustomers();
        displayCustomers(allCustomers);
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

function displayCustomers(customers) {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;

    if (!customers || customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No customers found.</td></tr>';
        return;
    }

    tbody.innerHTML = customers.map((c, index) => {
        const safeId = c.phone ? c.phone.replace(/[^a-zA-Z0-9]/g, '') : 'cust_' + index;
        return `
        <tr id="row-${safeId}">
            <td>
                <span id="display-name-${safeId}">${escapeHtml(c.name)}</span>
                <input id="edit-name-${safeId}" type="text" value="${escapeHtml(c.name)}" style="display:none; width:100%; padding:4px;">
            </td>
            <td>
                <span id="display-phone-${safeId}">${escapeHtml(c.phone || 'N/A')}</span>
                <input id="edit-phone-${safeId}" type="text" value="${escapeHtml(c.phone || '')}" style="display:none; width:100%; padding:4px;">
            </td>
            <td>
                <span id="display-address-${safeId}">${escapeHtml(c.address || 'N/A')}</span>
                <input id="edit-address-${safeId}" type="text" value="${escapeHtml(c.address || '')}" style="display:none; width:100%; padding:4px;">
            </td>
            <td style="white-space: nowrap; text-align: center;">
                <button class="btn-primary" id="edit-btn-${safeId}" onclick="startEdit('${safeId}')" style="padding: 6px 12px; width: 85px; text-align: center;">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn-primary" id="save-btn-${safeId}" onclick="saveEdit('${safeId}', '${escapeHtml(c.phone)}', '${escapeHtml(c.name)}')" style="display:none; background-color: #2ecc71; padding: 6px 12px; width: 85px; text-align: center;">
                    <i class="fas fa-save"></i> Save
                </button>
                <button class="btn-danger" onclick="deleteCustomer('${escapeHtml(c.phone)}')" style="padding: 6px 12px; width: 85px; text-align: center; margin-left: 5px;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function addCustomer() {
    const phone = document.getElementById('newCustomerPhone').value.trim();
    const name = document.getElementById('newCustomerName').value.trim();
    const address = document.getElementById('newCustomerAddress').value.trim();

    if (!phone || phone.length < 10) {
        alert("Please enter a valid phone number (at least 10 digits).");
        return;
    }
    if (!name) {
        alert("Customer name is required.");
        return;
    }

    try {
        const existing = await db.getCustomer(phone);
        if (existing) {
            alert("A customer with this phone number already exists.");
            return;
        }

        await db.saveCustomer({ phone, name, address });
        
        // Reset form
        document.getElementById('addCustomerForm').reset();
        
        // Reload list
        await loadCustomers();
        alert("Customer added successfully!");
    } catch (error) {
        console.error('Error adding customer:', error);
        alert('Failed to add customer.');
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
            const existing = await db.getCustomer(newPhone);
            if (existing) {
                alert("A customer with the new phone number already exists.");
                return;
            }
        }

        // Update all invoices to point to the new name/phone
        await db.updateCustomerDetails(originalName, newName, newPhone, newAddress);
        
        // If phone changed, we must delete the old document manually
        if (newPhone !== originalPhone) {
            try {
                await db.firestore.collection('customers').doc(originalPhone).delete();
                db._cache.customers = null;
            } catch(e) {
                console.error("Failed to delete old customer record:", e);
            }
        }
        
        await loadCustomers();
        alert("Customer updated successfully!");
    } catch (error) {
        console.error("Error updating customer:", error);
        alert("Failed to update customer.");
    }
}

async function deleteCustomer(phone) {
    if (!phone) return;
    
    const confirmDelete = confirm("WARNING: Deleting this customer will also permanently delete ALL INVOICES associated with them. Are you absolutely sure you want to proceed?");
    
    if (confirmDelete) {
        try {
            await db.deleteCustomer(phone);
            await loadCustomers();
            alert("Customer and associated invoices deleted successfully.");
        } catch (error) {
            console.error("Error deleting customer:", error);
            alert("Failed to delete customer.");
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
