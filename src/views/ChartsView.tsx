import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFinanceData } from '@/hooks/useFinanceData';
import { Loader2, Pencil, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dbService } from '@/services/db';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const ChartsView = () => {
  const { transactions, categories, loading } = useFinanceData();
  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const [chartPeriod, setChartPeriod] = useState<string>('average');
  const [savingsPeriod, setSavingsPeriod] = useState<string>('average');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBucket, setEditingBucket] = useState<'necessities' | 'entertainment' | 'investments' | 'income' | null>(null);
  const [savingCategoryBucketId, setSavingCategoryBucketId] = useState<string | null>(null);

  const handleToggleCategory = (name: string) => {
    setHiddenCategories(prev => 
      prev.includes(name) 
        ? prev.filter(c => c !== name) 
        : [...prev, name]
    );
  };

  const isCategoryStarred = (catId?: string | null) => {
    if (!catId) return false;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return false;
    if (cat.isStarred) return true;
    if (cat.parentId) {
      const parent = categories.find(p => p.id === cat.parentId);
      return !!parent?.isStarred;
    }
    return false;
  };

  const getCategoryBucket = (cat: any) => {
    if (cat.savingsBucket) {
      return cat.savingsBucket;
    }
    
    if (cat.parentId) {
      const parent = categories.find(p => p.id === cat.parentId);
      if (parent && parent.savingsBucket) {
        return parent.savingsBucket;
      }
    }
    
    const isIncome = cat.type === 'income' || (cat.parentId && categories.find(p => p.id === cat.parentId)?.type === 'income');
    if (isIncome) {
      return 'income';
    }

    const name = cat.name.toLowerCase();
    const entertainmentKeywords = ['meelelahutus', 'resto', 'kino', 'teater', 'reisimine', 'hobi', 'kohvik', 'vaba aeg', 'vabaaeg', 'väljas söömine'];
    const investmentKeywords = ['investeering', 'sääst', 'aktsia', 'fond', 'pension', 'indeks', 'hoiuse', 'hoiustamine'];

    if (entertainmentKeywords.some(k => name.includes(k))) {
      return 'entertainment';
    } else if (investmentKeywords.some(k => name.includes(k))) {
      return 'investments';
    } else {
      return 'necessities';
    }
  };

  const months = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort().reverse();
  }, [transactions]);

  const fullPieData = useMemo(() => {
    const expenseCategories = categories.filter(c => c.type === 'expense' && !isCategoryStarred(c.id));
    
    // Filter transactions based on selected period
    const filteredTransactions = transactions.filter(t => {
      if (t.amount >= 0) return false;
      if (isCategoryStarred(t.categoryId)) return false;
      if (chartPeriod !== 'average' && chartPeriod !== 'total') {
        // Specific month like YYYY-MM
        return t.date.startsWith(chartPeriod);
      }
      return true;
    });

    const monthCount = months.length || 1;

    const data = expenseCategories.map(cat => {
      const total = Math.abs(filteredTransactions
        .filter(t => t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0));
      
      const value = chartPeriod === 'average' ? total / monthCount : total;
      return { name: cat.name, value };
    }).filter(d => d.value > 0);

    // Calculate total for uncategorized expenses
    const uncategorizedTotal = Math.abs(filteredTransactions
      .filter(t => !t.categoryId || !categories.some(c => c.id === t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0));

    if (uncategorizedTotal > 0) {
      const value = chartPeriod === 'average' ? uncategorizedTotal / monthCount : uncategorizedTotal;
      data.push({ name: 'Kategoriseerimata', value });
    }

    const sorted = data.sort((a, b) => b.value - a.value).slice(0, 10);

    return sorted.map((d, index) => ({
      ...d,
      color: COLORS[index % COLORS.length]
    }));
  }, [transactions, categories, chartPeriod, months]);

  const pieData = useMemo(() => {
    return fullPieData.filter(d => !hiddenCategories.includes(d.name));
  }, [fullPieData, hiddenCategories]);

  const barData = useMemo(() => {
    const months = Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort();
    return months.map(month => {
      const monthTrans = transactions.filter(t => {
        if (!t.date.startsWith(month)) return false;
        return !isCategoryStarred(t.categoryId);
      });
      const income = monthTrans.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const expense = Math.abs(monthTrans.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
      return { name: month, tulu: income, kulu: expense };
    });
  }, [transactions, categories]);

  const savingsModel = useMemo(() => {
    // Filter transactions based on selected savingsPeriod and omit starred categories
    const filteredTransactions = transactions.filter(t => {
      if (isCategoryStarred(t.categoryId)) return false;
      if (savingsPeriod !== 'average' && savingsPeriod !== 'total') {
        // Specific month like YYYY-MM
        return t.date.startsWith(savingsPeriod);
      }
      return true;
    });

    const incomeTrans = filteredTransactions.filter(t => t.amount > 0);
    const expenseTrans = filteredTransactions.filter(t => t.amount < 0);

    const monthCount = months.length || 1;

    // Calculate totalIncome based on selected/included income categories
    let rawIncome = 0;
    incomeTrans.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (!cat) {
        // Uncategorized income is included by default
        rawIncome += t.amount;
        return;
      }
      const bucket = getCategoryBucket(cat);
      if (bucket !== 'unassigned') {
        rawIncome += t.amount;
      }
    });

    let totalIncome = rawIncome;
    // For 'average', we want the monthly average
    if (savingsPeriod === 'average') {
      totalIncome = totalIncome / monthCount;
    }

    if (totalIncome <= 0) {
      return { data: null, totalIncome: 0, hasIncome: false };
    }

    let necessitiesTotal = 0;
    let entertainmentTotal = 0;
    let investmentsTotal = 0;

    expenseTrans.forEach(t => {
      const absAmount = Math.abs(t.amount);
      const cat = categories.find(c => c.id === t.categoryId);
      if (!cat) {
        // Uncategorized expenses are excluded from our custom bucket list
        return;
      }

      const bucket = getCategoryBucket(cat);
      if (bucket === 'necessities') {
        necessitiesTotal += absAmount;
      } else if (bucket === 'entertainment') {
        entertainmentTotal += absAmount;
      } else if (bucket === 'investments') {
        investmentsTotal += absAmount;
      }
    });

    if (savingsPeriod === 'average') {
      necessitiesTotal = necessitiesTotal / monthCount;
      entertainmentTotal = entertainmentTotal / monthCount;
      investmentsTotal = investmentsTotal / monthCount;
    }

    const data = [
      { 
        name: 'Vajalikud kulutused', 
        recommended: 'kuni 50%', 
        actual: (necessitiesTotal / totalIncome) * 100,
        amount: necessitiesTotal,
        status: (necessitiesTotal / totalIncome) <= 0.5 ? 'ok' : 'warn'
      },
      { 
        name: 'Meelelahutus', 
        recommended: 'kuni 20%', 
        actual: (entertainmentTotal / totalIncome) * 100,
        amount: entertainmentTotal,
        status: (entertainmentTotal / totalIncome) <= 0.2 ? 'ok' : 'warn'
      },
      { 
        name: 'Investeeringud', 
        recommended: 'vähemalt 30%', 
        actual: (investmentsTotal / totalIncome) * 100,
        amount: investmentsTotal,
        status: (investmentsTotal / totalIncome) >= 0.3 ? 'ok' : 'warn'
      }
    ];

    return { data, totalIncome, hasIncome: true };
  }, [transactions, categories, savingsPeriod, months]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }

  const hasData = transactions.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <h2 className="text-lg font-bold tracking-tight">Finantsgraafikud</h2>
      </header>

      <div className="flex-1 p-6 overflow-auto bg-slate-50">
        {!hasData ? (
          <div className="bg-white p-12 rounded border border-slate-200 text-center text-slate-400 font-medium italic shadow-sm">
             Andmed puuduvad. Graafikute kuvamiseks impordi tehinguid.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
              <div className="bg-white p-6 rounded border border-slate-200 shadow-sm min-h-[400px] flex flex-col justify-between">
                <div>
                  <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Suurimad kulud kategooriate kaupa</h2>
                      <div className="flex items-center gap-3 shrink-0">
                        {hiddenCategories.length > 0 && (
                          <button
                            onClick={() => setHiddenCategories([])}
                            className="text-[10px] text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer"
                          >
                            Taasta kõik
                          </button>
                        )}
                        <span className="text-[10px] text-slate-400 italic font-medium hidden sm:inline">Klõpsa mummule peitmiseks/kuvamiseks</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Kuva kulu tüüp:</span>
                      <select 
                        value={chartPeriod} 
                        onChange={(e) => {
                          setChartPeriod(e.target.value);
                          setHiddenCategories([]);
                        }}
                        className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700 font-bold transition-colors shadow-sm"
                      >
                        <option value="average">Keskmine kulu kuus (vaikimisi)</option>
                        <option value="total">Kokku kulu (kogu periood)</option>
                        {months.length > 0 && (
                          <optgroup label="Vali konkreetne kuu">
                            {months.map(m => (
                              <option key={m} value={m}>Kuu kulu: {m}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-6 justify-between min-h-[300px]">
                    {/* Pie Chart Column */}
                    <div className="w-full sm:w-[55%] h-[280px] flex items-center justify-center relative">
                      {pieData.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-[11px] italic gap-2 text-center">
                          Kõik kategooriad on peidetud.
                          <button
                            onClick={() => setHiddenCategories([])}
                            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 text-slate-600 rounded text-[10px] font-bold transition-all cursor-pointer"
                          >
                            Taasta kõik
                          </button>
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={95}
                              paddingAngle={4}
                              dataKey="value"
                              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                            >
                              {pieData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.color} 
                                  className="cursor-pointer hover:opacity-85 transition-opacity outline-none"
                                  onClick={() => handleToggleCategory(entry.name)}
                                />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ fontSize: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                              formatter={(value: number) => [`${value.toFixed(2)} €`, 'Summa']} 
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Legendary Category List with dots on the right */}
                    <div className="w-full sm:w-[45%] flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block border-b border-slate-50 pb-1">
                        Sektorid ({pieData.length}/{fullPieData.length})
                      </span>
                      {fullPieData.map((entry) => {
                        const isHidden = hiddenCategories.includes(entry.name);
                        return (
                          <button
                            key={entry.name}
                            onClick={() => handleToggleCategory(entry.name)}
                            className={cn(
                              "flex items-center justify-between w-full px-2.5 py-1.5 rounded transition-all text-left text-xs cursor-pointer select-none border",
                              isHidden 
                                ? "bg-slate-50 border-slate-100/50 text-slate-400 line-through decoration-slate-300 opacity-60 hover:opacity-100"
                                : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700 font-medium"
                            )}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0 transition-all border"
                                style={{ 
                                  backgroundColor: isHidden ? 'transparent' : entry.color,
                                  borderColor: entry.color
                                }}
                              />
                              <span className="truncate">{entry.name}</span>
                            </div>
                            <span className="text-[10px] font-mono shrink-0 ml-2">
                              {entry.value.toFixed(2)} €
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded border border-slate-200 shadow-sm min-h-[400px]">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-50 pb-2">Tulu vs Kulu ajalugu</h2>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                      <Tooltip 
                        contentStyle={{ fontSize: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                        formatter={(value: number) => [`${value.toFixed(2)} €`, '']} 
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                      <Bar dataKey="tulu" name="Tulu" fill="#10b981" radius={[2, 2, 0, 0]} barSize={30} />
                      <Bar dataKey="kulu" name="Kulu" fill="#f43f5e" radius={[2, 2, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {savingsModel && (
              <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden mb-6">
                <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Säästumudel (50/20/30)</h2>
                    <p className="text-[10px] text-slate-500 font-medium italic">Standardmudel tulujaotuse hindamiseks ( Kogutulu = 100% )</p>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Periood:</span>
                    <select 
                      value={savingsPeriod} 
                      onChange={(e) => setSavingsPeriod(e.target.value)}
                      className="text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-slate-700 font-bold transition-colors shadow-sm"
                    >
                      <option value="average">Keskmine kuus (vaikimisi)</option>
                      <option value="total">Kokku kogu periood</option>
                      {months.length > 0 && (
                        <optgroup label="Vali konkreetne kuu">
                          {months.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                {!savingsModel.hasIncome ? (
                  <div className="p-8 text-center text-slate-400 font-medium italic text-xs">
                    Sellel perioodil puuduvad sissetulekud suhtarvude arvutamiseks.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kategooria</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Soovituslik %</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Summa (€)</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Tegelik %</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Olek</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {savingsModel.data && savingsModel.data.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-700">{item.name}</span>
                                <button
                                  onClick={() => {
                                    const bucketTypes = ['necessities', 'entertainment', 'investments'] as const;
                                    setEditingBucket(bucketTypes[index]);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                                  title="Seadista kategooriaid"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                {item.recommended}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-mono text-xs font-semibold text-slate-600">
                                {item.amount.toFixed(2)} €
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className={cn(
                                "text-sm font-mono font-bold",
                                item.status === 'ok' ? 'text-emerald-600' : 'text-rose-600'
                              )}>
                                {item.actual.toFixed(1)}%
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className={cn(
                                "inline-flex items-center justify-center w-6 h-6 rounded-full",
                                item.status === 'ok' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                              )}>
                                {item.status === 'ok' ? (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50/70 border-t border-slate-200">
                          <td className="px-6 py-3 text-[11px] font-bold text-slate-700">
                            <div className="flex items-center gap-2">
                              <span>Kogutulu (100%)</span>
                              <button
                                onClick={() => {
                                  setEditingBucket('income');
                                  setIsModalOpen(true);
                                }}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
                                title="Seadista tulukategooriaid"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-center text-slate-400 font-medium text-[10px]">-</td>
                          <td className="px-6 py-3 text-right font-mono text-xs font-bold text-slate-800">{savingsModel.totalIncome.toFixed(2)} €</td>
                          <td className="px-6 py-3 text-right font-mono text-xs font-bold text-slate-800">100.0%</td>
                          <td className="px-6 py-3 text-center text-slate-400 font-medium text-[10px]">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {isModalOpen && editingBucket && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded border border-slate-200 shadow-xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Seadista: {
                    editingBucket === 'income' ? 'Kogutulu sissetulekud (100%)' :
                    editingBucket === 'necessities' ? 'Vajalikud kulutused (50%)' :
                    editingBucket === 'entertainment' ? 'Meelelahutus ja vabadus (20%)' :
                    'Säästud ja investeeringud (30%)'
                  }
                </h3>
                <p className="text-[10px] text-slate-400 font-medium italic mt-0.5">
                  {editingBucket === 'income' 
                    ? 'Vali millised sissetulekud arvestatakse mudeli kogutulu hulka'
                    : 'Määra millised kategooriad kuuluvad sellesse säästufraktsiooni'
                  }
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingBucket(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-4 flex-1 overflow-auto divide-y divide-slate-100 max-h-[55vh]">
              {categories
                .filter(c => {
                  if (isCategoryStarred(c.id)) return false;
                  if (editingBucket === 'income') {
                    return c.type === 'income' || c.type === 'both';
                  } else {
                    return c.type === 'expense' || c.type === 'both';
                  }
                })
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(cat => {
                  const currentBucket = getCategoryBucket(cat);
                  const isChecked = currentBucket === editingBucket;
                  const parentCat = cat.parentId ? categories.find(p => p.id === cat.parentId) : null;
                  const isDefault = !cat.savingsBucket && (!parentCat || !parentCat.savingsBucket);
                  const isInherited = !cat.savingsBucket && parentCat && !!parentCat.savingsBucket;

                  return (
                    <div key={cat.id} className="py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <label className="relative flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={async () => {
                              setSavingCategoryBucketId(cat.id);
                              try {
                                const newVal = isChecked ? 'unassigned' : editingBucket;
                                await dbService.updateCategory(cat.id, { savingsBucket: newVal });
                              } catch (e) {
                                console.error('Error updating category savingsBucket', e);
                              } finally {
                                setSavingCategoryBucketId(null);
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                            {parentCat && (
                              <span className="text-[8px] font-bold text-slate-400 bg-slate-100 py-0.5 px-1.5 rounded-full border border-slate-200/50">
                                alam: {parentCat.name}
                              </span>
                            )}
                          </div>
                          {isDefault ? (
                            <span className="text-[9px] text-slate-400 font-medium italic">
                              Süsteemi vaikeväärtus ({
                                editingBucket === 'income' ? 'Kaasatud' :
                                getCategoryBucket(cat) === 'necessities' ? 'Vajalikud' :
                                getCategoryBucket(cat) === 'entertainment' ? 'Meelelahutus' :
                                getCategoryBucket(cat) === 'investments' ? 'Investeeringud' : 'Välistatud'
                              })
                            </span>
                          ) : isInherited ? (
                            <span className="text-[9px] text-emerald-600 font-bold tracking-tight bg-emerald-50/50 py-0.5 px-1 rounded border border-emerald-100/30">
                              Peakategooria valik ({
                                getCategoryBucket(cat) === 'unassigned' ? 'Välistatud' :
                                getCategoryBucket(cat) === 'necessities' ? 'Vajalikud' :
                                getCategoryBucket(cat) === 'entertainment' ? 'Meelelahutus' :
                                getCategoryBucket(cat) === 'investments' ? 'Investeeringud' : 'Kaasatud'
                              })
                            </span>
                          ) : (
                            <span className="text-[9px] text-blue-600 font-bold tracking-tight">Käsitsi seadistatud seos</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {savingCategoryBucketId === cat.id && (
                          <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                        )}
                        {editingBucket === 'income' ? (
                          <select
                            value={currentBucket === 'unassigned' ? 'unassigned' : 'income'}
                            onChange={async (e) => {
                              const val = e.target.value as 'income' | 'unassigned';
                              setSavingCategoryBucketId(cat.id);
                              try {
                                await dbService.updateCategory(cat.id, { savingsBucket: val });
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setSavingCategoryBucketId(null);
                              }
                            }}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
                          >
                            <option value="income">Kaasatud tulusse</option>
                            <option value="unassigned">Välistatud tulust</option>
                          </select>
                        ) : (
                          <select
                            value={currentBucket || 'unassigned'}
                            onChange={async (e) => {
                              const val = e.target.value as 'necessities' | 'entertainment' | 'investments' | 'unassigned';
                              setSavingCategoryBucketId(cat.id);
                              try {
                                await dbService.updateCategory(cat.id, { savingsBucket: val });
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setSavingCategoryBucketId(null);
                              }
                            }}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
                          >
                            <option value="necessities">Vajalikud kulutused</option>
                            <option value="entertainment">Meelelahutus</option>
                            <option value="investments">Investeeringud</option>
                            <option value="unassigned font-normal text-slate-400">Välistatud mudelist</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingBucket(null);
                }}
                className="px-4 py-1.5 bg-slate-800 text-white font-bold rounded text-[10px] uppercase tracking-wider hover:bg-slate-700 cursor-pointer transition-colors shadow-sm"
              >
                Kinnita eelistused
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

