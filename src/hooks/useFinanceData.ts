import { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { Category, Transaction, Rule, Budget } from '../types';
import { auth, db } from '../lib/firebase';
import { onSnapshot, query, collection, where, orderBy } from 'firebase/firestore';

export const useFinanceData = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Queries
    const qCats = query(collection(db, 'categories'), where('userId', '==', userId));
    const qTrans = query(collection(db, 'transactions'), where('userId', '==', userId), orderBy('date', 'desc'));
    const qRules = query(collection(db, 'rules'), where('userId', '==', userId));
    const qBudgets = query(collection(db, 'budgets'), where('userId', '==', userId));

    const unsubCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
      setLoading(false);
    });

    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    });

    const unsubRules = onSnapshot(qRules, (snapshot) => {
      setRules(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rule)));
    });

    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
    });

    return () => {
      unsubCats();
      unsubTrans();
      unsubRules();
      unsubBudgets();
    };
  }, [userId]);

  const fetchData = async () => {
    // No longer strictly necessary with onSnapshot, but keeping for compatibility
    console.log('Refresh called (using onSnapshot now)');
  };

  const applyRules = (transaction: Transaction, currentRules: Rule[]): string | null => {
    for (const rule of currentRules) {
      if (rule.conditions && rule.conditions.length > 0) {
        const allMatch = rule.conditions.every(condition => {
          const field = condition.field === 'recipient' ? transaction.recipient : transaction.description;
          const cleanPattern = condition.pattern.trim().toLowerCase();
          return field.toLowerCase().includes(cleanPattern);
        });
        if (allMatch) return rule.categoryId;
      } else if (rule.pattern) {
        // Legacy support
        const pattern = rule.pattern.trim().toLowerCase();
        if (
          transaction.recipient.toLowerCase().includes(pattern) ||
          transaction.description.toLowerCase().includes(pattern)
        ) {
          return rule.categoryId;
        }
      }
    }
    return null;
  };

  return {
    categories,
    transactions,
    rules,
    budgets,
    loading,
    refresh: fetchData,
    applyRules
  };
};
