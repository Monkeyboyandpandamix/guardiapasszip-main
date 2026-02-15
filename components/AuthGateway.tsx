
import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, Lock, Cpu, Globe, Zap, Loader2, ArrowRight } from 'lucide-react';
import { requestBiometricAuth, verifyMasterPassword, isBiometricAvailable } from '../services/cryptoService';

interface AuthGatewayProps {
  onUnlock: (email: string) => void;
}

const AuthGateway: React.FC<AuthGatewayProps> = ({ onUnlock }) => {
  const [method, setMethod] = useState<'selection' | 'password'>('selection');
  const [password, setPassword] = useState('');
  const [isDeriving, setIsDeriving] = useState(false);
  const [derivationProgress, setDerivationProgress] = useState(0);
  const [status, setStatus] = useState('System Idle');
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const available = await isBiometricAvailable();
        setBiometricAvailable(available);
      } catch {
        setBiometricAvailable(false);
      }
    })();
  }, []);

  const handleBiometric = async () => {
    if (!biometricAvailable) {
      setError('Biometric authentication is not available on this device');
      return;
    }
    setStatus('Requesting Hardware Handshake...');
    setError('');
    try {
      const success = await requestBiometricAuth();
      if (success) {
        setStatus('Identity Verified via Secure Enclave');
        setTimeout(() => onUnlock('user@example.com'), 800);
      } else {
        setError('Biometric verification failed. Try vault passkey instead.');
        setStatus('System Idle');
      }
    } catch {
      setError('Biometric hardware not responding. Try vault passkey.');
      setStatus('System Idle');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeriving(true);
    setStatus('Deriving Master Key (PBKDF2-SHA256)...');
    
    for (let i = 0; i <= 100; i += 5) {
      setDerivationProgress(i);
      await new Promise(r => setTimeout(r, 40));
    }

    const success = await verifyMasterPassword(password);
    if (success) {
      setStatus('Vault Decrypted');
      setTimeout(() => onUnlock('user@example.com'), 500);
    } else {
      setError('Invalid cryptographic key');
      setIsDeriving(false);
      setDerivationProgress(0);
      setStatus('System Idle');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020617] flex items-center justify-center p-6 z-[1000]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-lg animate-in fade-in zoom-in duration-700">
        <div className="glass-panel p-10 rounded-[3.5rem] border-emerald-500/20 shadow-[0_0_80px_rgba(0,0,0,0.6)] relative overflow-hidden bg-slate-950/90">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
          
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl mx-auto mb-6 flex items-center justify-center text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
              <Shield className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic">GUARDIAPASS</h1>
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/80">
              <Cpu className="w-3 h-3" /> Encrypted Session v4.2
            </div>
          </div>

          {method === 'selection' ? (
            <div className="space-y-4">
              <button 
                onClick={handleBiometric}
                className="w-full group relative overflow-hidden bg-emerald-700 hover:bg-emerald-600 text-white p-6 rounded-[2rem] transition-all flex items-center gap-4 shadow-xl shadow-emerald-500/20 active:scale-95"
              >
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Fingerprint className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-black text-lg uppercase tracking-tight">Biometric Unlock</p>
                  <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest opacity-70">
                    {biometricAvailable ? 'Hardware Auth Session' : 'Not Available on This Device'}
                  </p>
                </div>
                <ArrowRight className="ml-auto w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />
              </button>

              <button 
                onClick={() => setMethod('password')}
                className="w-full group bg-slate-900/80 hover:bg-slate-900 border border-emerald-900/30 p-6 rounded-[2rem] transition-all flex items-center gap-4 active:scale-95"
              >
                <div className="w-12 h-12 bg-emerald-950/50 rounded-2xl flex items-center justify-center text-emerald-500/60 group-hover:text-emerald-400 transition-colors">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-black text-lg text-white uppercase tracking-tight">Vault Passkey</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">PBKDF2-SHA256 Multi-Iter</p>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black text-emerald-500/50 uppercase tracking-widest">Master Identity Key</label>
                  <button type="button" onClick={() => setMethod('selection')} className="text-[10px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest transition-colors">Switch Method</button>
                </div>
                <input 
                  type="password"
                  autoFocus
                  disabled={isDeriving}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-emerald-900/50 p-6 rounded-[2rem] text-center text-2xl font-mono focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all disabled:opacity-50 text-emerald-400 placeholder:text-emerald-950"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {isDeriving ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-emerald-400 animate-pulse uppercase tracking-widest">{status}</span>
                    <span className="text-[10px] font-mono text-emerald-600">{derivationProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-emerald-950/30">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-600 to-cyan-500 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      style={{ width: `${derivationProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button 
                  type="submit"
                  disabled={!password}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white py-6 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-700/30 active:scale-95"
                >
                  Verify Master Key
                </button>
              )}
            </form>
          )}

          {error && (
            <div className="mt-8 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <Zap className="w-4 h-4 text-red-400" />
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">{error}</p>
            </div>
          )}

          <div className="mt-12 flex items-center justify-between pt-8 border-t border-emerald-900/20">
             <div className="flex items-center gap-2">
                <Globe className="w-3 h-3 text-emerald-800" />
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Neural Encryption Active</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Enclave Linked</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthGateway;
