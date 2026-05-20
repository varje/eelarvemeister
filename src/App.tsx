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
import { LayoutDashboard, Receipt, BarChart3, Settings, LogOut, Loader2 } from 'lucide-react';
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

  useEffect(() => {
    const unsubscribe = authService.onAuthChange(async (firebaseUser) => {
      try {
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
      } catch (err) {
        console.error('Auth sync error:', err);
        toast.error('Andmete laadimine ebaõnnestus. Palun proovi uuesti.');
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

