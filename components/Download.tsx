
import React, { useState, useEffect } from 'react';
import { 
  Chrome, ShieldCheck, Zap, Download, Code, 
  Terminal, Info, ExternalLink, CheckCircle2, 
  AlertCircle, Folder, ArrowRight, MousePointer2,
  Copy, Key, Github, Box, Server, Globe, Monitor, Laptop, Coffee
} from 'lucide-react';

const DownloadPage: React.FC = () => {
  const [isExtensionActive, setIsExtensionActive] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      setIsExtensionActive(!!(window as any).guardiapass_active || localStorage.getItem('guardiapass_extension_installed') === 'true');
    };
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startupScripts = [
    {
      id: 'win',
      os: 'Windows',
      icon: Monitor,
      filename: 'start.bat',
      content: `@echo off\ntitle GuardiaPass Neural Engine\necho [SHIELD] Initializing Quantum-Resistant Vault...\nset GEMINI_API_KEY=YOUR_API_KEY_HERE\nnpm run dev`
    },
    {
      id: 'mac',
      os: 'macOS / Linux',
      icon: Laptop,
      filename: 'start.sh',
      content: `#!/bin/bash\necho "[SHIELD] Activating Neural Bridge..."\nexport GEMINI_API_KEY="YOUR_API_KEY_HERE"\nnpm run dev`
    }
  ];

  const commands = [
    { id: 'clone', label: '1. Repository Access', cmd: 'git clone https://github.com/dev/guardiapass.git' },
    { id: 'install', label: '2. Deploy Dependencies', cmd: 'npm install' },
    { id: 'start', label: '3. Standard Startup', cmd: `export GEMINI_API_KEY="YOUR_API_KEY_HERE" && npm run dev` }
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto w-full pb-32 animate-in fade-in duration-700">
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase">
            Quick <span className="text-emerald-500">Deployment</span>
          </h1>
        </div>
        <p className="text-slate-500 max-w-2xl text-lg font-medium uppercase tracking-tight">
          Neural Vault v3.1: Set your GEMINI_API_KEY to activate AI features
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          
          {/* Quick Startup Section */}
          <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full" />
            <h3 className="text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-8">
              <Zap className="w-6 h-6 text-emerald-400" />
              One-Click Startup Shortcuts
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {startupScripts.map((script) => (
                <div key={script.id} className="p-6 bg-slate-950/60 rounded-[2rem] border border-white/5 group hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                      <script.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm uppercase tracking-widest">{script.os}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{script.filename}</p>
                    </div>
                  </div>
                  
                  <div className="relative mb-6">
                    <pre className="p-4 bg-slate-900 rounded-xl text-[10px] font-mono text-emerald-500/80 overflow-x-auto border border-white/5 whitespace-pre-wrap">
                      {script.content}
                    </pre>
                  </div>

                  <button 
                    onClick={() => copyToClipboard(script.content, script.id)}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2"
                  >
                    {copiedId === script.id ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedId === script.id ? 'Copied to Clipboard' : `Copy ${script.os} Script`}
                  </button>
                  
                  <p className="text-[9px] text-slate-600 mt-4 text-center leading-relaxed font-bold uppercase tracking-tighter">
                    {script.id === 'win' 
                      ? 'Save as start.bat in project root and double-click.' 
                      : 'Save as start.sh, run chmod +x start.sh, then ./start.sh'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Standard Setup Steps */}
          <div className="glass-panel p-10 rounded-[3rem] border-white/5 space-y-8 bg-slate-900/20">
            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
              <Terminal className="w-5 h-5 text-indigo-400" />
              Manual Sequence
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {commands.map((c) => (
                <div key={c.id} className="group relative">
                  <div className="flex items-center gap-4 bg-slate-950/40 p-5 rounded-2xl border border-white/5 group-hover:border-indigo-500/30 transition-all">
                    <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 bg-slate-900">
                      {c.id === 'clone' ? '1' : c.id === 'install' ? '2' : '3'}
                    </div>
                    <code className="text-xs font-mono text-indigo-300 flex-1 truncate">{c.cmd}</code>
                    <button 
                      onClick={() => copyToClipboard(c.cmd, c.id)}
                      className="p-2 text-slate-600 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                      {copiedId === c.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar / Requirements */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Bridge Link Panel */}
          <div className={`p-8 rounded-[2.5rem] border transition-all flex flex-col items-center text-center ${
            isExtensionActive 
              ? 'bg-emerald-500/5 border-emerald-500/20' 
              : 'bg-amber-500/5 border-amber-500/20'
          }`}>
             <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 ${
                isExtensionActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              }`}>
                {isExtensionActive ? <ShieldCheck className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Neural Status</h3>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isExtensionActive ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isExtensionActive ? 'Neural Link v3.1 Active' : 'Bridge Handshake Needed'}
              </p>
          </div>

          {/* Technical Specs */}
          <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-slate-900/40">
            <h3 className="text-xl font-black text-white mb-8 tracking-tight flex items-center gap-3">
              <Server className="w-5 h-5 text-emerald-400" />
              Runtime Spec
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Environment', val: 'Vite v6.0', ok: true },
                { label: 'API Integration', val: 'Gemini 3 Flash', ok: true },
                { label: 'Transport', val: 'Secure PostMessage', ok: true },
                { label: 'Latency Target', val: '< 50ms', ok: true }
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${item.ok ? 'text-emerald-400' : 'text-slate-600'}`}>{item.val}</span>
                    <div className={`w-1 h-1 rounded-full ${item.ok ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-10 p-6 bg-slate-950 rounded-[2rem] border border-white/5 text-center group hover:border-emerald-500/20 transition-all">
              <Coffee className="w-6 h-6 text-emerald-500 mx-auto mb-4 group-hover:rotate-12 transition-transform" />
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">Ready for Hackathon</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
