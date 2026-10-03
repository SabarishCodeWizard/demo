// Product Shortcuts Management - Firebase Version with Loading Spinners
class ShortcutManager {
    constructor() {
        this.currentEditId = null;
        this.init();
    }

    async init() {
        try {
            // REMOVED: this.showLoading('Initializing Shortcuts Manager', 'Loading your product shortcuts...');
            
            // Wait for database to be ready using the new ensureInitialized method
            await db.ensureInitialized();
            
            // Show skeleton loading for table before loading data
            this.showTableSkeleton();
            
            await this.loadShortcuts();
            this.setupEventListeners();
            
            // REMOVED: this.hideLoading();
            
        } catch (error) {
            // REMOVED: this.hideLoading();
            console.error('Error initializing shortcut manager:', error);
            this.showErrorState('Failed to initialize shortcuts manager. Please refresh the page.');
        }
    }

    // Loading spinner functions (Kept for action buttons/modals, but removed from init/load)
    showLoading(message = 'Loading...', subtext = '') {
        this.hideLoading();
        
        const loadingHTML = `
            <div class="loading-overlay" id="shortcutsLoading">
                <div class="professional-spinner"></div>
                <div class="spinner-text">${message}</div>
                ${subtext ? `<div class="spinner-subtext">${subtext}</div>` : ''}
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', loadingHTML);
    }

    hideLoading() {
        const existingLoader = document.getElementById('shortcutsLoading');
        if (existingLoader) {
            existingLoader.remove();
        }
    }

    showTableSkeleton() {
        const tableBody = document.getElementById('shortcutsTableBody');
        if (!tableBody) return;
        
        let skeletonHTML = '';
        for (let i = 0; i < 5; i++) {
            skeletonHTML += `
                <tr>
                    <td><div class="skeleton-loader skeleton-table-row"></div></td>
                    <td><div class="skeleton-loader skeleton-table-row"></div></td>
                    <td><div class="skeleton-loader skeleton-table-row"></div></td>
                    <td><div class="skeleton-loader skeleton-table-row"></div></td>
                    <td><div class="skeleton-loader skeleton-table-row"></div></td>
                    <td><div class="skeleton-loader skeleton-table-row"></div></td>
                </tr>
            `;
        }
        tableBody.innerHTML = skeletonHTML;
    }

    showErrorState(message) {
        const tableBody = document.getElementById('shortcutsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                        <h3>Error Loading Shortcuts</h3>
                        <p>${message}</p>
                        <button onclick="shortcutManager.retryInitialization()" class="btn-retry">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    async retryInitialization() {
        await this.init();
    }

    setupEventListeners() {
        // Add shortcut
        document.getElementById('addShortcut').addEventListener('click', () => this.addShortcut());
        
        // Search functionality
        document.getElementById('searchShortcuts').addEventListener('input', (e) => this.searchShortcuts(e.target.value));
        
        // Modal functionality
        document.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        
        // Close modal when clicking outside
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeModal();
            }
        });

        // Allow adding shortcut with Enter key
        document.getElementById('shortcutKey').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addShortcut();
            }
        });

        document.getElementById('fullDescription').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addShortcut();
            }
        });

        // Add loading state to form inputs
        this.setupFormLoadingStates();
    }

    setupFormLoadingStates() {
        const formInputs = document.querySelectorAll('#shortcutKey, #fullDescription');
        formInputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.style.borderColor = '#007bff';
                this.style.boxShadow = '0 0 0 2px rgba(0, 123, 255, 0.25)';
            });
            
            input.addEventListener('blur', function() {
                this.style.borderColor = '#ddd';
                this.style.boxShadow = 'none';
            });
        });
    }

    async addShortcut() {
        let shortcutKey = document.getElementById('shortcutKey').value.trim();
        let fullDescription = document.getElementById('fullDescription').value.trim();

        if (fullDescription) {
            fullDescription = fullDescription.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        }

        if (!shortcutKey || !fullDescription) {
            Utils.showToast('Warning', 'Please enter both shortcut key and full description', 'warning');
            return;
        }

        const addButton = document.getElementById('addShortcut');
        const originalText = addButton.innerHTML;

        try {
            // Show button loading state
            addButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
            addButton.classList.add('btn-processing');

            // Show global loading only for the database write
            this.showLoading('Adding Shortcut', 'Saving to database...');

            const shortcutData = {
                shortcutKey: shortcutKey.toUpperCase(),
                fullDescription: fullDescription,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.saveShortcut(shortcutData);
            
            // Clear form
            document.getElementById('shortcutKey').value = '';
            document.getElementById('fullDescription').value = '';
            
            // Reload shortcuts (this will include the table skeleton while loading)
            await this.loadShortcuts();
            
            this.hideLoading();
            
            // Show success state on button
            addButton.innerHTML = '<i class="fas fa-check"></i> Added!';
            addButton.classList.remove('btn-processing');
            addButton.classList.add('btn-success');
            
            setTimeout(() => {
                addButton.innerHTML = originalText;
                addButton.classList.remove('btn-success');
            }, 2000);
            
            this.showMessage('Shortcut added successfully!', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('Error adding shortcut:', error);
            
            // Reset button state
            addButton.innerHTML = originalText;
            addButton.classList.remove('btn-processing');
            
            this.showMessage('Error adding shortcut. Please try again.', 'error');
        }
    }

    async saveShortcut(shortcutData) {
        await db.ensureInitialized();
        try {
            // Using the shortcut key as the document ID for easy lookup/overwrite
            await db.firestore.collection('shortcuts').doc(shortcutData.shortcutKey).set(shortcutData);
            console.log('Shortcut saved successfully to Firebase');
            return shortcutData.shortcutKey;
        } catch (error) {
            console.error('Error saving shortcut to Firebase:', error);
            throw error;
        }
    }

    async loadShortcuts() {
        try {
            // Show table skeleton while loading (non-blocking visual feedback)
            this.showTableSkeleton();
            
            const shortcuts = await this.getAllShortcuts();
            this.renderShortcuts(shortcuts);
        } catch (error) {
            console.error('Error loading shortcuts:', error);
            this.showErrorState('Failed to load shortcuts. Please try again.');
        }
    }

    async getAllShortcuts() {
        await db.ensureInitialized();
        try {
            const querySnapshot = await db.firestore.collection('shortcuts').get();
            const shortcuts = [];
            querySnapshot.forEach((doc) => {
                shortcuts.push(doc.data());
            });
            
            // Sort shortcuts alphabetically by shortcut key
            return shortcuts.sort((a, b) => a.shortcutKey.localeCompare(b.shortcutKey));
        } catch (error) {
            console.error('Error getting all shortcuts from Firebase:', error);
            throw error;
        }
    }

    renderShortcuts(shortcuts) {
        const tableBody = document.getElementById('shortcutsTableBody');
        
        if (!tableBody) {
            console.error('Shortcuts table body not found');
            return;
        }

        if (shortcuts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: #7f8c8d;">
                        <i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                        <h3>No Shortcuts Found</h3>
                        <p>Add your first product shortcut using the form above!</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = shortcuts.map(shortcut => {
            return `
            <tr>
                <td><strong>${this.escapeHtml(shortcut.shortcutKey)}</strong></td>
                <td>${this.escapeHtml(shortcut.fullDescription)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="shortcutManager.editShortcut('${shortcut.shortcutKey}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-delete" onclick="shortcutManager.deleteShortcut('${shortcut.shortcutKey}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    async editShortcut(shortcutKey) {
        try {
            this.showLoading('Loading Shortcut', 'Fetching shortcut details...');
            
            const shortcut = await this.getShortcut(shortcutKey);
            if (shortcut) {
                this.currentEditId = shortcutKey;
                document.getElementById('editShortcutKey').value = shortcut.shortcutKey;
                document.getElementById('editFullDescription').value = shortcut.fullDescription;
                document.getElementById('editModal').style.display = 'block';
            }
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            console.error('Error loading shortcut for edit:', error);
            this.showMessage('Error loading shortcut for editing', 'error');
        }
    }

    async getShortcut(shortcutKey) {
        await db.ensureInitialized();
        try {
            const docRef = db.firestore.collection('shortcuts').doc(shortcutKey);
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting shortcut from Firebase:', error);
            throw error;
        }
    }

    async saveEdit() {
        let shortcutKey = document.getElementById('editShortcutKey').value.trim();
        let fullDescription = document.getElementById('editFullDescription').value.trim();

        if (fullDescription) {
            fullDescription = fullDescription.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        }

        if (!shortcutKey || !fullDescription) {
            Utils.showToast('Warning', 'Please enter both shortcut key and full description', 'warning');
            return;
        }

        const saveButton = document.getElementById('saveEdit');
        const originalText = saveButton.innerHTML;

        try {
            // Show button loading state
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveButton.classList.add('btn-processing');

            this.showLoading('Updating Shortcut', 'Saving changes to database...');

            const shortcutData = {
                shortcutKey: shortcutKey.toUpperCase(),
                fullDescription: fullDescription,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // If the key changed, we need to delete the old one and add new
            if (shortcutKey !== this.currentEditId) {
                await this.deleteShortcut(this.currentEditId, false);
            }

            await this.saveShortcut(shortcutData);
            await this.loadShortcuts();
            this.closeModal();
            
            this.hideLoading();
            
            // Show success state
            this.showMessage('Shortcut updated successfully!', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('Error updating shortcut:', error);
            
            // Reset button state
            saveButton.innerHTML = originalText;
            saveButton.classList.remove('btn-processing');
            
            this.showMessage('Error updating shortcut. Please try again.', 'error');
        }
    }

    async deleteShortcut(shortcutKey, confirm = true) {
        if (confirm && !window.confirm('Are you sure you want to delete this shortcut?')) {
            return;
        }

        const deleteButtons = document.querySelectorAll(`.btn-delete[onclick*="${shortcutKey}"]`);
        
        try {
            // Show loading on delete buttons
            deleteButtons.forEach(button => {
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
                button.classList.add('btn-processing');
            });

            this.showLoading('Deleting Shortcut', 'Removing from database...');

            await db.ensureInitialized();
            await db.firestore.collection('shortcuts').doc(shortcutKey).delete();
            console.log('Shortcut deleted successfully from Firebase');

            await this.loadShortcuts();
            
            this.hideLoading();
            this.showMessage('Shortcut deleted successfully!', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('Error deleting shortcut:', error);
            
            // Reset button states
            deleteButtons.forEach(button => {
                button.innerHTML = '<i class="fas fa-trash"></i> Delete';
                button.classList.remove('btn-processing');
            });
            
            this.showMessage('Error deleting shortcut. Please try again.', 'error');
        }
    }

    async searchShortcuts(query) {
        // Show table skeleton immediately if data is not loaded yet
        const tableBody = document.getElementById('shortcutsTableBody');
        const rows = document.querySelectorAll('#shortcutsTableBody tr');
        
        if (rows.length === 0 || rows[0].classList.contains('skeleton-loader')) {
            // Data hasn't loaded yet, just wait for loadShortcuts
            return;
        }
        
        const searchTerm = query.toLowerCase();

        // Use temporary global loading for large filtering operations for better perceived speed
        if (rows.length > 20) {
            this.showLoading('Searching', 'Filtering shortcuts...');
            setTimeout(() => this.hideLoading(), 300);
        }

        let foundCount = 0;
        rows.forEach(row => {
            // Check if the row contains skeleton data or empty message before trying to filter
            if (row.querySelector('.skeleton-loader') || row.cells.length < 4) {
                row.style.display = ''; 
                return;
            }
            
            const shortcutKey = row.cells[0].textContent.toLowerCase();
            const fullDescription = row.cells[1].textContent.toLowerCase();
            
            if (shortcutKey.includes(searchTerm) || fullDescription.includes(searchTerm)) {
                row.style.display = '';
                foundCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // Handle no results found after filtering
        if (foundCount === 0 && searchTerm !== '') {
            if (!document.getElementById('noSearchResults')) {
                tableBody.insertAdjacentHTML('afterbegin', `<tr id="noSearchResults"><td colspan="6" style="text-align: center; padding: 20px; color: #e74c3c;">No results found for "${query}".</td></tr>`);
            } else {
                document.getElementById('noSearchResults').style.display = '';
                document.getElementById('noSearchResults').cells[0].textContent = `No results found for "${query}".`;
            }
        } else if (document.getElementById('noSearchResults')) {
             document.getElementById('noSearchResults').style.display = 'none';
        }
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditId = null;
        
        // Reset modal button states
        const saveButton = document.getElementById('saveEdit');
        saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes';
        saveButton.classList.remove('btn-processing');
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessage = document.querySelector('.shortcut-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `shortcut-message shortcut-message-${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1001;
            animation: slideInRight 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;

        if (type === 'success') {
            messageDiv.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
        } else {
            messageDiv.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
        }

        document.body.appendChild(messageDiv);

        // Remove message after 3 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => messageDiv.remove(), 300);
            }
        }, 3000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Enhanced initialization with error handling
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // REMOVED: Initial mainContent opacity manipulation
        
        // Create shortcuts manager
        window.shortcutManager = new ShortcutManager();
        
    } catch (error) {
        console.error('Failed to initialize shortcut manager:', error);
        
        // Show comprehensive error state
        const tableBody = document.getElementById('shortcutsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>
                        <h3>Failed to Load Shortcuts</h3>
                        <p>There was an error initializing the shortcuts manager.</p>
                        <p style="font-size: 12px; margin-top: 10px; color: #7f8c8d;">Error: ${error.message}</p>
                        <button onclick="location.reload()" class="btn-retry" style="margin-top: 20px;">
                            <i class="fas fa-redo"></i> Reload Page
                        </button>
                    </td>
                </tr>
            `;
        }
    }
    
    // Auth check
    function checkAuthentication() {
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        if (!isAuthenticated || isAuthenticated !== 'true') {
            window.location.href='login.html';
        }
    }
    checkAuthentication();
});