
import React, { useState } from 'react';
import { verifyUrlSafety } from '../services/geminiService';
import { VerificationResult } from '../types';
import { 
  ShieldCheck, ShieldAlert, ShieldX, Loader2, Search, 
  ArrowRight, Lock, Cpu, Activity, Shield, Link2
} from 'lucide-react';

interface VerifierProps {
  onVisit: (url: string) => void;
}

const Verifier: React.FC<VerifierProps> = ({ onVisit }) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const riskBadge = result
    ? result.threatLevel === 'High'
      ? { tone: 'bg-red-500/20 text-red-400', label: 'MALICIOUS THREAT' }
      : result.threatLevel === 'Medium'
        ? { tone: 'bg-amber-500/20 text-amber-400', label: 'SUSPICIOUS' }
        : { tone: 'bg-emerald-500/20 text-emerald-400', label: 'VERIFIED SECURE' }
    : null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const aiResult = await verifyUrlSafety(url);
      setResult(aiResult);
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full pb-32 relative">
      {/* Integrity Tag */}
      <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-indigo-500/5 border border-indigo-500/10 rounded-full z-10">
        <Shield className="w-3 h-3 text-indigo-500" />
        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Neural Phishing Audit (SSL/TLS 1.3)</span>
      </div>

      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-4">
          <Search className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 uppercase tracking-tight">AI Neural Verifier</h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm font-medium">
          Zero-trust URL analysis engine powered by Gemini 3 with Live Search Grounding.
        </p>
      </div>

      <div className="glass-panel p-2 rounded-3xl mb-12 border-indigo-500/10 shadow-2xl">
        <form onSubmit={handleVerify} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter target URL (e.g. google.security-verify.com)"
            className="flex-1 bg-transparent py-4 px-6 focus:outline-none text-slate-100 font-medium"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !url}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-10 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Audit Endpoint <ArrowRight className="w-4 h-4"/></>}
          </button>
        </form>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs font-bold">
          {error}
        </div>
      )}

      {result && (
        <div className={`glass-panel p-10 rounded-[3rem] border-2 animate-in slide-in-from-bottom-6 duration-700 ${
          result.threatLevel === 'High' ? 'border-red-500/30 bg-red-500/5' : 
          result.threatLevel === 'Medium' ? 'border-amber-500/30 bg-amber-500/5' : 
          'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="flex flex-col items-center gap-4">
              <div className={`p-8 rounded-[2.5rem] ${
                result.threatLevel === 'High' ? 'bg-red-500/20 text-red-500' : 
                result.threatLevel === 'Medium' ? 'bg-amber-500/20 text-amber-500' : 
                'bg-emerald-500/20 text-emerald-500'
              } border border-current shadow-2xl`}>
                {result.threatLevel === 'High' ? <ShieldX className="w-16 h-16" /> : 
                 result.threatLevel === 'Medium' ? <ShieldAlert className="w-16 h-16" /> : 
                 <ShieldCheck className="w-16 h-16" />}
              </div>
              <div className="px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] bg-white/5 border border-white/10 text-white">
                {result.threatLevel} RISK PROFILE
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Neural Audit Results</h2>
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${riskBadge?.tone}`}>
                  <Activity className="w-3 h-3" />
                  {riskBadge?.label}
                </div>
              </div>
              
              <p className="text-slate-300 text-xl mb-10 leading-relaxed font-bold">{result.summary}</p>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" /> Neural Evidence Trace
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {result.details.map((detail, idx) => (
                      <div key={idx} className="flex items-start gap-4 text-xs text-slate-400 bg-black/40 p-5 rounded-2xl border border-white/5">
                        <ArrowRight className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                        <span className="font-medium">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {result.sources && result.sources.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-emerald-400" /> Verification Evidence
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {result.sources.map((source, idx) => (
                        <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-2 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-emerald-400 transition-all uppercase tracking-widest">
                          {source.title} <ArrowRight className="w-3 h-3 -rotate-45" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-12 mt-12 border-t border-white/5">
                <button onClick={() => onVisit(url)} className="flex-1 px-8 py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest">
                  Proceed to site
                </button>
                <button onClick={() => { setResult(null); setUrl(''); }} className="flex-1 px-8 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest">
                  Reset Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Verifier;
