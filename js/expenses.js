document.addEventListener('DOMContentLoaded', () => {
    // Menu toggle logic is handled globally in utils.js

    // Check authentication
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // Elements
    const expenseIdInput = document.getElementById('expenseId');
    const expenseDateInput = document.getElementById('expenseDate');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseReasonInput = document.getElementById('expenseReason');
    const saveExpenseBtn = document.getElementById('saveExpenseBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const formTitle = document.getElementById('formTitle');
    
    const searchDateInput = document.getElementById('searchDateInput');
    const searchReasonInput = document.getElementById('searchReasonInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const expensesList = document.getElementById('expensesList');
    const totalExpensesAmount = document.getElementById('totalExpensesAmount');
    
    const dayTotalLabel = document.getElementById('dayTotalLabel');
    const dayTotalAmount = document.getElementById('dayTotalAmount');
    const monthTotalLabel = document.getElementById('monthTotalLabel');
    const monthTotalAmount = document.getElementById('monthTotalAmount');

    // Default Date to today
    expenseDateInput.valueAsDate = new Date();

    let allExpenses = [];

    // --- Load Data ---
    async function loadExpenses() {
        try {
            expensesList.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading expenses...</td></tr>';
            await db.ensureInitialized();
            allExpenses = await db.getAllExpenses();
            renderExpenses(allExpenses);
        } catch (error) {
            console.error('Error loading expenses:', error);
            expensesList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error loading expenses</td></tr>';
            Swal.fire('Error', 'Failed to load expenses', 'error');
        }
    }

    // --- Render Table ---
    function renderExpenses(expensesToRender) {
        expensesList.innerHTML = '';
        let total = 0;
        let dayTotal = 0;
        let monthTotal = 0;

        const dateTerm = searchDateInput.value.trim();
        let targetDay = new Date().toISOString().split('T')[0];
        let targetMonth = targetDay.substring(0, 7);
        let dayLabelText = "Today's Total:";
        let monthLabelText = "This Month's Total:";

        if (dateTerm) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateTerm)) {
                targetDay = dateTerm;
                targetMonth = dateTerm.substring(0, 7);
                dayLabelText = `Total for ${dateTerm}:`;
                monthLabelText = `Total for ${targetMonth}:`;
            } else if (/^\d{4}-\d{2}$/.test(dateTerm)) {
                targetDay = null; 
                targetMonth = dateTerm;
                dayLabelText = `Day Total:`;
                monthLabelText = `Total for ${targetMonth}:`;
            }
        }

        if (expensesToRender.length === 0) {
            expensesList.innerHTML = '<tr><td colspan="4" style="text-align: center;">No expenses found.</td></tr>';
            totalExpensesAmount.textContent = 'Rs. 0.00';
            dayTotalAmount.textContent = 'Rs. 0.00';
            monthTotalAmount.textContent = 'Rs. 0.00';
            dayTotalLabel.textContent = dayLabelText;
            monthTotalLabel.textContent = monthLabelText;
            return;
        }

        expensesToRender.forEach(expense => {
            const amount = parseFloat(expense.amount) || 0;
            total += amount;

            if (targetDay && expense.date === targetDay) {
                dayTotal += amount;
            }
            if (targetMonth && expense.date && expense.date.startsWith(targetMonth)) {
                monthTotal += amount;
            }

            const formattedDate = new Date(expense.date).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${expense.reason || '-'}</td>
                <td>Rs. ${Utils.formatCurrency(amount)}</td>
                <td class="action-buttons">
                    <button class="btn-edit" data-id="${expense.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" data-id="${expense.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
            expensesList.appendChild(tr);
        });

        // Update Total
        totalExpensesAmount.textContent = `Rs. ${Utils.formatCurrency(total)}`;
        dayTotalAmount.textContent = `Rs. ${Utils.formatCurrency(dayTotal)}`;
        monthTotalAmount.textContent = `Rs. ${Utils.formatCurrency(monthTotal)}`;
        dayTotalLabel.textContent = dayLabelText;
        monthTotalLabel.textContent = monthLabelText;

        // Attach event listeners to buttons
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => handleEdit(e.currentTarget.dataset.id));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => handleDelete(e.currentTarget.dataset.id));
        });
    }

    // --- Save/Update ---
    saveExpenseBtn.addEventListener('click', async () => {
        const date = expenseDateInput.value;
        const amount = parseFloat(expenseAmountInput.value);
        const reason = expenseReasonInput.value.trim();
        const id = expenseIdInput.value;

        if (!date || isNaN(amount) || amount <= 0 || !reason) {
            Swal.fire('Warning', 'Please fill all fields with valid data.', 'warning');
            return;
        }

        saveExpenseBtn.disabled = true;
        saveExpenseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const expenseData = {
                id: id || Date.now().toString(),
                date: date,
                amount: amount,
                reason: reason,
                updatedAt: new Date().toISOString()
            };

            await db.saveExpense(expenseData);
            Swal.fire('Success', 'Expense saved successfully!', 'success');
            
            resetForm();
            loadExpenses();
        } catch (error) {
            console.error('Error saving expense:', error);
            Swal.fire('Error', 'Failed to save expense.', 'error');
        } finally {
            saveExpenseBtn.disabled = false;
            saveExpenseBtn.innerHTML = '<i class="fas fa-save"></i> Save';
        }
    });

    // --- Edit ---
    function handleEdit(id) {
        const expense = allExpenses.find(e => e.id === id);
        if (expense) {
            expenseIdInput.value = expense.id;
            expenseDateInput.value = expense.date;
            expenseAmountInput.value = expense.amount;
            expenseReasonInput.value = expense.reason;

            formTitle.textContent = 'Edit Expense';
            cancelEditBtn.style.display = 'inline-block';
            
            // Scroll to form on mobile
            if (window.innerWidth < 992) {
                document.getElementById('menuPanel').classList.add('menu-open');
            }
        }
    }

    cancelEditBtn.addEventListener('click', resetForm);

    function resetForm() {
        expenseIdInput.value = '';
        expenseDateInput.valueAsDate = new Date();
        expenseAmountInput.value = '';
        expenseReasonInput.value = '';
        formTitle.textContent = 'Add Expense';
        cancelEditBtn.style.display = 'none';
    }

    // --- Delete ---
    async function handleDelete(id) {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await db.deleteExpense(id);
                Swal.fire('Deleted!', 'Expense has been deleted.', 'success');
                loadExpenses();
            } catch (error) {
                console.error('Error deleting expense:', error);
                Swal.fire('Error', 'Failed to delete expense.', 'error');
            }
        }
    }

    // --- Search ---
    function filterExpenses() {
        const dateTerm = searchDateInput.value.toLowerCase().trim();
        const reasonTerm = searchReasonInput.value.toLowerCase().trim();
        
        if (!dateTerm && !reasonTerm) {
            renderExpenses(allExpenses);
            return;
        }

        const filtered = allExpenses.filter(expense => {
            const matchesDate = !dateTerm || (expense.date && expense.date.includes(dateTerm));
            const matchesReason = !reasonTerm || (expense.reason && expense.reason.toLowerCase().includes(reasonTerm));
            return matchesDate && matchesReason;
        });
        renderExpenses(filtered);
    }

    searchDateInput.addEventListener('input', filterExpenses);
    searchReasonInput.addEventListener('input', filterExpenses);
    
    clearSearchBtn.addEventListener('click', () => {
        searchDateInput.value = '';
        searchReasonInput.value = '';
        renderExpenses(allExpenses);
    });

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    
    const handleLogout = () => {
        firebase.auth().signOut().then(() => {
            localStorage.clear();
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error('Sign Out Error', error);
            localStorage.clear();
            window.location.href = 'login.html';
        });
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);

    // Init
    loadExpenses();
});
