import React, { useState } from 'react';
import { checkEmailBreach, checkUsernameBreach, checkPasswordBreach, BreachResult, PasswordBreachResult } from '../services/breachService';
import { 
  ShieldAlert, ShieldCheck, Search, Loader2, AlertTriangle, 
  Mail, User, Key, Eye, EyeOff, Shield, Skull, CheckCircle2, XCircle
} from 'lucide-react';

const BreachScanner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'username' | 'password'>('email');
  const [input, setInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailResult, setEmailResult] = useState<BreachResult | null>(null);
  const [usernameResult, setUsernameResult] = useState<BreachResult | null>(null);
  const [passwordResult, setPasswordResult] = useState<PasswordBreachResult | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    setLoading(true);
    setEmailResult(null);
    setUsernameResult(null);
    setPasswordResult(null);

    try {
      if (activeTab === 'email') {
        const email = input.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          throw new Error('Please enter a valid email address.');
        }
        const result = await checkEmailBreach(email);
        setEmailResult(result);
      } else if (activeTab === 'username') {
        const username = input.trim();
        if (!/^[a-zA-Z0-9._@-]{3,50}$/.test(username)) {
          throw new Error('Username must be 3-50 chars and can include letters, numbers, ".", "_", "-", "@".');
        }
        const result = await checkUsernameBreach(username);
        setUsernameResult(result);
      } else {
        const password = input;
        if (password.length < 1) {
          throw new Error('Please enter a password.');
        }
        const result = await checkPasswordBreach(password);
        setPasswordResult(result);
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err?.message || 'Scan failed. Please try again.');
    }
    setLoading(false);
  };

  const currentResult = activeTab === 'email' ? emailResult : activeTab === 'username' ? usernameResult : null;

  return (
    <div className="p-8 max-w-4xl mx-auto w-full pb-32 relative">
      <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-red-500/5 border border-red-500/10 rounded-full z-10">
        <Skull className="w-3 h-3 text-red-500" />
        <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Dark Web Intelligence Engine</span>
      </div>

      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-2xl border border-red-500/20 mb-4">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">Breach Scanner</h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm font-medium">
          Check if your email, username, or password has been exposed in known data breaches and dark web leaks.
        </p>
      </div>

      <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5 mb-8 max-w-md mx-auto">
        {[
          { id: 'email' as const, label: 'Email', icon: Mail },
          { id: 'username' as const, label: 'Username', icon: User },
          { id: 'password' as const, label: 'Password', icon: Key },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setInput(''); setEmailResult(null); setUsernameResult(null); setPasswordResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass-panel p-2 rounded-3xl mb-8 border-red-500/10 shadow-2xl">
        <form onSubmit={handleScan} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={activeTab === 'password' && !showPassword ? 'password' : 'text'}
              placeholder={
                activeTab === 'email' ? 'Enter email address to scan...' :
                activeTab === 'username' ? 'Enter username to scan...' :
                'Enter password to check...'
              }
              className="w-full bg-transparent py-4 px-6 focus:outline-none text-slate-100 font-medium pr-12"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {activeTab === 'password' && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-10 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Scan <Search className="w-4 h-4" /></>}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-bold">
          {error}
        </div>
      )}

      {activeTab === 'password' && (
        <div className="glass-panel p-4 rounded-2xl mb-8 border-amber-500/10 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-300 font-bold leading-relaxed">
              Your password is checked securely using k-Anonymity. Only a partial hash is sent to the server - your actual password never leaves your device.
            </p>
          </div>
        </div>
      )}

      {passwordResult && (
        <div className={`glass-panel p-10 rounded-[3rem] border-2 animate-in slide-in-from-bottom-6 duration-700 ${
          passwordResult.found ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <div className="flex flex-col items-center text-center gap-6">
            <div className={`p-8 rounded-[2.5rem] ${
              passwordResult.found ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
            } border border-current shadow-2xl`}>
              {passwordResult.found ? <XCircle className="w-16 h-16" /> : <CheckCircle2 className="w-16 h-16" />}
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                {passwordResult.found ? 'PASSWORD COMPROMISED' : 'PASSWORD SECURE'}
              </h2>
              <p className="text-slate-300 text-lg font-bold max-w-md">
                {passwordResult.found 
                  ? `This password has been found in ${passwordResult.count.toLocaleString()} data breaches. You should change it immediately wherever it's used.`
                  : 'This password has not been found in any known data breaches. However, always use unique passwords for each account.'
                }
              </p>
            </div>
            {passwordResult.found && (
              <div className="mt-4 p-6 bg-red-500/10 border border-red-500/20 rounded-2xl w-full">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Exposure Count</span>
                </div>
                <p className="text-4xl font-black text-red-400">{passwordResult.count.toLocaleString()}</p>
                <p className="text-[10px] text-red-300 mt-1 uppercase tracking-wider font-bold">times found in breach databases</p>
              </div>
            )}
          </div>
        </div>
      )}

      {currentResult && (
        <div className={`glass-panel p-10 rounded-[3rem] border-2 animate-in slide-in-from-bottom-6 duration-700 ${
          currentResult.found ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="flex flex-col items-center gap-4">
              <div className={`p-8 rounded-[2.5rem] ${
                currentResult.found ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'
              } border border-current shadow-2xl`}>
                {currentResult.found ? <ShieldAlert className="w-16 h-16" /> : <ShieldCheck className="w-16 h-16" />}
              </div>
              <div className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] ${
                currentResult.found ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {currentResult.found ? `${currentResult.count} BREACHES` : 'NO BREACHES'}
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                {currentResult.found ? 'EXPOSURE DETECTED' : 'ALL CLEAR'}
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed font-bold">{currentResult.summary}</p>

              {currentResult.breaches && currentResult.breaches.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Known Breaches
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {currentResult.breaches.map((breach, idx) => (
                      <div key={idx} className="p-5 bg-black/40 rounded-2xl border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-white uppercase">{breach.name}</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{breach.date}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium leading-relaxed">{breach.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreachScanner;
