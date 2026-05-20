import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '../services/auth';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ExternalLink, HelpCircle } from 'lucide-react';

export const AuthView = () => {
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await authService.signInWithGoogle();
      toast.success('Sisselogimine õnnestus!');
    } catch (e: any) {
      console.error('Google login error:', e);
      const errCode = e.code || '';
      const errMsg = e.message || 'Tundmatu viga';
      setAuthError({ code: errCode, message: errMsg });
      toast.error('Google sisselogimine ebaõnnestus: ' + errMsg);
    } finally {
      setLoading(false);
    }
  };

  const getTroubleshootingGuide = () => {
    if (!authError) return null;

    const isConfigError = authError.code.includes('configuration-not-found') || authError.message.includes('configuration-not-found');
    const isDomainError = authError.code.includes('unauthorized-domain') || authError.message.includes('unauthorized-domain');

    if (isConfigError) {
      return (
        <div className="mt-6 bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-2.5 text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[11px] font-semibold uppercase tracking-wider">Määramata Seadistus</div>
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            Sinu Firebase projektis pole veel <strong>Google sisselogimist</strong> lubatud.
          </p>
          <div className="text-[10px] text-slate-300 space-y-2 border-t border-slate-800/45 pt-2.5">
            <p className="font-semibold text-slate-200">Kuidas seda lubada:</p>
            <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
              <li>Mine Firebase konsooli:
                <a 
                  href="https://console.firebase.google.com/project/eelarvemeister/authentication/providers" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline ml-1"
                >
                  Ava Sign-in Providers <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </li>
              <li>Vajuta nuppu <strong className="text-slate-200">Add new provider</strong> ja vali <strong className="text-slate-200">Google</strong>.</li>
              <li>Lülita sisse <strong className="text-slate-200">Enable</strong> liugur, määra oma projekti toe e-mail (näiteks <code className="bg-slate-800 px-1 rounded text-red-300 font-mono text-[9px]">{localStorage.getItem('userEmail') || 'oma meiliaadress'}</code>) ja vajuta <strong className="text-slate-200">Save</strong>.</li>
            </ol>
          </div>
        </div>
      );
    }

    if (isDomainError) {
      const currentDomain = window.location.hostname;
      return (
        <div className="mt-6 bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start gap-2.5 text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[11px] font-semibold uppercase tracking-wider">Autoriseerimata Domeen</div>
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            See vaate domeen pole Firebase'i poolt lubatud. Turvalisuse huvides blokeerib Google sisselogimise autoriseerimata domeenidelt.
          </p>
          <div className="text-[10px] text-slate-300 space-y-2 border-t border-slate-800/45 pt-2.5">
            <p className="font-semibold text-slate-200">Kuidas seda lubada:</p>
            <ol className="list-decimal pl-4 space-y-1.5 text-slate-400">
              <li>Mine Firebase seadetesse:
                <a 
                  href="https://console.firebase.google.com/project/eelarvemeister/authentication/settings" 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline ml-1"
                >
                  Ava Authentication Settings <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </li>
              <li>Vali menüüst <strong className="text-slate-200">Authorized domains</strong> (Autoriseeritud domeenid) vahekaart.</li>
              <li>Vajuta <strong className="text-slate-200">Add domain</strong> ja lisa sinna järgmised domeenid:
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-2 py-1 rounded font-mono text-[9px] text-emerald-400">
                    <span>ais-dev-ljcozx6crczn2p2rhtttwb-73344251347.europe-west1.run.app</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-2 py-1 rounded font-mono text-[9px] text-emerald-400">
                    <span>ais-pre-ljcozx6crczn2p2rhtttwb-73344251347.europe-west1.run.app</span>
                  </div>
                  {currentDomain && !currentDomain.includes('run.app') && currentDomain !== 'localhost' && (
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-2 py-1 rounded font-mono text-[9px] text-amber-400">
                      <span>{currentDomain}</span>
                    </div>
                  )}
                </div>
              </li>
              <li>Pärast domeenide salvestamist värskenda seda lehte ja proovi uuesti!</li>
            </ol>
          </div>
        </div>
      );
    }

    // Default general error info
    return (
      <div className="mt-4 bg-rose-950/40 border border-rose-900/40 rounded p-3 text-[10px] text-rose-300 leading-relaxed">
        <div className="font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Sisselogimise viga:</div>
        <p className="font-mono text-[9px] text-rose-400 mb-2">{authError.message}</p>
        <p className="text-slate-400 leading-normal">
          Veendu, et sinu Firebase konsoolis on Google sisselogimine sisse lülitatud ning eelarvemeister.firebaseapp.com ning selle eelvaate domeenid on autoriseeritud.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans">
      <Card className="w-full max-w-sm border-slate-800 bg-slate-900 shadow-2xl">
        <CardHeader className="text-center pb-8 border-b border-slate-800 mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center font-bold text-2xl text-white mx-auto mb-4 overflow-hidden shadow-lg shadow-blue-500/20 leading-none">
            €
          </div>
          <CardTitle className="text-xl font-bold text-white tracking-tight">Eelarvemeister</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-400 text-[11px] text-center leading-relaxed font-medium">
            Süsteemi sisenemiseks kasuta oma Google kontot. See tagab andmete turvalise säilitamise ja mugava ligipääsu.
          </p>
          <Button 
            className="w-full bg-white text-slate-900 hover:bg-slate-100 h-10 text-[11px] font-bold shadow-sm flex items-center justify-center gap-3 border border-slate-200"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                />
              </svg>
            )}
            {loading ? 'HETK... ' : 'SISENE GOOGLE KONTOGA'}
          </Button>

          {getTroubleshootingGuide()}
        </CardContent>
      </Card>
    </div>
  );
};
