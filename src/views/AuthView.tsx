import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '../services/auth';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const AuthView = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await authService.signInWithGoogle();
      toast.success('Sisselogimine õnnestus!');
    } catch (e: any) {
      console.error('Google login error:', e);
      toast.error('Google sisselogimine ebaõnnestus: ' + (e.message || 'Tundmatu viga'));
    } finally {
      setLoading(false);
    }
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
          <p className="text-slate-400 text-[11px] text-center leading-relaxed">
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
        </CardContent>

      </Card>
    </div>
  );
};
