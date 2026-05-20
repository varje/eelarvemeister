import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, Search, ArrowUp, ArrowDown, ArrowUpDown, Trash2 } from 'lucide-react';
import { parseBankCSV } from '@/lib/csvParser';
import { dbService } from '@/services/db';
import { auth } from '@/lib/firebase';
import { useFinanceData } from '@/hooks/useFinanceData';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const TransactionsView = () => {
  const { transactions, categories, rules, applyRules, refresh, loading: dataLoading } = useFinanceData();
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<'date' | 'recipient' | 'description' | 'amount' | 'category' | 'account' | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const accountsList = useMemo(() => {
    const accts: Record<string, string> = {};
    transactions.forEach(t => {
      const num = t.accountNumber || 'EE-PÕHIKONTO';
      const name = t.accountName || 'Peamine konto';
      accts[num] = name;
    });
    return Object.entries(accts).map(([number, name]) => ({ number, name }));
  }, [transactions]);

  const categoryGroups = useMemo(() => {
    // Find all parent categories (those with no parentId or empty parentId)
    const parents = categories.filter(c => !c.parentId);
    // Find subcategories key-by parent ID
    const subMap: Record<string, typeof categories> = {};
    
    categories.forEach(c => {
      if (c.parentId) {
        if (!subMap[c.parentId]) subMap[c.parentId] = [];
        subMap[c.parentId].push(c);
      }
    });
    
    return { parents, subMap };
  }, [categories]);

  const handleCategoryChange = async (transactionId: string, newCategoryId: string) => {
    setUpdatingIds(prev => ({ ...prev, [transactionId]: true }));
    try {
      await dbService.updateTransaction(transactionId, { categoryId: newCategoryId });
      toast.success('Kategooria automaatselt salvestatud');
      refresh();
    } catch (err) {
      toast.error('Kategooria salvestamine ebaõnnestus');
    } finally {
      setUpdatingIds(prev => ({ ...prev, [transactionId]: false }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const userId = auth.currentUser?.uid;
    if (!file || !userId) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsedTransactions = parseBankCSV(text, userId, file.name);
        
        // Filter out existing transactions
        const existingTransMap = new Set(transactions.map(t => 
          `${t.date}|${t.recipient}|${t.description}|${t.amount}`
        ));

        const newTransactions = parsedTransactions.filter(t => 
          !existingTransMap.has(`${t.date}|${t.recipient}|${t.description}|${t.amount}`)
        );

        if (newTransactions.length === 0) {
          toast.info('Kõik kanded on juba imporditud (duublikaate ei lisatud)');
          setUploading(false);
          return;
        }

        // Auto-categorize
        const categorized = newTransactions.map(t => ({
          ...t,
          categoryId: applyRules(t, rules)
        }));

        await dbService.addTransactions(userId, categorized.map(({ id, ...rest }) => rest));
        const skippedCount = parsedTransactions.length - newTransactions.length;
        if (skippedCount > 0) {
          toast.success(`Imporditud ${newTransactions.length} uut tehingut (jäeti vahele ${skippedCount} duublikaati)`);
        } else {
          toast.success(`Imporditud ${newTransactions.length} tehingut`);
        }
        refresh();
      } catch (err: any) {
        toast.error('Impordi viga: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = 
        t.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const accNum = t.accountNumber || 'EE-PÕHIKONTO';
      if (selectedAccount !== 'all' && accNum !== selectedAccount) {
        return false;
      }
      return true;
    });
  }, [transactions, searchTerm, selectedAccount]);

  const sortedTransactions = useMemo(() => {
    if (!sortField) return filteredTransactions;

    return [...filteredTransactions].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sortField === 'date') {
        valA = a.date;
        valB = b.date;
      } else if (sortField === 'recipient') {
        valA = a.recipient.toLowerCase();
        valB = b.recipient.toLowerCase();
      } else if (sortField === 'description') {
        valA = (a.description || '').toLowerCase();
        valB = (b.description || '').toLowerCase();
      } else if (sortField === 'amount') {
        valA = a.amount;
        valB = b.amount;
      } else if (sortField === 'category') {
        const catA = categories.find(c => c.id === a.categoryId);
        const catB = categories.find(c => c.id === b.categoryId);
        valA = catA ? catA.name.toLowerCase() : 'zzzz';
        valB = catB ? catB.name.toLowerCase() : 'zzzz';
      } else if (sortField === 'account') {
        valA = (a.accountName || 'Peamine konto').toLowerCase();
        valB = (b.accountName || 'Peamine konto').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, sortField, sortDirection, categories]);

  const handleSort = (field: 'date' | 'recipient' | 'description' | 'amount' | 'category' | 'account') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const selectedAccountDetails = useMemo(() => {
    return accountsList.find(a => a.number === selectedAccount);
  }, [accountsList, selectedAccount]);

  const handleDeleteAccount = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId || selectedAccount === 'all') return;

    setDeleting(true);
    try {
      await dbService.deleteTransactionsByAccount(userId, selectedAccount);
      toast.success('Konto ja kõik selle tehingud on edukalt kustutatud');
      setSelectedAccount('all');
      setShowDeleteConfirm(false);
    } catch (err: any) {
      toast.error('Kustutamine ebaõnnestus: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold tracking-tight">Toorandmed</h2>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <Input 
                placeholder="Otsi tehinguid..." 
                className="pl-7 h-8 w-48 text-[10px] bg-slate-50 border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
              <select
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  setShowDeleteConfirm(false);
                }}
                className="h-8 text-[10px] bg-slate-50 border border-slate-200 rounded px-2 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm max-w-[200px]"
              >
                <option value="all">Kõik kontod ({accountsList.length})</option>
                {accountsList.map(a => (
                  <option key={a.number} value={a.number}>
                    {a.name}
                  </option>
                ))}
              </select>
              {selectedAccount !== 'all' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 border-slate-200 hover:border-rose-100 transition-all shadow-sm shrink-0"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Kustuta see konto ja kõik selle tehingud"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            id="csv-upload"
            className="hidden"
            accept=".csv"
            onChange={handleFileUpload}
          />
          <Button 
            size="sm"
            variant="outline"
            className="h-8 text-[10px] border-slate-200"
            onClick={() => document.getElementById('csv-upload')?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Upload className="w-3 h-3 mr-2" />}
            Laadi CSV (LHV, SEB...)
          </Button>
        </div>
      </header>

      {/* Main Data Container */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="bg-white border border-slate-200 rounded shadow-sm h-full flex flex-col">
          <div className="overflow-auto flex-1">
            {dataLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr className="border-b border-slate-200">
                    <th 
                      onClick={() => handleSort('date')}
                      className={cn(
                        "px-4 py-2.5 font-bold text-slate-500 border-r w-24 cursor-pointer hover:bg-slate-100 select-none transition-colors",
                        sortField === 'date' && "bg-slate-100/50 text-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Kuupäev</span>
                        <span className="shrink-0">
                          {sortField === 'date' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('account')}
                      className={cn(
                        "px-4 py-2.5 font-bold text-slate-500 border-r w-44 cursor-pointer hover:bg-slate-100 select-none transition-colors",
                        sortField === 'account' && "bg-slate-100/50 text-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Konto</span>
                        <span className="shrink-0">
                          {sortField === 'account' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('recipient')}
                      className={cn(
                        "px-4 py-2.5 font-bold text-slate-500 border-r cursor-pointer hover:bg-slate-100 select-none transition-colors",
                        sortField === 'recipient' && "bg-slate-100/50 text-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Saaja / Maksja</span>
                        <span className="shrink-0">
                          {sortField === 'recipient' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('description')}
                      className={cn(
                        "px-4 py-2.5 font-bold text-slate-500 border-r cursor-pointer hover:bg-slate-100 select-none transition-colors",
                        sortField === 'description' && "bg-slate-100/50 text-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Selgitus</span>
                        <span className="shrink-0">
                          {sortField === 'description' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('amount')}
                      className={cn(
                        "px-4 py-2.5 font-bold text-slate-500 border-r w-32 cursor-pointer hover:bg-slate-100 select-none text-right transition-colors",
                        sortField === 'amount' && "bg-slate-100/50 text-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        <span>Summa</span>
                        <span className="shrink-0">
                          {sortField === 'amount' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('category')}
                      className={cn(
                        "px-4 py-2.5 font-bold text-slate-500 w-48 cursor-pointer hover:bg-slate-100 select-none transition-colors",
                        sortField === 'category' && "bg-slate-100/50 text-blue-700"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span>Kategooria</span>
                        <span className="shrink-0">
                          {sortField === 'category' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-300" />
                          )}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                        Tehinguid ei leitud.
                      </td>
                    </tr>
                  ) : (
                    sortedTransactions.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-1.5 text-slate-500 font-mono text-[10px] border-r">{t.date}</td>
                        <td className="px-4 py-1.5 border-r text-slate-600 text-[10px] font-medium truncate max-w-[170px]">
                          <div className="flex flex-col leading-tight">
                            <span className="font-bold text-slate-700 truncate">{t.accountName || 'Peamine konto'}</span>
                            <span className="text-[9px] text-slate-400 font-mono truncate">{t.accountNumber || 'EE-PÕHIKONTO'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-1.5 border-r font-medium text-slate-700">{t.recipient}</td>
                        <td className="px-4 py-1.5 border-r text-slate-400 text-[10px] truncate max-w-xs">{t.description}</td>
                        <td className={cn(
                          "px-4 py-1.5 text-right font-mono border-r font-bold",
                          t.amount < 0 ? "text-rose-600" : "text-emerald-600"
                        )}>
                          {t.amount.toFixed(2)} €
                        </td>
                        <td className="px-4 py-1 flex items-center gap-2">
                          <select
                            value={t.categoryId || ''}
                            onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                            disabled={updatingIds[t.id]}
                            className={cn(
                              "text-[11px] bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] w-full cursor-pointer transition-colors shadow-sm",
                              t.categoryId 
                                ? "text-blue-700 bg-blue-50/50 border-blue-100 font-semibold" 
                                : "text-slate-500 italic"
                            )}
                          >
                            <option value="">Kategoriseerimata</option>
                            {categoryGroups.parents.map(parent => {
                              const subs = categoryGroups.subMap[parent.id] || [];
                              if (subs.length === 0) {
                                return (
                                  <option key={parent.id} value={parent.id} className="text-slate-800 font-medium">
                                    {parent.name}
                                  </option>
                                );
                              }
                              return (
                                <optgroup key={parent.id} label={parent.name} className="text-slate-500 font-bold">
                                  {subs.map(sub => (
                                    <option key={sub.id} value={sub.id} className="text-slate-800 font-medium">
                                      {sub.name}
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                          </select>
                          {updatingIds[t.id] && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="bg-slate-50 border-t border-slate-200 p-2 px-4 flex justify-between items-center text-[9px] text-slate-500 shrink-0">
             <span>Näidatakse {filteredTransactions.length} tehingut {transactions.length}-st</span>
             <div className="flex gap-4">
                <span>Leitud vigu: 0</span>
                <span>Kategoriseeritud: {Math.round((transactions.filter(t => t.categoryId).length / transactions.length) * 100 || 0)}%</span>
             </div>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && selectedAccountDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-md p-6 m-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              Konto kustutamine
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Kas oled kindel, et soovid kustutada konto <strong className="text-slate-700">{selectedAccountDetails.name}</strong> (<span className="font-mono text-[10px] text-slate-600 font-semibold">{selectedAccountDetails.number}</span>) ja kõik sellega seotud tehingud?
            </p>
            <div className="bg-rose-50 border border-rose-100/50 rounded p-3 mb-6 text-[10px] text-rose-700 font-medium">
              Hoiatus: See toiming on tagasipöördumatu ning kustutab püsivalt kõik selle konto kanded.
            </div>
            <div className="flex justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-[11px] border-slate-200"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Loobu
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-[11px] bg-rose-600 hover:bg-rose-700 transition-colors"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                    Kustutatakse...
                  </>
                ) : (
                  'Kustuta püsivalt'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

