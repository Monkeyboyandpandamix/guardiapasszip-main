
import React from 'react';
import { VisitRecord } from '../types';
import { Activity, Radio, Cpu, Terminal, ShieldCheck, RadioTower, Globe, Clock, Zap, Shield } from 'lucide-react';

interface NetworkMonitorProps {
  isSecure: boolean;
  visits: VisitRecord[];
}

const NetworkMonitor: React.FC<NetworkMonitorProps> = ({ isSecure, visits }) => {
  return (
    <div className="p-8 max-w-6xl mx-auto w-full pb-32 animate-in fade-in duration-700 relative">
      {/* Integrity Tag */}
      <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-indigo-500/5 border border-indigo-500/10 rounded-full z-10">
        <Shield className="w-3 h-3 text-indigo-500" />
        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Encrypted PostMessage Tunnel</span>
      </div>

      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <RadioTower className={`w-6 h-6 ${isSecure ? 'animate-pulse' : ''}`} />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Network <span className="text-indigo-500">Uplink</span></h1>
          </div>
          <p className="text-slate-500 text-lg ml-1 uppercase tracking-tight font-black">Live Extension Payload Terminal</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl border ${isSecure ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
             <Activity className={`w-4 h-4 ${isSecure ? 'animate-spin' : ''}`} />
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">{isSecure ? 'Bridge Secure' : 'Waiting for Handshake'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
               <Terminal className="w-5 h-5 text-indigo-400" />
               Raw Signal Trace
             </h3>
             <div className="px-3 py-1 bg-black/40 border border-white/5 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">
                {visits.length} Frames Captured
             </div>
          </div>
          
          <div className="space-y-3 font-mono">
            {visits.slice(0, 15).map((v, i) => (
              <div key={v.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl group hover:border-indigo-500/30 transition-all animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-center gap-4 overflow-hidden">
                   <div className={`w-2 h-2 rounded-full ${v.isThreat ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
                   <div className="truncate">
                      <p className={`text-[10px] font-bold ${v.isThreat ? 'text-red-400' : 'text-slate-200'}`}>
                        {v.url}
                      </p>
                      <div className="flex items-center gap-3 mt-1 opacity-40">
                        <span className="text-[8px] flex items-center gap-1 uppercase tracking-widest"><Clock className="w-2.5 h-2.5"/> {new Date(v.timestamp).toLocaleTimeString()}</span>
                        <span className="text-[8px] uppercase tracking-widest">Signal: ENCRYPTED_FRAME</span>
                      </div>
                   </div>
                </div>
                <div className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${v.isThreat ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                   {v.isThreat ? 'DROPPED' : 'PASSED'}
                </div>
              </div>
            ))}
            {visits.length === 0 && (
               <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                  <Cpu className="w-12 h-12 text-slate-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Awaiting Extension Uplink...</p>
               </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
           <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40">
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-8">Uplink Telemetry</h3>
              <div className="space-y-6">
                 {[
                   { label: 'Tunnel', val: 'PostMessage v2', ok: true },
                   { label: 'Integrity', val: 'SHA-256 Sum', ok: true },
                   { label: 'Buffer', val: 'Active', ok: true },
                   { label: 'Uplink', val: isSecure ? 'Locked' : 'Seeking', ok: isSecure }
                 ].map((stat, i) => (
                   <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{stat.label}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-tight ${stat.ok ? 'text-emerald-500' : 'text-red-500'}`}>{stat.val}</span>
                   </div>
                 ))}
              </div>
              
              <div className="mt-10 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl relative overflow-hidden group">
                 <Zap className="absolute -bottom-2 -right-2 w-16 h-16 text-indigo-500/10 group-hover:scale-110 transition-transform" />
                 <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed relative z-10">
                   This terminal monitors direct communication between the vault and the browser shield. No unencrypted data ever leaves the local environment.
                 </p>
              </div>
           </div>

           <div className="p-8 bg-black/40 rounded-[3rem] border border-white/5 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Tunnel Integrity</p>
              <div className="h-1 w-24 bg-slate-800 mx-auto rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 w-full shadow-[0_0_10px_#10b981]" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkMonitor;
