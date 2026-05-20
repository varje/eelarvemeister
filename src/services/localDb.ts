import { Category, Transaction, Rule, Budget } from '../types';

const PREFIX = 'eelarvemeister_local_';

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from local storage`, e);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to local storage`, e);
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export const localDbService = {
  // Profile
  async getUserProfile(uid: string) {
    const profiles = getStorageItem<Record<string, any>>('profiles', {});
    return profiles[uid] || null;
  },

  async setUserProfile(uid: string, profile: { username: string; createdAt: any }) {
    const profiles = getStorageItem<Record<string, any>>('profiles', {});
    profiles[uid] = { ...profile, createdAt: new Date().toISOString() };
    setStorageItem('profiles', profiles);
  },

  // Categories
  async getCategories(userId: string): Promise<Category[]> {
    const categories = getStorageItem<Category[]>('categories', []);
    return categories.filter(c => c.userId === userId);
  },

  async addCategory(userId: string, category: Omit<Category, 'id' | 'userId'>) {
    const categories = getStorageItem<Category[]>('categories', []);
    const newCategory: Category = {
      ...category,
      id: 'cat_' + generateId(),
      userId
    };
    categories.push(newCategory);
    setStorageItem('categories', categories);
    return { id: newCategory.id };
  },

  async updateCategory(categoryId: string, category: Partial<Category>) {
    const categories = getStorageItem<Category[]>('categories', []);
    const index = categories.findIndex(c => c.id === categoryId);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...category };
      setStorageItem('categories', categories);
    }
  },

  async deleteCategory(categoryId: string) {
    const categories = getStorageItem<Category[]>('categories', []);
    const filteredCategories = categories.filter(c => c.id !== categoryId);
    setStorageItem('categories', filteredCategories);
  },

  // Transactions
  async getTransactions(userId: string): Promise<Transaction[]> {
    const transactions = getStorageItem<Transaction[]>('transactions', []);
    return transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  async addTransactions(userId: string, transactions: Omit<Transaction, 'id' | 'userId'>[]) {
    const allTransactions = getStorageItem<Transaction[]>('transactions', []);
    const newTransactions = transactions.map(t => ({
      ...t,
      id: 'tx_' + generateId(),
      userId,
      createdAt: new Date().toISOString()
    }));
    allTransactions.push(...newTransactions);
    setStorageItem('transactions', allTransactions);
    return newTransactions;
  },

  async updateTransaction(transactionId: string, transaction: Partial<Transaction>) {
    const transactions = getStorageItem<Transaction[]>('transactions', []);
    const index = transactions.findIndex(t => t.id === transactionId);
    if (index !== -1) {
      transactions[index] = { ...transactions[index], ...transaction };
      setStorageItem('transactions', transactions);
    }
  },

  async deleteTransactionsByAccount(userId: string, accountNumber: string) {
    const transactions = getStorageItem<Transaction[]>('transactions', []);
    const filtered = transactions.filter(t => !(t.userId === userId && (t.accountNumber || 'EE-PÕHIKONTO') === accountNumber));
    setStorageItem('transactions', filtered);
  },

  // Rules
  async getRules(userId: string): Promise<Rule[]> {
    const rules = getStorageItem<Rule[]>('rules', []);
    return rules.filter(r => r.userId === userId);
  },

  async addRule(userId: string, rule: Omit<Rule, 'id' | 'userId'>) {
    const rules = getStorageItem<Rule[]>('rules', []);
    const newRule: Rule = {
      ...rule,
      id: 'rule_' + generateId(),
      userId
    };
    rules.push(newRule);
    setStorageItem('rules', rules);
    return { id: newRule.id };
  },

  async addRules(userId: string, rules: Omit<Rule, 'id' | 'userId'>[]) {
    const allRules = getStorageItem<Rule[]>('rules', []);
    const newRules = rules.map(r => ({
      ...r,
      id: 'rule_' + generateId(),
      userId
    }));
    allRules.push(...newRules);
    setStorageItem('rules', allRules);
    return newRules;
  },

  async deleteRule(ruleId: string) {
    const rules = getStorageItem<Rule[]>('rules', []);
    const filtered = rules.filter(r => r.id !== ruleId);
    setStorageItem('rules', filtered);
  },

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    const budgets = getStorageItem<Budget[]>('budgets', []);
    return budgets.filter(b => b.userId === userId);
  },

  async setBudget(userId: string, categoryId: string, month: string, amount: number) {
    const budgets = getStorageItem<Budget[]>('budgets', []);
    const budgetId = `${userId}_${categoryId}_${month}`;
    const index = budgets.findIndex(b => b.userId === userId && b.categoryId === categoryId && b.month === month);
    
    const budgetData: Budget = {
      id: budgetId,
      userId,
      categoryId,
      month,
      amount
    };

    if (index !== -1) {
      budgets[index] = budgetData;
    } else {
      budgets.push(budgetData);
    }
    setStorageItem('budgets', budgets);
  },

  async clearAllData(userId: string) {
    const keys = ['categories', 'transactions', 'rules', 'budgets'];
    keys.forEach(key => {
      const items = getStorageItem<any[]>(key, []);
      const filtered = items.filter(i => i.userId !== userId);
      setStorageItem(key, filtered);
    });
  }
};
