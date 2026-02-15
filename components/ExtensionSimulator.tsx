
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Zap, RotateCw, Sparkles, Send, Loader2, X, MessageSquare, Lock, ArrowLeft, ArrowRight, Globe, ShieldAlert, Activity } from 'lucide-react';
import { PageContent } from '../types';

interface ExtensionSimulatorProps {
  onNavigate: (url: string) => void;
}

const ExtensionSimulator: React.FC<ExtensionSimulatorProps> = ({ onNavigate }) => {
  const [urlInput, setUrlInput] = useState('https://google.com');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageContent | null>(null);
  const [threatInfo, setThreatInfo] = useState<{isThreat: boolean, reason: string} | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleBridgeMessage = (event: MessageEvent) => {
      if (event.data.source === 'guardiapass_dashboard' && event.data.type === 'AI_AUDIT_RESULT') {
        setChatHistory(prev => [...prev, { role: 'model', text: event.data.text }]);
        setIsAiThinking(false);
      }
    };
    window.addEventListener('message', handleBridgeMessage);
    return () => window.removeEventListener('message', handleBridgeMessage);
  }, []);

  useEffect(() => {
    const heartbeat = setInterval(() => {
      window.postMessage({ source: 'guardiapass_extension', type: 'HEARTBEAT' }, "*");
    }, 2000);
    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleBrowse = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!urlInput) return;
    let target = urlInput;
    if (!target.startsWith('http')) target = 'https://' + target;
    
    setIsPageLoading(true);
    setIsAiPanelOpen(false);
    setChatHistory([]);
    
    const isSuspicious = target.includes('phish') || target.includes('g00gle');
    if (isSuspicious) setThreatInfo({ isThreat: true, reason: 'Neural Audit detected high-risk fingerprint.' });
    else setThreatInfo(null);
    
    // Send telemetry to Dashboard
    window.postMessage({ 
      source: 'guardiapass_extension', 
      type: 'VISIT_BATCH', 
      payload: [{ id: Math.random().toString(36).substr(2, 5), url: target, timestamp: Date.now(), isThreat: !!isSuspicious }]
    }, "*");

    setTimeout(() => {
      setCurrentPage({
        title: target.split('/')[2],
        url: target,
        text: `The GuardiaPass simulator is currently surveillance-monitoring ${target}. Neural bridge state is verified.`
      });
      setIsPageLoading(false);
      onNavigate(target);
    }, 600);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userInput.trim() || !currentPage || isAiThinking) return;
    const query = userInput;
    setUserInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: query }]);
    setIsAiThinking(true);

    window.postMessage({ 
      source: 'guardiapass_extension', 
      type: 'GEMINI_CHAT_REQUEST', 
      payload: { contents: query, page: currentPage },
      correlationId: Math.random().toString(36).substr(2, 5)
    }, "*");
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 relative border-l border-white/5 shadow-2xl">
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex items-center gap-3 relative z-[70]">
        <div className="flex items-center gap-2 mr-2">
          <button className="p-2 text-slate-500 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></button>
          <button className="p-2 text-slate-500 hover:text-white transition-colors"><ArrowRight className="w-4 h-4" /></button>
          <button onClick={() => handleBrowse()} className="p-2 text-slate-500 hover:text-white transition-colors"><RotateCw className="w-4 h-4" /></button>
        </div>
        
        <form onSubmit={handleBrowse} className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <Lock className={`w-3 h-3 ${threatInfo ? 'text-red-500' : 'text-emerald-500'}`} />
            <span className="w-px h-3 bg-slate-800" />
          </div>
          <input className={`w-full bg-slate-950 border rounded-xl py-2 pl-10 pr-4 text-xs font-medium focus:outline-none transition-all ${threatInfo ? 'border-red-500/50 text-red-400' : 'border-slate-800 text-slate-300'}`} value={urlInput} onChange={e => setUrlInput(e.target.value)} />
        </form>

        <div className="flex items-center gap-2 ml-2">
           <button onClick={() => setIsAiPanelOpen(!isAiPanelOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${isAiPanelOpen ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
             <Sparkles className={`w-4 h-4 ${isAiThinking ? 'animate-spin' : ''}`} />
             <span className="text-[10px] font-black uppercase">Scout</span>
           </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-y-auto bg-slate-950 p-8 custom-scrollbar relative">
          {isPageLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
               <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
               <p className="text-sm font-black uppercase tracking-[0.4em]">Neural Handshake...</p>
            </div>
          ) : threatInfo ? (
            <div className="max-w-xl mx-auto mt-20 p-12 bg-red-500/5 border-2 border-red-500/20 rounded-[3rem] text-center animate-in zoom-in">
               <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-8" />
               <h1 className="text-3xl font-black text-white mb-4 uppercase">Neural Shield Active</h1>
               <p className="text-slate-400 text-sm mb-10 leading-relaxed">{threatInfo.reason}</p>
               <button onClick={() => { setUrlInput('https://google.com'); handleBrowse(); }} className="px-8 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px]">Return to Safe Zone</button>
            </div>
          ) : !currentPage ? (
             <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <Globe className="w-16 h-16 text-slate-800 mb-4" />
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Enter a URL to browse</h2>
                <p className="text-slate-500 max-w-xs text-sm">Browsing through the simulator populates the Network and Analytics hubs with real-time data.</p>
             </div>
          ) : (
            <div className="max-w-4xl mx-auto bg-slate-900/40 rounded-[3rem] border border-white/5 p-16 animate-in fade-in zoom-in">
              <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/5">
                <Globe className="w-8 h-8 text-indigo-400" />
                <div><h2 className="text-2xl font-black text-white uppercase tracking-tighter">{currentPage.title}</h2><p className="text-[10px] text-slate-600 font-mono tracking-widest">{currentPage.url}</p></div>
              </div>
              <p className="text-xl font-medium text-slate-300 leading-relaxed mb-8">{currentPage.text}</p>
              <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] flex items-center gap-4">
                 <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
                 <p className="text-xs text-slate-400 font-bold uppercase tracking-widest leading-loose">Environment integrity verified. Neural bridge is receiving signals.</p>
              </div>
            </div>
          )}
        </div>

        <div className={`absolute lg:static inset-y-0 right-0 z-[100] w-full sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-300 shadow-2xl ${isAiPanelOpen ? 'translate-x-0' : 'translate-x-full lg:hidden'}`}>
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-400" /><span className="font-black text-xs text-white uppercase tracking-widest">Page Scout</span></div>
            <button onClick={() => setIsAiPanelOpen(false)} className="p-2 text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/50">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`max-w-[90%] p-4 rounded-2xl text-xs font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200'}`}>{msg.text}</div>
              </div>
            ))}
            {isAiThinking && <div className="flex justify-start"><div className="bg-slate-800 p-4 rounded-2xl flex gap-1"><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-75" /></div></div>}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="p-6 border-t border-slate-800 bg-black/20">
            <div className="relative">
              <input disabled={isAiThinking} placeholder="Ask about this page..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-5 text-xs text-slate-300 outline-none" value={userInput} onChange={e => setUserInput(e.target.value)} />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ExtensionSimulator;
