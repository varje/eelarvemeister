import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Loader2, Search } from 'lucide-react';
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const userId = auth.currentUser?.uid;
    if (!file || !userId) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsedTransactions = parseBankCSV(text, userId);
        
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

  const filteredTransactions = transactions.filter(t => 
    t.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <thead className="sticky top-0 bg-slate-50 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 font-bold text-slate-500 border-r w-32">Kuupäev</th>
                    <th className="px-4 py-2 font-bold text-slate-500 border-r">Saaja / Maksja</th>
                    <th className="px-4 py-2 font-bold text-slate-500 border-r">Selgitus</th>
                    <th className="px-4 py-2 font-bold text-slate-500 text-right border-r w-32">Summa</th>
                    <th className="px-4 py-2 font-bold text-slate-500 w-48">Kategooria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 italic">
                        Tehinguid ei leitud.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-1.5 text-slate-500 font-mono text-[10px] border-r">{t.date}</td>
                        <td className="px-4 py-1.5 border-r font-medium text-slate-700">{t.recipient}</td>
                        <td className="px-4 py-1.5 border-r text-slate-400 text-[10px] truncate max-w-xs">{t.description}</td>
                        <td className={cn(
                          "px-4 py-1.5 text-right font-mono border-r font-bold",
                          t.amount < 0 ? "text-rose-600" : "text-emerald-600"
                        )}>
                          {t.amount.toFixed(2)} €
                        </td>
                        <td className="px-4 py-1.5">
                          {(() => {
                            const cat = categories.find(c => c.id === t.categoryId);
                            if (!cat) return <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-500">PUUDUB</span>;
                            const parent = cat.parentId ? categories.find(c => c.id === cat.parentId) : null;
                            return (
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                                "bg-blue-50 text-blue-700"
                              )}>
                                {parent ? `${parent.name} > ` : ''}{cat.name}
                              </span>
                            );
                          })()}
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
    </div>
  );
};

