/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { SettingsView } from './views/SettingsView';
import { ChartsView } from './views/ChartsView';
import { TransactionsView } from './views/TransactionsView';
import { AuthView } from './views/AuthView';
import { LayoutDashboard, Receipt, BarChart3, Settings, LogOut, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { cn } from './lib/utils';
import { Toaster } from './components/ui/sonner';
import { authService } from './services/auth';
import { dbService } from './services/db';
import { DEFAULT_CATEGORIES } from './constants';
import { toast } from 'sonner';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './lib/firebase';

type ViewType = 'home' | 'transactions' | 'charts' | 'settings';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ViewType>('home');
  const [firestoreError, setFirestoreError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (firebaseUser) => {
      try {
        setFirestoreError(null);
        if (firebaseUser) {
          const profile = await authService.getUserProfile(firebaseUser.uid);
          
          if (!profile) {
            // Create fallback profile if it somehow doesn't exist
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              username: firebaseUser.email?.split('@')[0] || 'Kasutaja',
              createdAt: serverTimestamp()
            });
          }
          
          setUser({ ...firebaseUser, ...profile });
          
          // Ensure default categories exist in parallel
          const cats = await dbService.getCategories(firebaseUser.uid);
          if (cats.length === 0) {
            console.log('Populating default categories...');
            await Promise.all(DEFAULT_CATEGORIES.map(cat => 
              dbService.addCategory(firebaseUser.uid, {
                name: cat.name,
                type: cat.type as any,
                isStarred: cat.isStarred,
                parentId: null
              })
            ));
          }
        } else {
          setUser(null);
        }
      } catch (err: any) {
        console.error('Auth sync error:', err);
        setFirestoreError({
          message: err.message || String(err),
          code: err.code
        });
        toast.error('Andmete laadimine ebaõnnestus.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success('Välja logitud');
    } catch (e) {
      toast.error('Väljalogimine ebaõnnestus');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (firestoreError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
        <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-6 bg-slate-900 border-b border-slate-800 flex items-start gap-3.5 text-amber-400">
            <AlertCircle className="w-6 h-6 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <h2 className="font-bold text-sm tracking-tight text-slate-100">Käivitamise viga: Firestore andmebaas pole kättesaadav</h2>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Google kontoga sisselogimine õnnestus, kuid süsteem ei suuda luua pilveandmebaasiga ühendust. Kõige sagedamini on põhjuseks puuduv või aktiveerimata Firestore andmebaas sinu Firebase projektis.
              </p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-[10px] font-mono text-amber-300 leading-relaxed overflow-x-auto">
              <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mr-1">Vea teade:</span> {firestoreError.message}
            </div>

            {/* QUICK LOCAL PERSISTENCE ACTION */}
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-lg p-4 space-y-2.5">
              <h4 className="font-bold text-[11px] text-amber-300 uppercase tracking-wider">Soovid kohe alustada ilma seadistuseta?</h4>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Saad rakenduse lülitada kohalikule andmesalvestusele (LocalStorage). Kõik andmed jäävad turvaliselt sinu brauserisse ja sisselogimise piiranguid ei rakendata. Seda valikut saab igal ajal seadetest muuta.
              </p>
              <button
                onClick={() => {
                  localStorage.setItem('eelarvemeister_use_local_db', 'true');
                  window.location.reload();
                }}
                className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold py-2 px-3 rounded text-[11px] tracking-wide transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                Käivita kohalikus režiimis (Demo / Brauseri salvestus)
              </button>
            </div>

            <div className="space-y-2.5 pt-2">
              <h3 className="font-bold text-slate-300 text-[10px] uppercase tracking-widest">Kuidas pilvesünkroniseerimine aktiveerida:</h3>
              <ol className="list-decimal pl-4 text-slate-400 text-[10.5px] space-y-2">
                <li>
                  Ava oma veebibrauseris Firebase konsooli Firestore jaotis:
                  <a 
                    href="https://console.firebase.google.com/project/eelarvemeister/firestore" 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline font-semibold ml-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-[9.5px]"
                  >
                    Ava Firestore konsool <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  Klikka nupule <strong className="text-slate-200">"Create database"</strong>.
                </li>
                <li>
                  Vali režiimiks <strong className="text-slate-200">"Start in test mode"</strong> ja klõpsa järeltulijatel "Create / Enable".
                </li>
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-800 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded text-[11px] tracking-wide transition-colors flex items-center justify-center gap-1.5 shadow-sm font-sans cursor-pointer"
              >
                Värskenda lehte ja proovi uuesti
              </button>
              <button
                onClick={handleLogout}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold py-2 px-4 rounded text-[11px] tracking-wide transition-colors flex items-center justify-center gap-1 border border-slate-800 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Välju
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthView />
        <Toaster />
      </>
    );
  }

  const NavItem = ({ view, icon: Icon, label }: { view: ViewType, icon: any, label: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={cn(
        "flex items-center gap-3 px-6 py-2 transition-colors w-full text-left font-medium",
        activeView === view 
          ? "bg-blue-600 text-white" 
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col border-r border-slate-800 shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-lg">€</div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-none text-white">Eelarvemeister</h1>
            <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Rahakott.ee</p>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-0.5">
          <NavItem view="home" icon={LayoutDashboard} label="Esileht" />
          <NavItem view="transactions" icon={Receipt} label="Tehingud" />
          <NavItem view="charts" icon={BarChart3} label="Graafikud" />
          <NavItem view="settings" icon={Settings} label="Seaded" />
        </nav>

        <div className="border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-6 h-6 rounded bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
              {user?.username?.[0]?.toUpperCase() || 'K'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[10px] font-semibold truncate text-slate-300">{user?.username || 'Kasutaja'}</p>
              <p className="text-[9px] text-slate-500 truncate">Võrgus</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-6 py-2 text-[10px] text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-none w-full transition-colors border-t border-slate-800"
          >
            <LogOut className="w-3 h-3" />
            <span>Välju süsteemist</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {activeView === 'home' && <HomeView />}
          {activeView === 'transactions' && <TransactionsView />}
          {activeView === 'charts' && <ChartsView />}
          {activeView === 'settings' && <SettingsView />}
        </div>
      </main>

      <Toaster />
    </div>
  );
}

