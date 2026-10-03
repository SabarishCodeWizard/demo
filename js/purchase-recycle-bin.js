// Recycle Bin Functionality
class RecycleBinManager {
    constructor() {
        this.currentRestoreItem = null;
        this.currentDeleteItem = null;
        this.init();
    }

    async init() {
        // Show skeleton immediately
        this.showBinSkeletonLoading();
        
        await this.setupEventListeners();
        await this.loadRecycleBinItems();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadRecycleBinItems();
        });

        // Empty bin button
        document.getElementById('emptyBinBtn').addEventListener('click', () => {
            this.showEmptyBinModal();
        });

        // Filter
        document.getElementById('filterType').addEventListener('change', () => {
            this.filterItems();
        });

        // Search
        document.getElementById('searchBin').addEventListener('input', () => {
            this.filterItems();
        });

        // Modal event listeners
        this.setupModalEventListeners();
    }

    setupModalEventListeners() {
        // Restore modal
        document.getElementById('cancelRestore').addEventListener('click', () => {
            this.hideRestoreModal();
        });

        document.getElementById('confirmRestore').addEventListener('click', () => {
            this.confirmRestore();
        });

        // Delete modal
        document.getElementById('cancelDelete').addEventListener('click', () => {
            this.hideDeleteModal();
        });

        document.getElementById('confirmDelete').addEventListener('click', () => {
            this.confirmPermanentDelete();
        });

        // View modal
        document.getElementById('closeViewModal').addEventListener('click', () => {
            this.hideViewModal();
        });

        // Empty bin modal
        document.getElementById('cancelEmptyBin').addEventListener('click', () => {
            this.hideEmptyBinModal();
        });

        document.getElementById('confirmEmptyBin').addEventListener('click', () => {
            this.confirmEmptyBin();
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // Close modals on X button
        document.querySelectorAll('.close-modal').forEach(button => {
            button.addEventListener('click', (e) => {
                button.closest('.modal-overlay').style.display = 'none';
            });
        });
    }

    async loadRecycleBinItems() {
        try {
            // Show skeleton loading before fetching
            this.showBinSkeletonLoading();

            // REMOVED: showLoading('Loading Recycle Bin', 'Retrieving deleted items...');

            const items = await db.getPurchaseRecycleBinItems();
            this.loadedItems = items;
            
            // Re-render data
            this.displayItems(items);
            this.updateStatistics(items);

            // REMOVED: hideLoading();
            this.hideBinSkeletonLoading();

        } catch (error) {
            // REMOVED: hideLoading();
            this.hideBinSkeletonLoading();
            console.error('Error loading recycle bin items:', error);
            this.showError('Failed to load recycle bin items');
            
            // Show error state
            this.showErrorState('Failed to load recycle bin items. Please try again.');
        }
    }

    displayItems(items) {
        const itemsList = document.getElementById('itemsList');
        const emptyState = document.getElementById('emptyState');
        const emptyBinBtn = document.getElementById('emptyBinBtn');

        if (items.length === 0) {
            itemsList.innerHTML = '';
            emptyState.style.display = 'block';
            emptyBinBtn.disabled = true;
            return;
        }

        emptyState.style.display = 'none';
        emptyBinBtn.disabled = false;

        itemsList.innerHTML = items.map(item => this.createItemHTML(item)).join('');
        
        // Add event listeners to the newly created buttons
        this.attachItemEventListeners();
    }

    createItemHTML(item) {
        const deletedDate = new Date(item.deletedAt?.toDate?.() || item.deletedAt);
        const daysAgo = Math.floor((new Date() - deletedDate) / (1000 * 60 * 60 * 24));
        const formattedDate = deletedDate.toLocaleDateString('en-IN');

        return `
        <div class="bin-item" data-item-id="${item.id}" data-type="${item.type}">
            <div class="bin-item-header">
                <div class="item-info">
                    <h4>
                        ${item.type === 'purchase_invoice' ? '<i class="fas fa-file-invoice"></i> Invoice' : ''}
                        ${String(item.originalId).replace('P-', '')}
                    </h4>
                    <div class="item-meta">
                        <span><i class="fas fa-calendar"></i> ${formattedDate} (${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)</span>
                        <span><i class="fas fa-user"></i> ${this.escapeHtml(item.supplierName)}</span>
                        <span><i class="fas fa-indian-rupee-sign"></i> ₹${Utils.formatCurrency(item.grandTotal)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn-primary btn-view" data-id="${item.id}">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-restore" data-id="${item.id}">
                        <i class="fas fa-trash-restore"></i> Restore
                    </button>
                    <button class="btn-permanent-delete" data-id="${item.id}">
                        <i class="fas fa-trash"></i> Delete Permanently
                    </button>
                </div>
            </div>
        </div>
        `;
    }

    attachItemEventListeners() {
        // View buttons
        document.querySelectorAll('.btn-view').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-id');
                this.showViewModal(itemId);
            });
        });

        // Restore buttons
        document.querySelectorAll('.btn-restore').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-id');
                this.showRestoreModal(itemId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.btn-permanent-delete').forEach(button => {
            button.addEventListener('click', (e) => {
                const itemId = e.currentTarget.getAttribute('data-id');
                this.showDeleteModal(itemId);
            });
        });
    }

    updateStatistics(items) {
        const totalItems = items.length;
        const purchaseBillItems = items.filter(item => item.type === 'purchase_invoice').length;

        // Find oldest item
        let oldestDate = null;
        if (items.length > 0) {
            const dates = items.map(item => new Date(item.deletedAt?.toDate?.() || item.deletedAt));
            oldestDate = new Date(Math.min(...dates));
        }

        // Only update if elements exist (hideBinSkeletonLoading clears the skeleton placeholders)
        const totalItemsEl = document.getElementById('totalItems');
        const totalPurchaseBillsEl = document.getElementById('totalPurchaseBills');
        const oldestItemEl = document.getElementById('oldestItem');
        
        if (totalItemsEl) totalItemsEl.textContent = totalItems;
        if (totalPurchaseBillsEl) totalPurchaseBillsEl.textContent = purchaseBillItems;
        if (oldestItemEl) {
             oldestItemEl.textContent = oldestDate ?
                `${Math.floor((new Date() - oldestDate) / (1000 * 60 * 60 * 24))} days` : '-';
        }
    }

    filterItems() {
        const filterType = document.getElementById('filterType').value;
        const searchTerm = document.getElementById('searchBin').value.toLowerCase();

        const items = document.querySelectorAll('.bin-item');

        items.forEach(item => {
            const type = item.dataset.type;
            const text = item.textContent.toLowerCase();

            const typeMatch = filterType === 'all' || type === filterType;
            const searchMatch = text.includes(searchTerm);

            item.style.display = typeMatch && searchMatch ? 'block' : 'none';
        });
    }

    // View functionality
    showViewModal(itemId) {
        if (!this.loadedItems) return;
        const item = this.loadedItems.find(i => i.id === itemId);
        if (!item) return;

        let content = '';
        if (item.type === 'purchase_invoice') {
            const purchaseBillData = item.data || {};
            const deletedDateStr = item.deletedAt?.toDate ? item.deletedAt.toDate().toLocaleString('en-IN') : new Date(item.deletedAt).toLocaleString('en-IN');
            
            // Format invoice date if it exists
            let purchaseBillDateStr = 'N/A';
            if (item.invoiceDate) {
                purchaseBillDateStr = new Date(item.invoiceDate).toLocaleDateString('en-IN');
            } else if (purchaseBillData.createdAt) {
                purchaseBillDateStr = new Date(purchaseBillData.createdAt).toLocaleDateString('en-IN');
            }
            
            let itemsHtml = '<tr><td colspan="4" style="text-align: center; padding: 10px;">No items found</td></tr>';
            // Use purchaseBillData.products
            if (purchaseBillData.products && purchaseBillData.products.length > 0) {
                itemsHtml = purchaseBillData.products.map(i => `
                    <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
                        <td style="padding: 8px;">${this.escapeHtml(i.description || '')}</td>
                        <td style="padding: 8px; text-align: center;">${i.qty || 0}</td>
                        <td style="padding: 8px; text-align: right;">₹${Utils.formatCurrency(i.rate || 0)}</td>
                        <td style="padding: 8px; text-align: right;">₹${Utils.formatCurrency(i.amount || 0)}</td>
                    </tr>
                `).join('');
            }

            content = `
                <div class="view-invoice-details" style="font-size: 0.95rem; line-height: 1.6;">
                    <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: var(--primary-color); font-size: 1.2rem;">Purchase Bill #${this.escapeHtml(String(item.originalId || purchaseBillData.invoiceNo).replace('P-', ''))}</h4>
                        <span style="font-size: 0.85rem; color: #666;"><strong>Date:</strong> ${purchaseBillDateStr}</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; padding: 0 5px;">
                        <div>
                            <p style="margin: 5px 0;"><strong>Supplier:</strong> ${this.escapeHtml(item.supplierName || 'N/A')}</p>
                            <p style="margin: 5px 0;"><strong>Phone:</strong> ${this.escapeHtml(item.supplierPhone || 'N/A')}</p>
                        </div>
                        <div>
                            <p style="margin: 5px 0;"><strong>Address:</strong> ${this.escapeHtml(purchaseBillData.supplierAddress || 'N/A')}</p>
                            <p style="margin: 5px 0; color: var(--danger-color); font-size: 0.85rem;"><i class="fas fa-trash"></i> Deleted: ${deletedDateStr}</p>
                        </div>
                    </div>
                    
                    <div style="margin: 15px 0; background-color: #fff; border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color); background-color: var(--bg-light);">
                                    <th style="padding: 10px 8px; text-align: left;">Description</th>
                                    <th style="padding: 10px 8px; text-align: center;">Qty</th>
                                    <th style="padding: 10px 8px; text-align: right;">Rate</th>
                                    <th style="padding: 10px 8px; text-align: right;">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; margin-top: 15px;">
                        <div style="width: 250px; background-color: var(--bg-light); padding: 15px; border-radius: 6px; border: 1px solid var(--border-color);">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>Subtotal:</span>
                                <span>₹${Utils.formatCurrency(purchaseBillData.subtotal || 0)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>Old Balance:</span>
                                <span>₹${Utils.formatCurrency(purchaseBillData.previousBalance || 0)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
                                <span>Grand Total:</span>
                                <span>₹${Utils.formatCurrency(item.grandTotal || purchaseBillData.grandTotal || 0)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: var(--success-color);">
                                <span>Paid:</span>
                                <span>₹${Utils.formatCurrency(purchaseBillData.amountPaid || 0)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: bold; color: var(--danger-color);">
                                <span>Balance Due:</span>
                                <span>₹${Utils.formatCurrency(purchaseBillData.balanceDue || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            content = `<p style="padding: 20px; text-align: center; color: #666;">Preview not available for this item type.</p>`;
        }

        document.getElementById('viewPreview').innerHTML = content;
        document.getElementById('viewModal').style.display = 'flex';
    }

    hideViewModal() {
        document.getElementById('viewModal').style.display = 'none';
    }

    // Restore functionality
    showRestoreModal(itemId) {
        this.currentRestoreItem = itemId;
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        const itemName = itemElement?.querySelector('h4')?.textContent || 'Item';

        document.getElementById('restorePreview').innerHTML = `
            <strong>${itemName}</strong> will be restored to its original location.
        `;

        document.getElementById('restoreModal').style.display = 'flex';
    }

    hideRestoreModal() {
        document.getElementById('restoreModal').style.display = 'none';
        this.currentRestoreItem = null;
    }

    async confirmRestore() {
        if (!this.currentRestoreItem) return;

        const restoreButton = document.getElementById('confirmRestore');

        try {
            showLoading('Restoring Item', 'Please wait while we restore the item...');
            
            await db.restorePurchaseFromRecycleBin(this.currentRestoreItem);
            
            // Find the element *before* reloading, as the ID might be reused or item removed
            const originalButton = document.querySelector(`.btn-restore[data-id="${this.currentRestoreItem}"]`); 

            await this.loadRecycleBinItems();
            this.hideRestoreModal();
            
            // Show success state on the button associated with the action
            if (originalButton) showButtonSuccess(originalButton); 
            showToast('Item restored successfully!', 'success');
            
        } catch (error) {
            console.error('Error restoring item:', error);
            showToast('Failed to restore item', 'error');
        } finally {
            hideLoading();
        }
    }

    // Delete functionality
    showDeleteModal(itemId) {
        this.currentDeleteItem = itemId;
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        const itemName = itemElement?.querySelector('h4')?.textContent || 'Item';

        document.getElementById('deletePreview').innerHTML = `
            <strong>${itemName}</strong> will be permanently deleted.
        `;

        document.getElementById('deleteModal').style.display = 'flex';
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').style.display = 'none';
        this.currentDeleteItem = null;
    }

    async confirmPermanentDelete() {
        if (!this.currentDeleteItem) return;

        try {
            showLoading('Deleting Item', 'Permanently removing item from database...');
            
            await db.permanentDeletePurchaseFromRecycleBin(this.currentDeleteItem);
            await this.loadRecycleBinItems();
            this.hideDeleteModal();
            
            showToast('Item permanently deleted!', 'success');
            
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('Failed to delete item', 'error');
        } finally {
            hideLoading();
        }
    }

    // Empty bin functionality
    showEmptyBinModal() {
        document.getElementById('emptyBinModal').style.display = 'flex';
    }

    hideEmptyBinModal() {
        document.getElementById('emptyBinModal').style.display = 'none';
    }

    async confirmEmptyBin() {
        const confirmButton = document.getElementById('confirmEmptyBin');
        const originalButton = confirmButton.innerHTML;

        try {
            confirmButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            confirmButton.disabled = true;

            showLoading('Emptying Recycle Bin', 'Permanently deleting all items...');
            
            const deletedCount = await db.emptyPurchaseRecycleBin();
            await this.loadRecycleBinItems();
            this.hideEmptyBinModal();
            
            showButtonSuccess(document.getElementById('emptyBinBtn'));
            showToast(`Recycle bin emptied! ${deletedCount} items deleted.`, 'success');
            
        } catch (error) {
            console.error('Error emptying recycle bin:', error);
            showToast('Failed to empty recycle bin', 'error');
        } finally {
            hideLoading();
            confirmButton.innerHTML = originalButton;
            confirmButton.disabled = false;
        }
    }

    // Show error state
    showErrorState(message) {
        const itemsList = document.getElementById('itemsList');
        if (itemsList) {
            itemsList.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 16px;"></i>
                    <h3>Error Loading Items</h3>
                    <p>${message}</p>
                    <button onclick="window.recycleBinManager.loadRecycleBinItems()" class="btn-retry">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
        // Also clear stats skeleton on error
        const binStats = document.querySelector('.bin-stats');
        if (binStats) {
            binStats.querySelector('#totalItems').textContent = 'N/A';
            binStats.querySelector('#totalPurchaseBills').textContent = 'N/A';
            binStats.querySelector('#oldestItem').textContent = 'Error';
        }
    }

    // Utility methods
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showBinSkeletonLoading() {
        showBinSkeletonLoading();
    }

    hideBinSkeletonLoading() {
        hideBinSkeletonLoading();
    }

    showSuccess(message) {
        showToast(message, 'success');
    }

    showError(message) {
        showToast(message, 'error');
    }
}


// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function () {
    if (!checkAuthentication()) {
        return;
    }

    try {
        // REMOVED: showLoading('Initializing Recycle Bin', 'Setting up the recycle bin system...');
        
        await db.init();
        window.recycleBinManager = new RecycleBinManager();
        
        // REMOVED: hideLoading();
        
    } catch (error) {
        // REMOVED: hideLoading();
        console.error('Failed to initialize recycle bin:', error);
        
        // Show persistent error state on failure
        const mainContainer = document.querySelector('.main-content-wrapper');
        if (mainContainer) {
            mainContainer.innerHTML = `
                <div class="recycle-bin-container">
                    <div class="error-state" style="padding: 50px; text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #dc3545; margin-bottom: 16px;"></i>
                        <h3>Critical Error Initializing Recycle Bin</h3>
                        <p>There was an error loading the database. Please check your connection or permissions.</p>
                        <button onclick="location.reload()" class="btn-retry" style="background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; margin-top: 15px; cursor: pointer;">
                            <i class="fas fa-redo"></i> Refresh Page
                        </button>
                    </div>
                </div>
            `;
        }
    }
});

// Authentication check (reuse from your existing code)
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated || isAuthenticated !== 'true') {
        window.location.href='login.html';
        return false;
    }
    return true;
}

// Professional loading spinner functions (Kept for action feedback)
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

// Show skeleton loading for recycle bin
function showBinSkeletonLoading() {
    const itemsList = document.getElementById('itemsList');
    const binStats = document.querySelector('.bin-stats');
    const binContainer = document.querySelector('.recycle-bin-container');
    
    // Set container to loading state
    if (binContainer) {
        binContainer.classList.add('bin-loading');
    }
    
    if (itemsList) {
        // Skeleton for items list
        let skeletonHTML = '';
        for (let i = 0; i < 3; i++) {
            skeletonHTML += `<div class="skeleton-loader skeleton-item"></div>`;
        }
        itemsList.innerHTML = skeletonHTML;
    }
    
    if (binStats) {
        // Skeleton for statistics (clearing original content before loading)
        const statItems = binStats.querySelectorAll('.stat-item');
        statItems.forEach(stat => {
            const statInfo = stat.querySelector('.stat-info h3');
            if (statInfo) {
                statInfo.innerHTML = '<div class="skeleton-loader" style="height: 20px; width: 60px;"></div>';
            }
            const statPara = stat.querySelector('.stat-info p');
            if (statPara) {
                 statPara.innerHTML = '<div class="skeleton-loader" style="height: 12px; width: 80px; margin-top: 5px;"></div>';
            }
        });
    }
}

function hideBinSkeletonLoading() {
    const binContainer = document.querySelector('.recycle-bin-container');
    if (binContainer) {
        binContainer.classList.remove('bin-loading');
    }
    // Re-ensure text content is displayed after hiding skeleton
    const binStats = document.querySelector('.bin-stats');
    if (binStats) {
        const statItems = binStats.querySelectorAll('.stat-item');
        statItems.forEach(stat => {
            const statInfo = stat.querySelector('.stat-info h3 .skeleton-loader');
            if (statInfo) statInfo.remove();
            const statPara = stat.querySelector('.stat-info p .skeleton-loader');
            if (statPara) statPara.remove();
        });
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

// Toast notification system
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 500);
    }, duration);
}

// Show success state for buttons
function showButtonSuccess(button, duration = 2000) {
    if (!button) return;
    
    const originalHTML = button.innerHTML;
    const originalBackground = button.style.background;
    
    button.innerHTML = '<i class="fas fa-check"></i> Success!';
    button.classList.add('btn-success');
    button.disabled = true;
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove('btn-success');
        button.disabled = false;
        if (originalBackground) {
            button.style.background = originalBackground;
        }
    }, duration);
}
