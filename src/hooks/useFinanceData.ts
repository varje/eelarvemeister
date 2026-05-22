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
    const qTrans = query(collection(db, 'transactions'), where('userId', '==', userId));
    const qRules = query(collection(db, 'rules'), where('userId', '==', userId));
    const qBudgets = query(collection(db, 'budgets'), where('userId', '==', userId));

    const unsubCats = onSnapshot(
      qCats, 
      (snapshot) => {
        setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
        setLoading(false);
      },
      (error) => {
        console.error("onSnapshot Categories error:", error);
        setLoading(false);
      }
    );

    const unsubTrans = onSnapshot(
      qTrans, 
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
        // Sort descending by date (recent transactions first)
        list.sort((a, b) => b.date.localeCompare(a.date));
        setTransactions(list);
      },
      (error) => {
        console.error("onSnapshot Transactions error:", error);
      }
    );

    const unsubRules = onSnapshot(
      qRules, 
      (snapshot) => {
        setRules(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rule)));
      },
      (error) => {
        console.error("onSnapshot Rules error:", error);
      }
    );

    const unsubBudgets = onSnapshot(
      qBudgets, 
      (snapshot) => {
        setBudgets(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
      },
      (error) => {
        console.error("onSnapshot Budgets error:", error);
      }
    );

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
