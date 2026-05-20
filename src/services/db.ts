import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  setDoc,
  serverTimestamp,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Category, Transaction, Rule, Budget, OperationType } from '../types';
import { localDbService } from './localDb';

// Check if app is configured to use local browser storage fallback
export const isLocalMode = (): boolean => {
  return localStorage.getItem('eelarvemeister_use_local_db') === 'true';
};

// Dispatch dynamic sync event so hooks update immediately
const notifyChange = () => {
  window.dispatchEvent(new Event('eelarvemeister_db_changed'));
};

// Error handler as requested by skill
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const dbService = {
  // Categories
  async getCategories(userId: string): Promise<Category[]> {
    if (isLocalMode()) {
      return localDbService.getCategories(userId);
    }
    const q = query(collection(db, 'categories'), where('userId', '==', userId));
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    } catch (e) {
      handleFirestoreError(e, 'get' as any, 'categories');
      return [];
    }
  },

  async addCategory(userId: string, category: Omit<Category, 'id' | 'userId'>) {
    if (isLocalMode()) {
      const res = await localDbService.addCategory(userId, category);
      notifyChange();
      return res;
    }
    try {
      return await addDoc(collection(db, 'categories'), { ...category, userId });
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'categories');
    }
  },

  async updateCategory(categoryId: string, category: Partial<Category>) {
    if (isLocalMode()) {
      await localDbService.updateCategory(categoryId, category);
      notifyChange();
      return;
    }
    try {
      const { id, ...data } = category;
      await updateDoc(doc(db, 'categories', categoryId), data);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `categories/${categoryId}`);
    }
  },

  async deleteCategory(categoryId: string) {
    if (isLocalMode()) {
      await localDbService.deleteCategory(categoryId);
      notifyChange();
      return;
    }
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `categories/${categoryId}`);
    }
  },

  // Transactions
  async updateTransaction(transactionId: string, transaction: Partial<Transaction>) {
    if (isLocalMode()) {
      await localDbService.updateTransaction(transactionId, transaction);
      notifyChange();
      return;
    }
    try {
      const { id, ...data } = transaction;
      await updateDoc(doc(db, 'transactions', transactionId), data);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `transactions/${transactionId}`);
    }
  },

  async addTransactions(userId: string, transactions: Omit<Transaction, 'id' | 'userId'>[]) {
    if (isLocalMode()) {
      const res = await localDbService.addTransactions(userId, transactions);
      notifyChange();
      return res;
    }
    try {
      return await Promise.all(transactions.map(t => 
        addDoc(collection(db, 'transactions'), { ...t, userId, createdAt: serverTimestamp() })
      ));
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'transactions');
    }
  },

  async getTransactions(userId: string): Promise<Transaction[]> {
    if (isLocalMode()) {
      return localDbService.getTransactions(userId);
    }
    const q = query(collection(db, 'transactions'), where('userId', '==', userId), orderBy('date', 'desc'));
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    } catch (e) {
      handleFirestoreError(e, 'get' as any, 'transactions');
      return [];
    }
  },

  async deleteTransactionsByAccount(userId: string, accountNumber: string) {
    if (isLocalMode()) {
      await localDbService.deleteTransactionsByAccount(userId, accountNumber);
      notifyChange();
      return;
    }
    try {
      const q = query(collection(db, 'transactions'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const docsToDelete = snapshot.docs.filter(d => {
        const trans = d.data();
        const accNum = trans.accountNumber || 'EE-PÕHIKONTO';
        return accNum === accountNumber;
      });
      await Promise.all(docsToDelete.map(d => deleteDoc(d.ref)));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `transactions/account/${accountNumber}`);
    }
  },

  // Rules
  async getRules(userId: string): Promise<Rule[]> {
    if (isLocalMode()) {
      return localDbService.getRules(userId);
    }
    const q = query(collection(db, 'rules'), where('userId', '==', userId));
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rule));
    } catch (e) {
      handleFirestoreError(e, 'get' as any, 'rules');
      return [];
    }
  },

  async addRule(userId: string, rule: Omit<Rule, 'id' | 'userId'>) {
    if (isLocalMode()) {
      const res = await localDbService.addRule(userId, rule);
      notifyChange();
      return res;
    }
    try {
      return await addDoc(collection(db, 'rules'), { ...rule, userId });
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'rules');
    }
  },

  async addRules(userId: string, rules: Omit<Rule, 'id' | 'userId'>[]) {
    if (isLocalMode()) {
      const res = await localDbService.addRules(userId, rules);
      notifyChange();
      return res;
    }
    try {
      return await Promise.all(rules.map(r => 
        addDoc(collection(db, 'rules'), { ...r, userId })
      ));
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'rules');
    }
  },

  async deleteRule(ruleId: string) {
    if (isLocalMode()) {
      await localDbService.deleteRule(ruleId);
      notifyChange();
      return;
    }
    try {
      await deleteDoc(doc(db, 'rules', ruleId));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `rules/${ruleId}`);
    }
  },

  // Budgets
  async setBudget(userId: string, categoryId: string, month: string, amount: number) {
    if (isLocalMode()) {
      await localDbService.setBudget(userId, categoryId, month, amount);
      notifyChange();
      return;
    }
    try {
      const budgetId = `${userId}_${categoryId}_${month}`;
      await setDoc(doc(db, 'budgets', budgetId), {
        userId,
        categoryId,
        month,
        amount,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, 'write' as any, `budgets/${userId}_${categoryId}_${month}`);
    }
  },

  async clearAllData(userId: string) {
    if (isLocalMode()) {
      await localDbService.clearAllData(userId);
      notifyChange();
      return;
    }
    try {
      const collectionsToClear = ['transactions', 'categories', 'rules', 'budgets'];
      for (const collName of collectionsToClear) {
        const q = query(collection(db, collName), where('userId', '==', userId));
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
      }
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, 'all_user_data');
    }
  }
};
