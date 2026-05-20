import React, { useMemo, useState, useEffect } from 'react';
import { useFinanceData } from '@/hooks/useFinanceData';
import { Loader2, TrendingUp, TrendingDown, Minus, Star, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { et } from 'date-fns/locale';
import { dbService } from '@/services/db';
import { auth } from '@/lib/firebase';

const BudgetCell = ({ categoryId, month, initialAmount, prefix = '' }: { categoryId: string, month: string, initialAmount: number, prefix?: string }) => {
  const [value, setValue] = useState(initialAmount === 0 ? '' : initialAmount.toString());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(initialAmount === 0 ? '' : initialAmount.toString());
  }, [initialAmount]);

  const handleSave = async () => {
    const amount = parseFloat(value) || 0;
    if (amount === initialAmount) return;
    
    setIsSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      if (userId) {
        await dbService.setBudget(userId, categoryId, month, amount);
      }
    } catch (e) {
      console.error('Failed to save budget', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative group flex items-center justify-end w-full gap-0.5">
      {prefix && initialAmount > 0 && <span className="text-slate-400 font-mono text-[10px]">{prefix}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className={cn(
          "w-full bg-transparent text-right font-mono text-[10px] outline-none border-b border-transparent hover:border-slate-300 focus:border-blue-400 transition-colors py-0.5",
          initialAmount > 0 ? "text-slate-500" : "text-slate-200",
          isSaving && "opacity-50"
        )}
        placeholder="-"
      />
    </div>
  );
};

export const HomeView = () => {
  const { transactions, categories, budgets, loading } = useFinanceData();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const allMonths = useMemo(() => {
    const months = new Set(transactions.map(t => t.date.substring(0, 7)));
    // Also include months that have budgets but no transactions
    budgets.forEach(b => months.add(b.month));
    return Array.from(months).sort();
  }, [transactions, budgets]);

  const isCategoryStarred = React.useCallback((catId?: string | null) => {
    if (!catId) return false;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return false;
    if (cat.isStarred) return true;
    if (cat.parentId) {
      const parent = categories.find(p => p.id === cat.parentId);
      return !!parent?.isStarred;
    }
    return false;
  }, [categories]);

  const stats = useMemo(() => {
    const relevantTransactions = transactions.filter(t => {
      return !isCategoryStarred(t.categoryId);
    });

    const income = relevantTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const expense = Math.abs(relevantTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
    const balance = income - expense;

    const relevantBudgets = budgets.filter(b => {
      return !isCategoryStarred(b.categoryId);
    });

    const budgetIncome = relevantBudgets.filter(b => {
      const cat = categories.find(c => c.id === b.categoryId);
      return cat?.type === 'income';
    }).reduce((sum, b) => sum + b.amount, 0);

    const budgetExpense = relevantBudgets.filter(b => {
      const cat = categories.find(c => c.id === b.categoryId);
      return cat?.type === 'expense';
    }).reduce((sum, b) => sum + b.amount, 0);

    const monthCount = allMonths.length || 1;

    return {
      income,
      expense,
      balance,
      budgetIncome,
      budgetExpense,
      avgIncome: income / monthCount,
      avgExpense: expense / monthCount,
      avgBalance: balance / monthCount,
      avgBudgetIncome: budgetIncome / monthCount,
      avgBudgetExpense: budgetExpense / monthCount
    };
  }, [transactions, categories, allMonths, budgets, isCategoryStarred]);

  const groupStats = useMemo(() => {
    const relevantTransactions = transactions.filter(t => !isCategoryStarred(t.categoryId));
    const relevantBudgets = budgets.filter(b => !isCategoryStarred(b.categoryId));

    const getStatsForType = (type: 'income' | 'expense') => {
      const typeCategories = categories.filter(c => (c.type === type || c.type === 'both') && !isCategoryStarred(c.id));
      const typeCategoryIds = typeCategories.map(c => c.id);

      const monthsData = allMonths.map(m => {
        const monthBudget = relevantBudgets
          .filter(b => b.month === m && typeCategoryIds.includes(b.categoryId))
          .reduce((sum, b) => sum + b.amount, 0);

        const monthTrans = relevantTransactions.filter(t => t.date.startsWith(m));
        const monthActual = type === 'income'
          ? monthTrans.filter(t => t.amount > 0 && (typeCategoryIds.includes(t.categoryId) || !t.categoryId)).reduce((sum, t) => sum + t.amount, 0)
          : Math.abs(monthTrans.filter(t => t.amount < 0 && (typeCategoryIds.includes(t.categoryId) || !t.categoryId)).reduce((sum, t) => sum + t.amount, 0));

        return { month: m, budget: monthBudget, actual: monthActual };
      });

      const totalBudget = monthsData.reduce((sum, d) => sum + d.budget, 0);
      const totalActual = monthsData.reduce((sum, d) => sum + d.actual, 0);

      const monthCount = allMonths.length || 1;
      const avgBudget = totalBudget / monthCount;
      const avgActual = totalActual / monthCount;

      return {
        monthsData,
        totalBudget,
        totalActual,
        avgBudget,
        avgActual
      };
    };

    return {
      income: getStatsForType('income'),
      expense: getStatsForType('expense')
    };
  }, [transactions, categories, budgets, allMonths, isCategoryStarred]);

  const renderCategoryRows = (type: 'income' | 'expense') => {
    const parentCategories = categories
      .filter(c => (c.type === type || c.type === 'both') && !c.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));

    const rows: React.ReactNode[] = parentCategories.map(cat => {
      const children = categories.filter(c => c.parentId === cat.id);
      const isExpanded = expandedCategories[cat.id] ?? false; // Default to collapsed as requested
      const catIds = [cat.id, ...children.map(c => c.id)];
      
      const catTransactions = transactions.filter(t => catIds.includes(t.categoryId));
      const catBudgets = budgets.filter(b => catIds.includes(b.categoryId));

      const totalActual = type === 'income' 
        ? catTransactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0)
        : Math.abs(catTransactions.reduce((sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0));

      const totalBudget = catBudgets.reduce((sum, b) => sum + b.amount, 0);

      const monthCount = allMonths.length || 1;

      return (
        <React.Fragment key={cat.id}>
          <tr className={cn(cat.isStarred && "bg-slate-50/50 grayscale-[0.5] opacity-60")}>
            <td className="px-4 py-1.5 text-center border-r">
               {cat.isStarred ? <Star className="w-3 h-3 text-amber-400 fill-amber-400 mx-auto" /> : <span className="text-slate-200">☆</span>}
            </td>
            <td className="px-4 py-1.5 border-r font-medium text-slate-800">
              <div className="flex items-center gap-2">
                {children.length > 0 && (
                  <button 
                    onClick={() => toggleCategory(cat.id)}
                    className="p-0.5 hover:bg-slate-100 rounded transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
                  </button>
                )}
                {cat.name}
              </div>
            </td>
            {allMonths.map(m => {
              const monthTrans = catTransactions.filter(t => t.date.startsWith(m));
              const mActual = type === 'income'
                ? monthTrans.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0)
                : Math.abs(monthTrans.reduce((sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0));
              
              const mBudget = catBudgets.filter(b => b.month === m).reduce((sum, b) => sum + b.amount, 0);

              return (
                <React.Fragment key={m}>
                  <td className={cn(
                    "px-4 py-1.5 text-right border-r font-mono text-[10px] bg-slate-50/30 w-20"
                  )}>
                    <BudgetCell categoryId={cat.id} month={m} initialAmount={mBudget} prefix={type === 'expense' ? '-' : ''} />
                  </td>
                  <td className={cn(
                    "px-4 py-1.5 text-right border-r font-mono text-[10px]",
                    mActual > 0 ? (type === 'income' ? "text-emerald-500" : "text-rose-500") : "text-slate-300"
                  )}>
                    {mActual > 0 ? (type === 'income' ? '' : '-') + mActual.toFixed(2) : '-'}
                  </td>
                </React.Fragment>
              );
            })}
            <td className="px-4 py-1.5 text-right border-r font-mono font-bold text-xs bg-slate-50/70 text-slate-500">
              {type === 'income' ? '' : totalBudget > 0 ? '-' : ''}{totalBudget.toFixed(2)}
            </td>
            <td className={cn(
              "px-4 py-1.5 text-right border-r font-mono font-bold text-xs bg-slate-50/50",
              type === 'income' ? "text-emerald-700" : "text-rose-700"
            )}>
              {type === 'income' ? '' : totalActual > 0 ? '-' : ''}{totalActual.toFixed(2)}
            </td>
            <td className="px-4 py-1.5 text-right border-r font-mono text-slate-400 bg-slate-50/70">
              {type === 'income' ? '' : (totalBudget / monthCount) > 0 ? '-' : ''}{(totalBudget / monthCount).toFixed(2)}
            </td>
            <td className="px-4 py-1.5 text-right border-r font-mono text-slate-500 bg-slate-50/50">
              {type === 'income' ? '' : (totalActual / monthCount) > 0 ? '-' : ''}{(totalActual / monthCount).toFixed(2)}
            </td>
            <td className={cn(
              "px-4 py-1.5 text-right font-mono text-[10px] bg-slate-50/70 shrink-0",
              totalBudget > 0 ? (
                type === 'income' ? (
                  (totalActual / totalBudget) > 1 ? "text-emerald-600 font-bold" : 
                  (totalActual / totalBudget) < 1 ? "text-rose-600 font-bold" : "text-slate-400"
                ) : (
                  (totalActual / totalBudget) > 1 ? "text-rose-600 font-bold" : 
                  (totalActual / totalBudget) < 1 ? "text-emerald-600 font-bold" : "text-slate-400"
                )
              ) : "text-slate-300"
            )}>
              {totalBudget > 0 ? `${(((totalActual - totalBudget) / totalBudget) * 100).toFixed(0)}%` : '-'}
            </td>
          </tr>
          {isExpanded && children.map(sub => {
            const subTransactions = transactions.filter(t => t.categoryId === sub.id);
            const subBudgets = budgets.filter(b => b.categoryId === sub.id);

            const subActual = type === 'income' 
              ? subTransactions.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0)
              : Math.abs(subTransactions.reduce((sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0));
            
            const subTotalBudget = subBudgets.reduce((sum, b) => sum + b.amount, 0);

            return (
              <tr key={sub.id} className={cn("text-[11px] bg-slate-50/30", sub.isStarred && "opacity-50")}>
                <td className="px-4 py-1 text-center border-r">
                   {sub.isStarred ? <Star className="w-2.5 h-2.5 text-amber-300 fill-amber-300 mx-auto" /> : <span className="text-slate-200">☆</span>}
                </td>
                <td className="px-4 py-1 border-r text-slate-500 pl-8">↳ {sub.name}</td>
                {allMonths.map(m => {
                  const mTrans = subTransactions.filter(t => t.date.startsWith(m));
                  const mAmount = type === 'income'
                    ? mTrans.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0)
                    : Math.abs(mTrans.reduce((sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0));
                  
                  const mBudget = subBudgets.filter(b => b.month === m).reduce((sum, b) => sum + b.amount, 0);

                  return (
                    <React.Fragment key={m}>
                      <td className={cn(
                        "px-4 py-1 text-right border-r font-mono text-[9px] bg-slate-50/40 w-20"
                      )}>
                        <BudgetCell categoryId={sub.id} month={m} initialAmount={mBudget} prefix={type === 'expense' ? '-' : ''} />
                      </td>
                      <td className={cn(
                        "px-4 py-1 text-right border-r font-mono text-[9px]",
                        mAmount > 0 ? "text-slate-500" : "text-slate-200"
                      )}>
                        {mAmount > 0 ? (type === 'income' ? '' : '-') + mAmount.toFixed(2) : '-'}
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="px-4 py-1 text-right border-r font-mono text-slate-400 bg-slate-50/40">
                  {type === 'income' ? '' : subTotalBudget > 0 ? '-' : ''}{subTotalBudget.toFixed(2)}
                </td>
                <td className="px-4 py-1 text-right border-r font-mono text-slate-600 font-medium bg-slate-50/20">
                  {type === 'income' ? '' : subActual > 0 ? '-' : ''}{subActual.toFixed(2)}
                </td>
                <td className="px-4 py-1 text-right border-r font-mono text-slate-300 bg-slate-50/40">
                  {type === 'income' ? '' : (subTotalBudget / monthCount) > 0 ? '-' : ''}{(subTotalBudget / monthCount).toFixed(2)}
                </td>
                <td className="px-4 py-1 text-right border-r font-mono text-slate-400 bg-slate-50/20">
                  {type === 'income' ? '' : (subActual / monthCount) > 0 ? '-' : ''}{(subActual / monthCount).toFixed(2)}
                </td>
                <td className={cn(
                  "px-4 py-1 text-right font-mono text-[9px] bg-slate-50/40 shrink-0",
                  subTotalBudget > 0 ? (
                    type === 'income' ? (
                      (subActual / subTotalBudget) > 1 ? "text-emerald-600 font-medium" : 
                      (subActual / subTotalBudget) < 1 ? "text-rose-600 font-medium" : "text-slate-400"
                    ) : (
                      (subActual / subTotalBudget) > 1 ? "text-rose-600 font-medium" : 
                      (subActual / subTotalBudget) < 1 ? "text-emerald-600 font-medium" : "text-slate-400"
                    )
                  ) : "text-slate-300"
                )}>
                  {subTotalBudget > 0 ? `${(((subActual - subTotalBudget) / subTotalBudget) * 100).toFixed(0)}%` : '-'}
                </td>
              </tr>
            );
          })}
        </React.Fragment>
      );
    });

    // Add summary row for uncategorized transactions of this type
    const uncategorizedTrans = transactions.filter(t => !t.categoryId && (type === 'income' ? t.amount > 0 : t.amount < 0));
    const uncategorizedTotal = Math.abs(uncategorizedTrans.reduce((sum, t) => sum + t.amount, 0));
    
    if (uncategorizedTotal > 0) {
      const monthCount = allMonths.length || 1;
      
      rows.push(
        <tr key={`uncategorized-${type}`} className="bg-amber-50/20 italic">
          <td className="px-4 py-1.5 text-center border-r">
             <span className="text-amber-400 text-[10px] font-bold">?</span>
          </td>
          <td className="px-4 py-1.5 border-r font-medium text-slate-500 italic">Kategoriseerimata {type === 'income' ? 'tulud' : 'kulud'}</td>
          {allMonths.map(m => {
            const mTrans = uncategorizedTrans.filter(t => t.date.startsWith(m));
            const mAmount = Math.abs(mTrans.reduce((sum, t) => sum + t.amount, 0));
            return (
              <React.Fragment key={m}>
                <td className="px-4 py-1.5 text-right border-r font-mono text-[9px] bg-slate-100/10 text-slate-200">-</td>
                <td className={cn(
                  "px-4 py-1.5 text-right border-r font-mono text-[9px]",
                  mAmount > 0 ? "text-amber-500/70" : "text-slate-200"
                )}>
                  {mAmount > 0 ? (type === 'income' ? '' : '-') + mAmount.toFixed(2) : '-'}
                </td>
              </React.Fragment>
            );
          })}
          <td className="px-4 py-1.5 text-right border-r font-mono font-bold text-xs bg-slate-100/10 text-slate-300">-</td>
          <td className={cn(
            "px-4 py-1.5 text-right border-r font-mono font-bold bg-amber-50/40 text-xs",
            type === 'income' ? "text-emerald-500/70" : "text-rose-500/70"
          )}>{type === 'income' ? '' : uncategorizedTotal > 0 ? '-' : ''}{uncategorizedTotal.toFixed(2)}</td>
          <td className="px-4 py-1.5 text-right border-r font-mono text-slate-300 bg-slate-100/10">-</td>
          <td className="px-4 py-1.5 text-right border-r font-mono text-slate-400 bg-amber-50/40">
            {type === 'income' ? '' : (uncategorizedTotal / monthCount) > 0 ? '-' : ''}{(uncategorizedTotal / monthCount).toFixed(2)}
          </td>
          <td className="px-4 py-1.5 text-right font-mono text-slate-300 bg-slate-100/10">-</td>
        </tr>
      );
    }

    return rows;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold tracking-tight">Ülevaade</h2>
          <div className="flex gap-1">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Kõik andmed</span>
          </div>
        </div>
      </header>

      {/* Statistics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-slate-100 border-b border-slate-200 shrink-0">
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
          <p className="text-slate-500 uppercase font-bold text-[9px] mb-1">Keskmine tulu</p>
          <p className="text-xl font-bold text-emerald-600">+{stats.avgIncome.toFixed(2)} €</p>
          <p className="text-[10px] text-slate-400">Kokku: {stats.income.toFixed(2)} €</p>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
          <p className="text-slate-500 uppercase font-bold text-[9px] mb-1">Keskmine kulu</p>
          <p className="text-xl font-bold text-rose-600">-{stats.avgExpense.toFixed(2)} €</p>
          <p className="text-[10px] text-slate-400">Kokku: -{stats.expense.toFixed(2)} €</p>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
          <p className="text-slate-500 uppercase font-bold text-[9px] mb-1">Sääst / Vahe</p>
          <p className="text-xl font-bold text-slate-900">{stats.avgBalance >= 0 ? '+' : ''}{stats.avgBalance.toFixed(2)} €</p>
          <p className="text-[10px] text-slate-400">Saldo: {stats.balance.toFixed(2)} €</p>
        </div>
        <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
          <p className="text-slate-500 uppercase font-bold text-[9px] mb-1">Eelarve Täitmine</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-500",
                  (stats.expense / (stats.budgetExpense || 1)) > 1 ? "bg-rose-500" : "bg-blue-500"
                )} 
                style={{ width: `${Math.min(100, (stats.expense / (stats.budgetExpense || 1)) * 100)}%` }}
              ></div>
            </div>
            <span className="font-bold text-[10px]">{Math.round((stats.expense / (stats.budgetExpense || 1)) * 100)}%</span>
          </div>
          <p className="text-[10px] text-slate-400 italic">Eelarve: -{stats.budgetExpense.toFixed(2)} €</p>
        </div>
      </div>

      {/* Main Data Container */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="bg-white border border-slate-200 rounded shadow-sm h-full flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm text-[10px]">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-2 font-bold text-slate-500 border-r w-8 bg-slate-50" rowSpan={2}>⭐</th>
                  <th className="px-4 py-2 font-bold text-slate-500 border-r bg-slate-50 min-w-[150px]" rowSpan={2}>Kategooria</th>
                  {allMonths.map(m => (
                    <th key={m} colSpan={2} className="px-4 py-1 font-bold text-slate-500 text-center border-r bg-slate-50 capitalize border-b">
                      {format(new Date(m + "-01"), 'MMM, yyyy', { locale: et })}
                    </th>
                  ))}
                  <th colSpan={2} className="px-4 py-1 font-bold text-slate-500 text-center border-r bg-slate-100/50 border-b">KOKKU</th>
                  <th colSpan={3} className="px-4 py-1 font-bold text-slate-500 text-center bg-slate-100/50 border-b">KESKMINE</th>
                </tr>
                <tr className="border-b border-slate-200">
                  {allMonths.map(m => (
                    <React.Fragment key={m}>
                      <th className="px-4 py-1 font-bold text-slate-400 text-right border-r bg-slate-50/80 text-[8px]">EELARVE</th>
                      <th className="px-4 py-1 font-bold text-slate-400 text-right border-r bg-slate-50/50 text-[8px]">TEGELIK</th>
                    </React.Fragment>
                  ))}
                  <th className="px-4 py-1 font-bold text-slate-400 text-right border-r bg-slate-100/50 text-[8px]">EELARVE</th>
                  <th className="px-4 py-1 font-bold text-slate-400 text-right border-r bg-slate-100/30 text-[8px]">TEGELIK</th>
                  <th className="px-4 py-1 font-bold text-slate-400 text-right border-r bg-slate-100/50 text-[8px]">EELARVE</th>
                  <th className="px-4 py-1 font-bold text-slate-400 text-right border-r bg-slate-100/30 text-[8px]">TEGELIK</th>
                  <th className="px-4 py-1 font-bold text-slate-400 text-right bg-slate-100/50 text-[8px]">VAHE %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Tulud Section */}
                <tr className="bg-emerald-100 font-bold text-emerald-950 uppercase text-[10px]">
                  <td className="px-4 py-2 text-center border-r border-slate-200">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 mx-auto" />
                  </td>
                  <td className="px-4 py-2 border-r border-slate-200 font-extrabold tracking-wider">
                    Sissetulekud (KOKKU)
                  </td>
                  {groupStats.income.monthsData.map(d => (
                    <React.Fragment key={d.month}>
                      <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-[10px] bg-emerald-50/60 text-slate-700">
                        {d.budget > 0 ? d.budget.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-[10px] text-emerald-700 bg-emerald-50/20">
                        {d.actual > 0 ? d.actual.toFixed(2) : '-'}
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono font-black text-xs bg-emerald-50/80 text-emerald-950">
                    {groupStats.income.totalBudget.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono font-black text-xs text-emerald-800 bg-emerald-50/50">
                    {groupStats.income.totalActual.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-slate-600 bg-emerald-50/80">
                    {groupStats.income.avgBudget.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-emerald-800 bg-emerald-50/50">
                    {groupStats.income.avgActual.toFixed(2)}
                  </td>
                  <td className={cn(
                    "px-4 py-2 text-right font-mono text-[10px] bg-emerald-50/80 border-slate-200",
                    groupStats.income.totalBudget > 0 ? (
                      (groupStats.income.totalActual / groupStats.income.totalBudget) > 1 ? "text-emerald-700 font-extrabold" :
                      (groupStats.income.totalActual / groupStats.income.totalBudget) < 1 ? "text-rose-700 font-extrabold" : "text-slate-500"
                    ) : "text-slate-400"
                  )}>
                    {groupStats.income.totalBudget > 0 ? `${(((groupStats.income.totalActual - groupStats.income.totalBudget) / groupStats.income.totalBudget) * 100).toFixed(0)}%` : '-'}
                  </td>
                </tr>
                {renderCategoryRows('income')}
 
                {/* Kulud Section */}
                <tr className="bg-rose-100 font-bold text-rose-950 uppercase text-[10px] border-t-2 border-slate-200">
                  <td className="px-4 py-2 text-center border-r border-slate-200">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 mx-auto" />
                  </td>
                  <td className="px-4 py-2 border-r border-slate-200 font-extrabold tracking-wider">
                    Väljaminekud (KOKKU)
                  </td>
                  {groupStats.expense.monthsData.map(d => (
                    <React.Fragment key={d.month}>
                      <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-[10px] bg-rose-50/60 text-slate-700">
                        {d.budget > 0 ? `-${d.budget.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-[10px] text-rose-700 bg-rose-50/20">
                        {d.actual > 0 ? `-${d.actual.toFixed(2)}` : '-'}
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono font-black text-xs bg-rose-50/80 text-rose-950">
                    {groupStats.expense.totalBudget > 0 ? `-${groupStats.expense.totalBudget.toFixed(2)}` : '0.00'}
                  </td>
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono font-black text-xs text-rose-850 bg-rose-50/50">
                    {groupStats.expense.totalActual > 0 ? `-${groupStats.expense.totalActual.toFixed(2)}` : '0.00'}
                  </td>
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-slate-600 bg-rose-50/80">
                    {groupStats.expense.avgBudget > 0 ? `-${groupStats.expense.avgBudget.toFixed(2)}` : '0.00'}
                  </td>
                  <td className="px-4 py-2 text-right border-r border-slate-200 font-mono text-rose-800 bg-rose-50/50">
                    {groupStats.expense.avgActual > 0 ? `-${groupStats.expense.avgActual.toFixed(2)}` : '0.00'}
                  </td>
                  <td className={cn(
                    "px-4 py-2 text-right font-mono text-[10px] bg-rose-50/80 border-slate-200",
                    groupStats.expense.totalBudget > 0 ? (
                      (groupStats.expense.totalActual / groupStats.expense.totalBudget) > 1 ? "text-rose-700 font-extrabold" :
                      (groupStats.expense.totalActual / groupStats.expense.totalBudget) < 1 ? "text-emerald-700 font-extrabold" : "text-slate-500"
                    ) : "text-slate-400"
                  )}>
                    {groupStats.expense.totalBudget > 0 ? `${(((groupStats.expense.totalActual - groupStats.expense.totalBudget) / groupStats.expense.totalBudget) * 100).toFixed(0)}%` : '-'}
                  </td>
                </tr>
                {renderCategoryRows('expense')}
                
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={7 + (allMonths.length * 2)} className="text-center py-12 text-slate-400 italic font-mono text-xs">
                      Puuduvad andmed kuvamiseks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex justify-between items-center text-[9px] text-slate-500 shrink-0">
            <div className="flex gap-4">
              <span>Aktiivseid kategooriaid: {categories.length}</span>
              <span>Tehinguid kokku: {transactions.length}</span>
            </div>
            <div className="flex gap-2 items-center">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span>Süsteem on töökorras</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
