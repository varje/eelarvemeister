import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useFinanceData } from '@/hooks/useFinanceData';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const ChartsView = () => {
  const { transactions, categories, loading } = useFinanceData();

  const pieData = useMemo(() => {
    const expenseCategories = categories.filter(c => c.type === 'expense' && !c.isStarred);
    return expenseCategories.map(cat => {
      const total = Math.abs(transactions
        .filter(t => t.categoryId === cat.id && t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0));
      return { name: cat.name, value: total };
    }).filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [transactions, categories]);

  const barData = useMemo(() => {
    const months = Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort();
    return months.map(month => {
      const monthTrans = transactions.filter(t => {
        if (!t.date.startsWith(month)) return false;
        const cat = categories.find(c => c.id === t.categoryId);
        return !cat?.isStarred;
      });
      const income = monthTrans.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const expense = Math.abs(monthTrans.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0));
      return { name: month, tulu: income, kulu: expense };
    });
  }, [transactions, categories]);

  const savingsModel = useMemo(() => {
    const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    if (totalIncome <= 0) return null;

    const entertainmentKeywords = ['meelelahutus', 'resto', 'kino', 'teater', 'reisimine', 'hobi', 'kohvik', 'vaba aeg', 'vabaaeg', 'väljas söömine'];
    const investmentKeywords = ['investeering', 'sääst', 'aktsia', 'fond', 'pension', 'indeks', 'hoiuse', 'hoiustamine'];

    let necessitiesTotal = 0;
    let entertainmentTotal = 0;
    let investmentsTotal = 0;

    transactions.forEach(t => {
      if (t.amount >= 0) return;
      const absAmount = Math.abs(t.amount);
      const cat = categories.find(c => c.id === t.categoryId);
      if (!cat || cat.isStarred) return;

      const name = cat.name.toLowerCase();
      if (entertainmentKeywords.some(k => name.includes(k))) {
        entertainmentTotal += absAmount;
      } else if (investmentKeywords.some(k => name.includes(k))) {
        investmentsTotal += absAmount;
      } else {
        necessitiesTotal += absAmount;
      }
    });

    // In a 50/30/20 model, "Investments" often includes the remaining balance (unspent income)
    const unspent = totalIncome - (necessitiesTotal + entertainmentTotal + investmentsTotal);
    if (unspent > 0) {
      investmentsTotal += unspent;
    }

    return [
      { 
        name: 'Vajalikud kulutused', 
        recommended: 'kuni 50%', 
        actual: (necessitiesTotal / totalIncome) * 100,
        status: (necessitiesTotal / totalIncome) <= 0.5 ? 'ok' : 'warn'
      },
      { 
        name: 'Meelelahutus', 
        recommended: 'kuni 20%', 
        actual: (entertainmentTotal / totalIncome) * 100,
        status: (entertainmentTotal / totalIncome) <= 0.2 ? 'ok' : 'warn'
      },
      { 
        name: 'Investeeringud', 
        recommended: 'vähemalt 30%', 
        actual: (investmentsTotal / totalIncome) * 100,
        status: (investmentsTotal / totalIncome) >= 0.3 ? 'ok' : 'warn'
      }
    ];
  }, [transactions, categories]);

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
              <div className="bg-white p-6 rounded border border-slate-200 shadow-sm min-h-[400px]">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-50 pb-2">Suurimad kulud kategooriate kaupa</h2>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ fontSize: '10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                        formatter={(value: number) => [`${value.toFixed(2)} €`, 'Summa']} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
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
                <div className="p-6 border-b border-slate-50">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Säästumudel (50/20/30)</h2>
                  <p className="text-[10px] text-slate-500 font-medium italic">Standardmudel tulujaotuse hindamiseks ( Kogutulu = 100% )</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kategooria</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Soovituslik %</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Tegelik %</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Olek</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {savingsModel.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-[11px] font-bold text-slate-700">{item.name}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              {item.recommended}
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
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

