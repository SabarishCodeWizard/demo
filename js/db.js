// db.js - Firebase Compatibility Version
class Database {
    constructor() {
        this.dbName = 'BillingDB';
        this.version = 2;
        this.db = null;
        this.firestore = null;
        this.initialized = false;

        // In-memory cache to improve loading performance
        this._cache = {
            invoices: null,
            customers: null,
            payments: null,
            returns: null,
            recycleBin: null,
            suppliers: null,
            purchaseInvoices: null,
            expenses: null,
            openingStocks: null,
            purchasePayments: null,
            purchaseReturns: null
        };

        // Promise cache to prevent duplicate simultaneous network requests
        this._promises = {};

        // Firebase configuration
        this.firebaseConfig = {
            apiKey: "AIzaSyDF74-0ovIVvoE1znNOJO9ru3mVPgl9Vjc",
            authDomain: "study-6704a.firebaseapp.com",
            projectId: "study-6704a",
            storageBucket: "study-6704a.firebasestorage.app",
            messagingSenderId: "847641810154",
            appId: "1:847641810154:web:010ab1ebf13cd18760b393",
            measurementId: "G-4655JFXEET"
        };

    }

    // Initialize Firebase
    async init() {
        try {
            // Initialize Firebase
            firebase.initializeApp(this.firebaseConfig);
            this.firestore = firebase.firestore();

            // Enable offline persistence with multi-tab support
            this.firestore.enablePersistence({ synchronizeTabs: true })
                .then(() => {
                    console.log('Firebase persistence enabled with multi-tab support');
                })
                .catch((err) => {
                    console.log('Firebase persistence error:', err);
                    if (err.code == 'failed-precondition') {
                        console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                    } else if (err.code == 'unimplemented') {
                        console.log('The current browser doesn\'t support persistence');
                    }
                });

            this.initialized = true;
            console.log('Firebase initialized successfully');
            return this.firestore;

        } catch (error) {
            console.error('Error initializing Firebase:', error);
            throw error;
        }
    }

    // Helper method to check initialization
    _checkInit() {
        if (!this.initialized) {
            throw new Error('Database not initialized. Call init() first.');
        }
    }

    async _fetchWithPromiseCache(cacheKey, fetchFunction) {
        if (this._cache[cacheKey]) return this._cache[cacheKey];
        if (this._promises[cacheKey]) return this._promises[cacheKey];
        
        this._promises[cacheKey] = (async () => {
            try {
                const result = await fetchFunction();
                this._cache[cacheKey] = result;
                return result;
            } catch (error) {
                this._promises[cacheKey] = null;
                throw error;
            } finally {
                this._promises[cacheKey] = null;
            }
        })();
        
        return this._promises[cacheKey];
    }

    // Save invoice to Firebase
    async saveInvoice(invoiceData) {
        this._checkInit();
        try {
            await this.firestore.collection('invoices').doc(invoiceData.invoiceNo).set({
                ...invoiceData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.invoices = null; // Invalidate cache
            console.log('Invoice saved successfully to Firebase');
            return invoiceData.invoiceNo;
        } catch (error) {
            console.error('Error saving invoice to Firebase:', error);
            throw error;
        }
    }

    // Save opening stock
    async saveOpeningStock(description, qty) {
        this._checkInit();
        try {
            await this.firestore.collection('openingStocks').doc(description).set({
                description: description,
                qty: qty,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.openingStocks = null;
            return description;
        } catch (error) {
            console.error('Error saving opening stock:', error);
            throw error;
        }
    }

    // Delete opening stock
    async deleteOpeningStock(description) {
        this._checkInit();
        try {
            await this.firestore.collection('openingStocks').doc(description).delete();
            this._cache.openingStocks = null;
            return description;
        } catch (error) {
            console.error('Error deleting opening stock:', error);
            throw error;
        }
    }

    // Get all opening stocks
    async getAllOpeningStocks() {
        this._checkInit();
        if (this._cache.openingStocks) {
            return this._cache.openingStocks;
        }
        try {
            const snapshot = await this.firestore.collection('openingStocks').get();
            const stocks = [];
            snapshot.forEach(doc => {
                stocks.push(doc.data());
            });
            this._cache.openingStocks = stocks;
            return stocks;
        } catch (error) {
            console.error('Error getting opening stocks:', error);
            return [];
        }
    }

    // Save customer to Firebase
    async saveCustomer(customerData) {
        this._checkInit();
        try {
            await this.firestore.collection('customers').doc(customerData.phone).set({
                ...customerData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.customers = null; // Invalidate cache
            console.log('Customer saved successfully to Firebase');
            return customerData.phone;
        } catch (error) {
            console.error('Error saving customer to Firebase:', error);
            throw error;
        }
    }

    // Get customer by phone number
    async getCustomer(phone) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('customers').doc(phone);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting customer from Firebase:', error);
            throw error;
        }
    }

    // Save supplier to Firebase
    async saveSupplier(supplierData) {
        this._checkInit();
        try {
            await this.firestore.collection('suppliers').doc(supplierData.phone).set({
                ...supplierData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.suppliers = null; // Invalidate cache
            console.log('Supplier saved successfully to Firebase');
            return supplierData.phone;
        } catch (error) {
            console.error('Error saving supplier to Firebase:', error);
            throw error;
        }
    }

    // Get supplier by phone number
    async getSupplier(phone) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('suppliers').doc(phone);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting supplier from Firebase:', error);
            throw error;
        }
    }

    // Get all suppliers
    async getAllSuppliers() {
        this._checkInit();
        if (this._cache.suppliers) return this._cache.suppliers;
        try {
            const querySnapshot = await this.firestore.collection('suppliers').get();
            const suppliers = [];
            querySnapshot.forEach((doc) => {
                suppliers.push(doc.data());
            });
            this._cache.suppliers = suppliers;
            return suppliers;
        } catch (error) {
            console.error('Error getting all suppliers from Firebase:', error);
            throw error;
        }
    }

    // --- Purchase Bills Methods ---
    async savePurchaseBill(invoiceData) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('purchase_invoices').doc(invoiceData.invoiceNo);
            
            await docRef.set({
                ...invoiceData,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: new Date().toISOString()
            });

            this._cache.purchaseInvoices = null;
            console.log('Purchase Invoice saved successfully');
            return true;
        } catch (error) {
            console.error('Error saving purchase invoice:', error);
            throw error;
        }
    }

    async getAllPurchaseBills() {
        this._checkInit();
        return this._fetchWithPromiseCache('purchaseInvoices', async () => {
            try {
                const querySnapshot = await this.firestore.collection('purchase_invoices')
                    .orderBy('timestamp', 'desc')
                    .get();
                    
                const invoices = [];
                querySnapshot.forEach((doc) => {
                    invoices.push(doc.data());
                });
                
                return invoices;
            } catch (error) {
                console.error('Error getting purchase invoices from Firebase:', error);
                return [];
            }
        });
    }

    async deletePurchaseBill(invoiceNo) {
        // Use the recycle bin method instead of permanent deletion
        await this.movePurchaseInvoiceToRecycleBin(invoiceNo);
    }

    async getPurchaseBill(invoiceNo) {
        this._checkInit();
        try {
            if (this._cache.purchaseInvoices) {
                const invoice = this._cache.purchaseInvoices.find(inv => inv.invoiceNo === invoiceNo);
                if (invoice) return invoice;
            }
            const docSnap = await this.firestore.collection('purchase_invoices').doc(invoiceNo).get();
            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting purchase invoice from Firebase:', error);
            throw error;
        }
    }

    // --- Purchase Payments Methods ---
    async savePurchasePayment(paymentData) {
        this._checkInit();
        try {
            const paymentId = paymentData.id || `purchase_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const paymentToSave = {
                ...paymentData,
                id: paymentId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.firestore.collection('purchase_payments').doc(paymentId).set(paymentToSave);
            this._cache.purchasePayments = null; // Invalidate cache
            console.log('Purchase payment saved successfully with ID:', paymentId);
            return paymentId;
        } catch (error) {
            console.error('Error saving purchase payment to Firebase:', error);
            throw error;
        }
    }

    async getAllPurchasePayments() {
        this._checkInit();
        return this._fetchWithPromiseCache('purchasePayments', async () => {
            try {
                const querySnapshot = await this.firestore.collection('purchase_payments').get();
                const payments = [];
                querySnapshot.forEach((doc) => {
                    payments.push(doc.data());
                });
                return payments;
            } catch (error) {
                console.error('Error getting all purchase payments from Firebase:', error);
                return [];
            }
        });
    }

    async getPurchasePaymentsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            if (this._cache.purchasePayments) {
                return this._cache.purchasePayments.filter(p => p.invoiceNo === invoiceNo);
            }
            const querySnapshot = await this.firestore.collection('purchase_payments').where('invoiceNo', '==', invoiceNo).get();
            const payments = [];
            querySnapshot.forEach((doc) => {
                payments.push(doc.data());
            });
            return payments;
        } catch (error) {
            console.error('Error getting purchase payments by invoice:', error);
            return [];
        }
    }

    async deletePurchasePayment(paymentId) {
        this._checkInit();
        try {
            const paymentDoc = await this.firestore.collection('purchase_payments').doc(paymentId).get();
            
            if (!paymentDoc.exists) {
                console.log('Purchase payment not found with ID:', paymentId);
                return;
            }

            const paymentData = paymentDoc.data();
            const invoiceNo = paymentData.invoiceNo;

            await this.firestore.collection('purchase_payments').doc(paymentId).delete();
            this._cache.purchasePayments = null; 
            console.log('Purchase payment deleted successfully');

            // Update the invoice to reflect the payment deletion
            if (invoiceNo && paymentData.amount) {
                await this.updatePurchaseInvoiceAfterPaymentDeletion(invoiceNo, paymentData.amount);
            }
            return true;
        } catch (error) {
            console.error('Error deleting purchase payment from Firebase:', error);
            throw error;
        }
    }

    async updatePurchaseInvoiceAfterPaymentDeletion(invoiceNo, paymentAmount) {
        try {
            const invoiceData = await this.getPurchaseBill(invoiceNo);
            if (invoiceData) {
                if (invoiceData.paymentBreakdown) {
                    const paymentMethod = invoiceData.paymentMethod || 'cash';
                    invoiceData.paymentBreakdown[paymentMethod] = Math.max(
                        0,
                        (invoiceData.paymentBreakdown[paymentMethod] || 0) - paymentAmount
                    );
                }

                invoiceData.amountPaid = Math.max(0, (invoiceData.amountPaid || invoiceData.payment?.totalPaid || 0) - paymentAmount);
                invoiceData.balanceDue = invoiceData.grandTotal - invoiceData.amountPaid;
                
                // Fix: ensure the payment object inside invoiceData is also updated if it exists
                if (invoiceData.payment) {
                     invoiceData.payment.totalPaid = invoiceData.amountPaid;
                     invoiceData.payment.balanceDue = invoiceData.balanceDue;
                }

                await this.savePurchaseBill(invoiceData);
                console.log(`Updated purchase invoice ${invoiceNo} after payment deletion`);
            }
        } catch (error) {
            console.error('Error updating purchase invoice after payment deletion:', error);
        }
    }

    // --- Purchase Shortcuts Methods ---

    // Save or update a purchase shortcut
    async savePurchaseShortcut(shortcutData) {
        this._checkInit();
        try {
            await this.firestore.collection('purchase_shortcuts').doc(shortcutData.id).set({
                ...shortcutData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.purchaseShortcuts = null; // Invalidate cache
            console.log('Purchase shortcut saved successfully to Firebase');
            return shortcutData.id;
        } catch (error) {
            console.error('Error saving purchase shortcut to Firebase:', error);
            throw error;
        }
    }

    // Get all purchase shortcuts
    async getAllPurchaseShortcuts() {
        this._checkInit();
        if (this._cache.purchaseShortcuts) return this._cache.purchaseShortcuts;
        try {
            const querySnapshot = await this.firestore.collection('purchase_shortcuts').get();
            const shortcuts = [];
            querySnapshot.forEach((doc) => {
                shortcuts.push(doc.data());
            });
            this._cache.purchaseShortcuts = shortcuts;
            return shortcuts;
        } catch (error) {
            console.error('Error getting all purchase shortcuts from Firebase:', error);
            return [];
        }
    }

    // Delete a purchase shortcut
    async deletePurchaseShortcut(id) {
        this._checkInit();
        try {
            await this.firestore.collection('purchase_shortcuts').doc(id).delete();
            this._cache.purchaseShortcuts = null; // Invalidate cache
            console.log('Purchase shortcut deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting purchase shortcut from Firebase:', error);
            throw error;
        }
    }

    async updateCustomerDetails(oldName, newName, newPhone, newAddress) {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('invoices').where('customerName', '==', oldName).get();
            const updatePromises = [];
            
            querySnapshot.forEach((doc) => {
                updatePromises.push(doc.ref.update({
                    customerName: newName,
                    customerPhone: newPhone,
                    customerAddress: newAddress,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }));
            });
            
            await Promise.all(updatePromises);
            this._cache.invoices = null;
            
            // Also update the customer document if phone is provided
            if (newPhone) {
                await this.saveCustomer({
                    name: newName,
                    phone: newPhone,
                    address: newAddress
                });
            }
            
            console.log(`Updated customer details in ${updatePromises.length} invoices.`);
        } catch (error) {
            console.error('Error updating customer details:', error);
            throw error;
        }
    }

    // Add this method to your Database class in db.js
    async ensureInitialized() {
        if (!this.initialized && !this.initializing) {
            await this.init();
        } else if (this.initializing) {
            // Wait for initialization to complete
            await new Promise(resolve => {
                const checkInitialized = () => {
                    if (this.initialized) {
                        resolve();
                    } else {
                        setTimeout(checkInitialized, 100);
                    }
                };
                checkInitialized();
            });
        }
    }

    // Get all customers
    async getAllCustomers() {
        this._checkInit();
        if (this._cache.customers) return this._cache.customers;
        try {
            const querySnapshot = await this.firestore.collection('customers').get();
            const customers = [];
            querySnapshot.forEach((doc) => {
                customers.push(doc.data());
            });
            this._cache.customers = customers;
            return customers;
        } catch (error) {
            console.error('Error getting all customers from Firebase:', error);
            throw error;
        }
    }

    // In your db.js - Update the deleteCustomer method
    async deleteCustomer(phone) {
        this._checkInit();
        try {
            // First, get all invoices for this customer
            const invoicesQuery = await this.firestore.collection('invoices')
                .where('customerPhone', '==', phone)
                .get();

            // Delete all related invoices and their payments/returns
            const deletePromises = [];
            invoicesQuery.forEach((doc) => {
                const invoiceNo = doc.id;
                // Delete invoice and its related data
                deletePromises.push(this.deleteInvoice(invoiceNo));
            });

            await Promise.all(deletePromises);

            // Finally delete the customer
            await this.firestore.collection('customers').doc(phone).delete();
            this._cache.customers = null; // Invalidate cache
            console.log(`Customer ${phone} and all related data deleted successfully`);

        } catch (error) {
            console.error('Error deleting customer from Firebase:', error);
            throw error;
        }
    }

    // Delete return by ID
    async deleteReturn(returnId) {
        this._checkInit();
        try {
            await this.firestore.collection('returns').doc(returnId.toString()).delete();
            this._cache.returns = null; // Invalidate cache
            console.log('Return deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting return from Firebase:', error);
            throw error;
        }
    }

    // In db.js - Update deletePayment method
    async deletePayment(paymentId) {
        this._checkInit();
        try {
            console.log('Attempting to delete payment with ID:', paymentId);

            // First, get the payment data to know which invoice it belongs to
            const paymentDoc = await this.firestore.collection('payments').doc(paymentId).get();

            if (!paymentDoc.exists) {
                console.log('Payment not found with ID:', paymentId);
                // Try alternative ID formats
                const alternativeIds = [
                    paymentId.toString(),
                    `payment_${paymentId}`,
                    paymentId
                ];

                for (const altId of alternativeIds) {
                    const altDoc = await this.firestore.collection('payments').doc(altId).get();
                    if (altDoc.exists) {
                        console.log('Found payment with alternative ID:', altId);
                        const paymentData = altDoc.data();
                        const invoiceNo = paymentData.invoiceNo;

                        // Delete with alternative ID
                        await this.firestore.collection('payments').doc(altId).delete();
                        this._cache.payments = null; // Invalidate cache
                        console.log('Payment deleted successfully from Firebase with alternative ID');

                        // Update the invoice
                        if (invoiceNo) {
                            await this.updateInvoiceAfterPaymentDeletion(invoiceNo, paymentData.amount);
                        }
                        return;
                    }
                }

                throw new Error(`Payment not found with any ID format: ${paymentId}`);
            }

            const paymentData = paymentDoc.data();
            const invoiceNo = paymentData.invoiceNo;

            // Delete the payment
            await this.firestore.collection('payments').doc(paymentId).delete();
            this._cache.payments = null; // Invalidate cache
            console.log('Payment deleted successfully from Firebase');

            // Update the invoice to reflect the payment deletion
            if (invoiceNo) {
                await this.updateInvoiceAfterPaymentDeletion(invoiceNo, paymentData.amount);
            }

        } catch (error) {
            console.error('Error deleting payment from Firebase:', error);
            throw error;
        }
    }

    // Helper method to update invoice after payment deletion
    async updateInvoiceAfterPaymentDeletion(invoiceNo, paymentAmount) {
        try {
            const invoiceData = await this.getInvoice(invoiceNo);
            if (invoiceData) {
                // Update payment breakdown
                if (invoiceData.paymentBreakdown) {
                    const paymentMethod = invoiceData.paymentMethod || 'cash';
                    invoiceData.paymentBreakdown[paymentMethod] = Math.max(
                        0,
                        (invoiceData.paymentBreakdown[paymentMethod] || 0) - paymentAmount
                    );
                }

                // Update totals
                invoiceData.amountPaid = Math.max(0, invoiceData.amountPaid - paymentAmount);
                invoiceData.balanceDue = invoiceData.grandTotal - invoiceData.amountPaid;

                // Save updated invoice
                await this.saveInvoice(invoiceData);

                // Update subsequent invoices
                await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);
            }
        } catch (error) {
            console.error('Error updating invoice after payment deletion:', error);
            throw error;
        }
    }

    // Get all invoices
    async getAllInvoices() {
        this._checkInit();
        return this._fetchWithPromiseCache('invoices', async () => {
            try {
                const querySnapshot = await this.firestore.collection('invoices').get();
                const invoices = [];
                querySnapshot.forEach((doc) => {
                    invoices.push(doc.data());
                });

                // Sort by invoice date descending (newest first)
                return invoices.sort((a, b) => {
                    const dateA = a.invoiceDate ? new Date(a.invoiceDate) : new Date(0);
                    const dateB = b.invoiceDate ? new Date(b.invoiceDate) : new Date(0);
                    return dateB - dateA;
                });
            } catch (error) {
                console.error('Error getting all invoices from Firebase:', error);
                throw error;
            }
        });
    }

    // Get invoice by invoice number
    async getInvoice(invoiceNo) {
        this._checkInit();
        try {
            if (this._cache.invoices) {
                const cachedInvoice = this._cache.invoices.find(inv => inv.invoiceNo === invoiceNo);
                if (cachedInvoice) return cachedInvoice;
            }
            const docRef = this.firestore.collection('invoices').doc(invoiceNo);
            const docSnap = await docRef.get();

            if (docSnap.exists) {
                return docSnap.data();
            } else {
                return null;
            }
        } catch (error) {
            console.error('Error getting invoice from Firebase:', error);
            throw error;
        }
    }

    // In db.js - Update savePayment method
    async savePayment(paymentData) {
        this._checkInit();
        try {
            // Use the paymentData.id if provided, otherwise generate a proper ID
            const paymentId = paymentData.id || `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const paymentToSave = {
                ...paymentData,
                id: paymentId, // Ensure ID is stored
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.firestore.collection('payments').doc(paymentId).set(paymentToSave);
            this._cache.payments = null; // Invalidate cache
            console.log('Payment saved successfully to Firebase with ID:', paymentId);
            return paymentId;
        } catch (error) {
            console.error('Error saving payment to Firebase:', error);
            throw error;
        }
    }

    // Get all payments for an invoice
    async getPaymentsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            if (this._cache.payments) {
                return this._cache.payments.filter(p => p.invoiceNo === invoiceNo);
            }
            const querySnapshot = await this.firestore.collection('payments')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const payments = [];
            querySnapshot.forEach((doc) => {
                payments.push(doc.data());
            });
            return payments;
        } catch (error) {
            console.error('Error getting payments from Firebase:', error);
            return [];
        }
    }

    // Get all payments
    async getAllPayments() {
        this._checkInit();
        return this._fetchWithPromiseCache('payments', async () => {
            try {
                const querySnapshot = await this.firestore.collection('payments').get();
                const payments = [];
                querySnapshot.forEach((doc) => {
                    payments.push(doc.data());
                });
                return payments;
            } catch (error) {
                console.error('Error getting all payments from Firebase:', error);
                return [];
            }
        });
    }

    // In your db.js - Update the deleteInvoice method
    async deleteInvoice(invoiceNo) {
        this._checkInit();
        try {
            // First, get the invoice data to know the customer and other details
            const invoiceData = await this.getInvoice(invoiceNo);
            if (!invoiceData) {
                console.log('Invoice not found, nothing to delete');
                return;
            }

            const customerName = invoiceData.customerName;
            const customerPhone = invoiceData.customerPhone;

            // Delete the invoice
            await this.firestore.collection('invoices').doc(invoiceNo).delete();
            this._cache.invoices = null; // Invalidate cache
            console.log('Invoice deleted successfully from Firebase');

            // Delete related payments
            await this.deletePaymentsByInvoice(invoiceNo);

            // Delete related returns
            await this.deleteReturnsByInvoice(invoiceNo);

            // Update customer data if needed (remove reference to this invoice)
            await this.updateCustomerAfterInvoiceDeletion(customerPhone, invoiceNo);

            // Update subsequent invoices for this customer
            await Utils.updateSubsequentInvoices(customerName, invoiceNo);

            console.log(`Invoice ${invoiceNo} and all related data deleted successfully`);

        } catch (error) {
            console.error('Error deleting invoice from Firebase:', error);
            throw error;
        }
    }


    // Update customer data after invoice deletion
    async updateCustomerAfterInvoiceDeletion(customerPhone, invoiceNo) {
        if (!customerPhone) return;

        try {
            const customer = await this.getCustomer(customerPhone);
            if (customer) {
                // You can add logic here to update customer statistics if needed
                // For example, if you store invoice references in customer data
                console.log(`Customer ${customerPhone} updated after invoice deletion`);
            }
        } catch (error) {
            console.error('Error updating customer after invoice deletion:', error);
            // Don't throw error here as it's not critical
        }
    }


    // Delete all payments for an invoice
    async deletePaymentsByInvoice(invoiceNo) {
        try {
            const paymentsQuery = await this.firestore.collection('payments')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const deletePromises = [];
            paymentsQuery.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            this._cache.payments = null; // Invalidate cache
            console.log(`Deleted ${deletePromises.length} payments for invoice ${invoiceNo}`);
        } catch (error) {
            console.error('Error deleting payments:', error);
            throw error;
        }
    }

    // Delete all purchase payments for an invoice
    async deletePurchasePaymentsByInvoice(invoiceNo) {
        try {
            const paymentsQuery = await this.firestore.collection('purchase_payments')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const deletePromises = [];
            paymentsQuery.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            this._cache.purchasePayments = null; // Invalidate cache
            console.log(`Deleted ${deletePromises.length} purchase payments for invoice ${invoiceNo}`);
        } catch (error) {
            console.error('Error deleting purchase payments:', error);
            throw error;
        }
    }



    // Delete all returns for an invoice
    async deleteReturnsByInvoice(invoiceNo) {
        try {
            const returnsQuery = await this.firestore.collection('returns')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const deletePromises = [];
            returnsQuery.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            this._cache.returns = null; // Invalidate cache
            console.log(`Deleted ${deletePromises.length} returns for invoice ${invoiceNo}`);
        } catch (error) {
            console.error('Error deleting returns:', error);
            throw error;
        }
    }


    // Save return record
    async saveReturn(returnData) {
        this._checkInit();
        try {
            // Use auto-generated ID or provided ID
            const returnId = returnData.id || `return_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            await this.firestore.collection('returns').doc(returnId).set({
                ...returnData,
                id: returnId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.returns = null; // Invalidate cache
            console.log('Return saved successfully to Firebase');
            return returnId;
        } catch (error) {
            console.error('Error saving return to Firebase:', error);
            throw error;
        }
    }

    // Get all returns for an invoice
    async getReturnsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            if (this._cache.returns) {
                return this._cache.returns.filter(r => r.invoiceNo === invoiceNo);
            }
            const querySnapshot = await this.firestore.collection('returns')
                .where('invoiceNo', '==', invoiceNo)
                .get();

            const returns = [];
            querySnapshot.forEach((doc) => {
                returns.push(doc.data());
            });
            return returns;
        } catch (error) {
            console.error('Error getting returns from Firebase:', error);
            return [];
        }
    }

    // Get all returns
    async getAllReturns() {
        this._checkInit();
        return this._fetchWithPromiseCache('returns', async () => {
            try {
                const querySnapshot = await this.firestore.collection('returns').get();
                const returns = [];
                querySnapshot.forEach((doc) => {
                    returns.push(doc.data());
                });
                return returns;
            } catch (error) {
                console.error('Error getting all returns from Firebase:', error);
                return [];
            }
        });
    }

    // Migration function to export existing IndexedDB data
    async exportIndexedDBData() {
        // This would export data from your old IndexedDB
        // You'll need to implement this based on your current IndexedDB structure
        console.log('Export IndexedDB data function');
        return null;
    }
    // In your db.js - Add these methods to the Database class

    // Move invoice to recycle bin instead of permanent deletion
    async moveInvoiceToRecycleBin(invoiceNo) {
        this._checkInit();
        try {
            // Get the invoice data first
            const invoiceData = await this.getInvoice(invoiceNo);
            if (!invoiceData) {
                console.log('Invoice not found, nothing to move to recycle bin');
                return;
            }

            // Get related payments and returns
            const payments = await this.getPaymentsByInvoice(invoiceNo);
            const returns = await this.getReturnsByInvoice(invoiceNo);

            // Create recycle bin entry
            const recycleBinEntry = {
                id: `invoice_${invoiceNo}_${Date.now()}`,
                type: 'invoice',
                originalId: invoiceNo,
                data: invoiceData,
                payments: payments,
                returns: returns,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                customerName: invoiceData.customerName,
                customerPhone: invoiceData.customerPhone,
                invoiceDate: invoiceData.invoiceDate,
                grandTotal: invoiceData.grandTotal
            };

            // Save to recycle bin
            await this.firestore.collection('recycleBin').doc(recycleBinEntry.id).set(recycleBinEntry);
            console.log('Invoice moved to recycle bin:', invoiceNo);

            // Now delete the original invoice and related data
            await this.firestore.collection('invoices').doc(invoiceNo).delete();
            this._cache.recycleBin = null; // Invalidate cache
            this._cache.invoices = null; // Invalidate cache

            // Delete related payments
            await this.deletePaymentsByInvoice(invoiceNo);

            // Delete related returns
            await this.deleteReturnsByInvoice(invoiceNo);

            // Update subsequent invoices
            await Utils.updateSubsequentInvoices(invoiceData.customerName, invoiceNo);

            // Clean up orphaned customers if this was their last bill
            await this.cleanupOrphanedData();

            console.log(`Invoice ${invoiceNo} moved to recycle bin and original data deleted`);

        } catch (error) {
            console.error('Error moving invoice to recycle bin:', error);
            throw error;
        }
    }

    // Get all items from recycle bin
    async getRecycleBinItems() {
        this._checkInit();
        if (this._cache.recycleBin) return this._cache.recycleBin;
        try {
            const querySnapshot = await this.firestore.collection('recycleBin')
                .orderBy('deletedAt', 'desc')
                .get();

            const items = [];
            querySnapshot.forEach((doc) => {
                items.push(doc.data());
            });
            this._cache.recycleBin = items;
            return items;
        } catch (error) {
            console.error('Error getting recycle bin items:', error);
            return [];
        }
    }

    // Restore item from recycle bin
    async restoreFromRecycleBin(itemId) {
        this._checkInit();
        try {
            // Get the recycle bin item
            const docRef = this.firestore.collection('recycleBin').doc(itemId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                throw new Error('Recycle bin item not found');
            }

            const item = docSnap.data();

            if (item.type === 'invoice') {
                // Restore invoice
                await this.firestore.collection('invoices').doc(item.originalId).set(item.data);

                // Restore payments
                if (item.payments && item.payments.length > 0) {
                    for (const payment of item.payments) {
                        await this.savePayment(payment);
                    }
                }

                // Restore returns
                if (item.returns && item.returns.length > 0) {
                    for (const returnItem of item.returns) {
                        await this.saveReturn(returnItem);
                    }
                }

                // Update subsequent invoices
                await Utils.updateSubsequentInvoices(item.data.customerName, item.originalId);
            }

            // Remove from recycle bin
            await docRef.delete();
            this._cache.recycleBin = null; // Invalidate cache
            this._cache.invoices = null; // Invalidate cache
            this._cache.payments = null; // Invalidate cache
            this._cache.returns = null; // Invalidate cache
            console.log(`Item ${itemId} restored from recycle bin`);

            return item.originalId;

        } catch (error) {
            console.error('Error restoring from recycle bin:', error);
            throw error;
        }
    }

    // Permanently delete from recycle bin
    async permanentDeleteFromRecycleBin(itemId) {
        this._checkInit();
        try {
            await this.firestore.collection('recycleBin').doc(itemId).delete();
            this._cache.recycleBin = null; // Invalidate cache
            console.log('Item permanently deleted from recycle bin:', itemId);
        } catch (error) {
            console.error('Error permanently deleting from recycle bin:', error);
            throw error;
        }
    }

    // Empty entire recycle bin
    async emptyRecycleBin() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('recycleBin').get();

            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            this._cache.recycleBin = null; // Invalidate cache
            console.log(`Recycle bin emptied: ${deletePromises.length} items deleted`);

            return deletePromises.length;
        } catch (error) {
            console.error('Error emptying recycle bin:', error);
            throw error;
        }
    }

    // Update the deleteInvoice method to use recycle bin
    async deleteInvoice(invoiceNo) {
        // Use the new recycle bin method instead of permanent deletion
        await this.moveInvoiceToRecycleBin(invoiceNo);
    }
    // --- Purchase Recycle Bin Methods ---

    async movePurchaseInvoiceToRecycleBin(invoiceNo) {
        this._checkInit();
        try {
            const allInvoices = await this.getAllPurchaseBills();
            const invoiceData = allInvoices.find(inv => String(inv.invoiceNo) === String(invoiceNo));
            if (!invoiceData) {
                console.log('Purchase invoice not found, nothing to move to recycle bin');
                return;
            }

            // Get related payments
            const payments = await this.getPurchasePaymentsByInvoice(invoiceNo);

            const recycleBinEntry = {
                id: `pinvoice_${invoiceNo}_${Date.now()}`,
                type: 'purchase_invoice',
                originalId: invoiceNo,
                data: invoiceData,
                payments: payments,
                deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                supplierName: invoiceData.supplierName,
                supplierPhone: invoiceData.supplierPhone || '',
                invoiceDate: invoiceData.invoiceDate,
                grandTotal: invoiceData.grandTotal
            };

            await this.firestore.collection('purchaseRecycleBin').doc(recycleBinEntry.id).set(recycleBinEntry);
            await this.firestore.collection('purchase_invoices').doc(invoiceNo).delete();
            
            // Delete related purchase payments
            await this.deletePurchasePaymentsByInvoice(invoiceNo);
            
            this._cache.purchaseRecycleBin = null; 
            this._cache.purchaseInvoices = null; 

            // Clean up orphaned suppliers if this was their last bill
            await this.cleanupOrphanedData();

            console.log(`Purchase Invoice ${invoiceNo} moved to recycle bin`);
        } catch (error) {
            console.error('Error moving purchase invoice to recycle bin:', error);
            throw error;
        }
    }

    async getPurchaseRecycleBinItems() {
        this._checkInit();
        if (this._cache.purchaseRecycleBin) return this._cache.purchaseRecycleBin;
        try {
            const querySnapshot = await this.firestore.collection('purchaseRecycleBin')
                .orderBy('deletedAt', 'desc')
                .get();

            const items = [];
            querySnapshot.forEach((doc) => {
                items.push(doc.data());
            });
            this._cache.purchaseRecycleBin = items;
            return items;
        } catch (error) {
            console.error('Error getting purchase recycle bin items:', error);
            return [];
        }
    }

    async restorePurchaseFromRecycleBin(itemId) {
        this._checkInit();
        try {
            const docRef = this.firestore.collection('purchaseRecycleBin').doc(itemId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                throw new Error('Recycle bin item not found');
            }

            const item = docSnap.data();

            if (item.type === 'purchase_invoice') {
                await this.firestore.collection('purchase_invoices').doc(item.originalId).set(item.data);
                
                // Restore payments
                if (item.payments && item.payments.length > 0) {
                    for (const payment of item.payments) {
                        await this.savePurchasePayment(payment);
                    }
                }
            }

            await docRef.delete();
            this._cache.purchaseRecycleBin = null;
            this._cache.purchaseInvoices = null;
            console.log(`Item ${itemId} restored from purchase recycle bin`);

            return item.originalId;
        } catch (error) {
            console.error('Error restoring from purchase recycle bin:', error);
            throw error;
        }
    }

    async permanentDeletePurchaseFromRecycleBin(itemId) {
        this._checkInit();
        try {
            await this.firestore.collection('purchaseRecycleBin').doc(itemId).delete();
            this._cache.purchaseRecycleBin = null;
            console.log('Item permanently deleted from purchase recycle bin:', itemId);
        } catch (error) {
            console.error('Error permanently deleting from purchase recycle bin:', error);
            throw error;
        }
    }

    async emptyPurchaseRecycleBin() {
        this._checkInit();
        try {
            const querySnapshot = await this.firestore.collection('purchaseRecycleBin').get();
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });

            await Promise.all(deletePromises);
            this._cache.purchaseRecycleBin = null;
            console.log(`Purchase Recycle bin emptied: ${deletePromises.length} items deleted`);
            return deletePromises.length;
        } catch (error) {
            console.error('Error emptying purchase recycle bin:', error);
            throw error;
        }
    }

    async cleanupOrphanedData() {
        return; // Disabled by user request: do not delete customers/suppliers when their bills are deleted
        this._checkInit();
        try {
            // 1. Get all active sales invoices
            const invoicesSnapshot = await this.firestore.collection('invoices').get();
            const activeCustomerPhones = new Set();
            invoicesSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.customerPhone) activeCustomerPhones.add(data.customerPhone);
            });

            // 2. Get all customers and delete those not in activeCustomerPhones
            const customersSnapshot = await this.firestore.collection('customers').get();
            const customerDeletePromises = [];
            customersSnapshot.forEach(doc => {
                if (!activeCustomerPhones.has(doc.id)) {
                    customerDeletePromises.push(this.firestore.collection('customers').doc(doc.id).delete());
                }
            });

            // 3. Get all active purchase invoices
            const purchaseInvoicesSnapshot = await this.firestore.collection('purchase_invoices').get();
            const activeSupplierPhones = new Set();
            purchaseInvoicesSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.supplierPhone) activeSupplierPhones.add(data.supplierPhone);
            });

            // 4. Get all suppliers and delete those not in activeSupplierPhones
            const suppliersSnapshot = await this.firestore.collection('suppliers').get();
            const supplierDeletePromises = [];
            suppliersSnapshot.forEach(doc => {
                if (!activeSupplierPhones.has(doc.id)) {
                    supplierDeletePromises.push(this.firestore.collection('suppliers').doc(doc.id).delete());
                }
            });

            await Promise.all([...customerDeletePromises, ...supplierDeletePromises]);
            
            if (customerDeletePromises.length > 0) this._cache.customers = null;
            if (supplierDeletePromises.length > 0) this._cache.suppliers = null;

            console.log(`Cleaned up ${customerDeletePromises.length} orphaned customers and ${supplierDeletePromises.length} orphaned suppliers.`);
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    // ==========================================
    // EXPENSES METHODS
    // ==========================================
    
    async saveExpense(expenseData) {
        this._checkInit();
        try {
            const expenseRef = this.firestore.collection('expenses').doc(expenseData.id);
            await expenseRef.set(expenseData);
            this._cache.expenses = null; // Invalidate cache
            console.log('Expense saved:', expenseData.id);
            return expenseData;
        } catch (error) {
            console.error('Error saving expense:', error);
            throw error;
        }
    }

    async getAllExpenses() {
        this._checkInit();
        try {
            if (this._cache.expenses) {
                return this._cache.expenses;
            }

            const snapshot = await this.firestore.collection('expenses').get();
            const expenses = [];
            snapshot.forEach(doc => {
                expenses.push(doc.data());
            });

            // Sort by date descending
            expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
            this._cache.expenses = expenses;
            return expenses;
        } catch (error) {
            console.error('Error fetching expenses:', error);
            throw error;
        }
    }

    async deleteExpense(id) {
        this._checkInit();
        try {
            await this.firestore.collection('expenses').doc(id).delete();
            this._cache.expenses = null; // Invalidate cache
            console.log('Expense deleted:', id);
        } catch (error) {
            console.error('Error deleting expense:', error);
            throw error;
        }
    }

    // Migration function to import data to Firebase
    async importToFirebase(data) {
        this._checkInit();
        try {
            // Import invoices
            if (data.invoices) {
                for (const invoice of data.invoices) {
                    await this.saveInvoice(invoice);
                }
            }

            // Import customers
            if (data.customers) {
                for (const customer of data.customers) {
                    await this.saveCustomer(customer);
                }
            }

            console.log('Data imported successfully to Firebase');
        } catch (error) {
            console.error('Error importing data to Firebase:', error);
            throw error;
        }
    }

    async deleteSupplier(phone) {
        this._checkInit();
        try {
            await this.firestore.collection('suppliers').doc(phone).delete();
            this._cache.suppliers = null;
            console.log(`Supplier ${phone} deleted successfully`);
        } catch (error) {
            console.error('Error deleting supplier from Firebase:', error);
            throw error;
        }
    }

    // --- Purchase Returns Methods ---

    async savePurchaseReturn(returnData) {
        this._checkInit();
        try {
            const returnId = returnData.id || `purchasereturn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await this.firestore.collection('purchaseReturns').doc(returnId).set({
                ...returnData,
                id: returnId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            this._cache.purchaseReturns = null;
            console.log('Purchase Return saved successfully to Firebase');
            return returnId;
        } catch (error) {
            console.error('Error saving purchase return:', error);
            throw error;
        }
    }

    async getPurchaseReturnsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            if (this._cache.purchaseReturns) {
                return this._cache.purchaseReturns.filter(r => r.invoiceNo === invoiceNo);
            }
            const querySnapshot = await this.firestore.collection('purchaseReturns')
                .where('invoiceNo', '==', invoiceNo)
                .get();
            const returns = [];
            querySnapshot.forEach((doc) => {
                returns.push(doc.data());
            });
            return returns;
        } catch (error) {
            console.error('Error getting purchase returns by invoice:', error);
            throw error;
        }
    }

    async getAllPurchaseReturns() {
        this._checkInit();
        return this._fetchWithPromiseCache('purchaseReturns', async () => {
            try {
                const querySnapshot = await this.firestore.collection('purchaseReturns').get();
                const returns = [];
                querySnapshot.forEach((doc) => {
                    returns.push(doc.data());
                });
                return returns;
            } catch (error) {
                console.error('Error getting all purchase returns:', error);
                throw error;
            }
        });
    }

    async deletePurchaseReturn(returnId) {
        this._checkInit();
        try {
            await this.firestore.collection('purchaseReturns').doc(returnId.toString()).delete();
            this._cache.purchaseReturns = null;
            console.log('Purchase Return deleted successfully from Firebase');
        } catch (error) {
            console.error('Error deleting purchase return:', error);
            throw error;
        }
    }

    async deletePurchaseReturnsByInvoice(invoiceNo) {
        this._checkInit();
        try {
            const returnsQuery = await this.firestore.collection('purchaseReturns')
                .where('invoiceNo', '==', invoiceNo)
                .get();
            
            const deletePromises = [];
            returnsQuery.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
            });
            
            await Promise.all(deletePromises);
            this._cache.purchaseReturns = null;
        } catch (error) {
            console.error('Error deleting purchase returns:', error);
            throw error;
        }
    }
}

// Create a global database instance
const db = new Database();