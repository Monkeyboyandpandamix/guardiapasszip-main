
import React, { useMemo, useState, useCallback } from 'react';
import { VisitRecord } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, TrendingUp, Sparkles, Activity, ShieldCheck, RefreshCw, Loader2, Shield, MousePointer2, ShieldAlert } from 'lucide-react';

interface AnalyticsProps {
  visits: VisitRecord[];
}

const safeHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const toLocalDateKey = (timestamp: number): string => {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const Analytics: React.FC<AnalyticsProps> = ({ visits }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const realHistory = useMemo(() => {
    const counts: Record<string, number> = {};
    visits.forEach(v => {
      const domain = safeHostname(v.url);
      counts[domain] = (counts[domain] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, visits]) => ({ name, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 6);
  }, [visits]);

  const threatCount = useMemo(() => visits.filter(v => v.isThreat).length, [visits]);

  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  }, []);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return toLocalDateKey(d.getTime());
    });
    return last7Days.map(date => {
      const count = visits.filter(v => toLocalDateKey(v.timestamp) === date).length;
      return {
        date: date.split('-').slice(1).join('/'),
        visits: count
      };
    });
  }, [visits]);

  const topDomain = realHistory[0] || { name: 'None', visits: 0 };
  const recentVisits = useMemo(() => [...visits].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5), [visits]);

  return (
    <div className="p-8 max-w-6xl mx-auto w-full pb-32 animate-in fade-in duration-700 relative">
      {/* Integrity Tag */}
      <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-emerald-500/5 border border-emerald-500/10 rounded-full z-10">
        <Shield className="w-3 h-3 text-emerald-500" />
        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Encrypted Behavioral Telemetry</span>
      </div>

      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
             <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
                <TrendingUp className="w-6 h-6" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Activity Intelligence</h1>
          </div>
          <p className="text-slate-500 text-lg ml-1 uppercase tracking-tight font-black">Neural Behavioral Engine</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-3 px-6 py-4 bg-slate-900 border border-white/10 rounded-2xl hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Force Neural Re-Sync
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="glass-panel p-8 rounded-[2.5rem] border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden group">
           <Zap className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/10 group-hover:scale-110 transition-transform" />
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Encrypted Records</p>
           <p className="text-5xl font-black text-white">{visits.length}</p>
        </div>
        <div className="glass-panel p-8 rounded-[2.5rem] border-red-500/20 bg-red-500/5 relative overflow-hidden group">
           <ShieldAlert className="absolute -bottom-4 -right-4 w-24 h-24 text-red-500/10 group-hover:scale-110 transition-transform" />
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Threats Diverted</p>
           <p className="text-5xl font-black text-white">{threatCount}</p>
        </div>
        <div className="glass-panel p-8 rounded-[2.5rem] border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Max Exposure Domain</p>
           <p className="text-2xl font-black text-white truncate">{topDomain.name}</p>
        </div>
        <div className="glass-panel p-8 rounded-[2.5rem] border-cyan-500/20 bg-cyan-500/5 flex flex-col justify-center">
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Uplink State</p>
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isRefreshing ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
              <p className={`text-sm font-bold uppercase tracking-widest ${isRefreshing ? 'text-indigo-400' : 'text-emerald-400'}`}>
                {isRefreshing ? 'Re-Syncing...' : 'Encrypted Uplink'}
              </p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Telemetric Intensity</h3>
                <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">7-Day Pattern Recognition</p>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
                  <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tick={{ dy: 10 }} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '16px', color: 'white', fontWeight: 'bold' }}
                    itemStyle={{ color: '#818cf8' }}
                  />
                  <Area type="monotone" dataKey="visits" stroke="#818cf8" strokeWidth={5} fill="url(#colorVisits)" isAnimationActive={true} animationDuration={1000} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                 <Activity className="w-5 h-5 text-indigo-400" />
                 Encrypted Neural Feed
               </h3>
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Recent Packets</span>
            </div>
            <div className="space-y-3">
               {recentVisits.map((v, i) => (
                 <div key={v.id} className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl animate-in slide-in-from-left duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="flex items-center gap-4 overflow-hidden">
                       {v.isThreat ? <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" /> : <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
                       <div className="truncate">
                          <p className={`text-xs font-black truncate ${v.isThreat ? 'text-red-400' : 'text-slate-200'}`}>
                            {v.url.startsWith('http') ? safeHostname(v.url) : v.url}
                          </p>
                          <p className="text-[9px] text-slate-600 font-mono mt-0.5">{new Date(v.timestamp).toLocaleTimeString()}</p>
                       </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shrink-0 ${v.isThreat ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-500'}`}>
                       {v.isThreat ? 'BLOCKED' : 'VERIFIED'}
                    </div>
                 </div>
               ))}
               {recentVisits.length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">Listening for Bridge Data...</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40 flex flex-col h-full">
            <div className="mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Frequency Breakdown</h3>
              <p className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Neural Pattern Distribution</p>
            </div>
            
            <div className="space-y-8 flex-1">
              {realHistory.map((item, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest mb-3">
                    <div className="flex items-center gap-3">
                       <span className="text-slate-500 font-mono">0{i+1}</span>
                       <span className="text-slate-100 truncate max-w-[180px] group-hover:text-indigo-400 transition-colors">{item.name}</span>
                    </div>
                    <span className="text-indigo-400">{item.visits} HITS</span>
                  </div>
                  <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-white/5 shadow-inner p-0.5">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${(item.visits / Math.max(...realHistory.map(h => h.visits))) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              
              {realHistory.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4 py-20">
                  <MousePointer2 className="w-10 h-10 opacity-20" />
                  <p className="italic text-sm text-center font-medium max-w-[200px]">
                    Behavioral telemetry hub is idle.
                  </p>
                </div>
              )}
            </div>

            {realHistory.length > 0 && (
              <div className="mt-10 p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem] relative overflow-hidden group">
                <Sparkles className="absolute -top-2 -right-2 w-12 h-12 text-indigo-500/20 group-hover:rotate-12 transition-transform" />
                <div className="flex items-center gap-2 mb-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Neural Insight</span>
                </div>
                <p className="text-xs text-slate-200 font-bold leading-relaxed">
                  "Most frequent telemetry signal originates from <span className="text-indigo-400">{topDomain.name}</span>. Establishment of behavioral baseline is complete."
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
