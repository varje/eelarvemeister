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
    try {
      return await addDoc(collection(db, 'categories'), { ...category, userId });
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'categories');
    }
  },

  async updateCategory(categoryId: string, category: Partial<Category>) {
    try {
      const { id, ...data } = category;
      await updateDoc(doc(db, 'categories', categoryId), data);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `categories/${categoryId}`);
    }
  },

  async deleteCategory(categoryId: string) {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `categories/${categoryId}`);
    }
  },

  // Transactions
  async updateTransaction(transactionId: string, transaction: Partial<Transaction>) {
    try {
      const { id, ...data } = transaction;
      await updateDoc(doc(db, 'transactions', transactionId), data);
    } catch (e) {
      handleFirestoreError(e, 'update' as any, `transactions/${transactionId}`);
    }
  },

  async addTransactions(userId: string, transactions: Omit<Transaction, 'id' | 'userId'>[]) {
    try {
      // In a real app we'd batch this, but for now simple loop or Promise.all
      return await Promise.all(transactions.map(t => 
        addDoc(collection(db, 'transactions'), { ...t, userId, createdAt: serverTimestamp() })
      ));
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'transactions');
    }
  },

  async getTransactions(userId: string): Promise<Transaction[]> {
    const q = query(collection(db, 'transactions'), where('userId', '==', userId), orderBy('date', 'desc'));
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
    } catch (e) {
      handleFirestoreError(e, 'get' as any, 'transactions');
      return [];
    }
  },

  // Rules
  async getRules(userId: string): Promise<Rule[]> {
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
    try {
      return await addDoc(collection(db, 'rules'), { ...rule, userId });
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'rules');
    }
  },

  async addRules(userId: string, rules: Omit<Rule, 'id' | 'userId'>[]) {
    try {
      return await Promise.all(rules.map(r => 
        addDoc(collection(db, 'rules'), { ...r, userId })
      ));
    } catch (e) {
      handleFirestoreError(e, 'create' as any, 'rules');
    }
  },

  async deleteRule(ruleId: string) {
    try {
      await deleteDoc(doc(db, 'rules', ruleId));
    } catch (e) {
      handleFirestoreError(e, 'delete' as any, `rules/${ruleId}`);
    }
  },

  // Budgets
  async setBudget(userId: string, categoryId: string, month: string, amount: number) {
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
