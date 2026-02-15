
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, RotateCcw, Loader2, ShieldAlert, AlertTriangle, Zap, Brain, Sparkles, Trash2, Globe, ScanLine, ExternalLink } from 'lucide-react';
import { getOrCreateAssistant, getOrCreateThread, sendMessage, startNewThread, clearSession, isConfigured } from '../services/backboardService';
import { scanWebPage } from '../services/geminiService';
import { aiApi } from '../services/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const QUICK_PROMPTS = [
  { icon: <ShieldAlert className="w-3.5 h-3.5" />, label: 'Analyze a URL', prompt: 'Can you help me analyze a URL for security threats? I want to check if a website is safe to visit.' },
  { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Phishing tips', prompt: 'What are the top 5 signs of a phishing email and how can I protect myself?' },
  { icon: <Zap className="w-3.5 h-3.5" />, label: 'Password audit', prompt: 'What makes a truly strong password in 2025? Give me best practices for password security.' },
  { icon: <Brain className="w-3.5 h-3.5" />, label: 'Data breach help', prompt: 'I think my data might have been breached. What steps should I take right now to secure my accounts?' },
];

const FALLBACK_SYSTEM_PROMPT = `You are GuardiaPass AI Security Advisor. Provide concise, practical cybersecurity guidance. Use severity labels (LOW/MEDIUM/HIGH/CRITICAL) when relevant and avoid asking for sensitive credentials.`;

interface AIAdvisorProps {
  pageContext?: { url: string; title: string; content: string } | null;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ pageContext }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedPage, setScannedPage] = useState<{ url: string; title: string; summary: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const configured = isConfigured();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const saved = localStorage.getItem('gp_bb_messages');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('gp_bb_messages', JSON.stringify(messages.slice(-100)));
    }
  }, [messages]);

  const pendingContextRef = useRef<typeof pageContext>(null);

  useEffect(() => {
    if (!pageContext) return;
    if (threadId && !isLoading) {
      const contextMsg = `I'm currently browsing a web page. Here's the context:\n\nURL: ${pageContext.url}\nTitle: ${pageContext.title}\nContent Preview: ${pageContext.content.substring(0, 3000)}\n\nPlease analyze this page from a security perspective and provide a brief summary.`;
      setScannedPage({ url: pageContext.url, title: pageContext.title, summary: 'Page content received from browser extension' });
      handleSend(contextMsg);
      pendingContextRef.current = null;
    } else {
      pendingContextRef.current = pageContext;
    }
  }, [pageContext]);

  useEffect(() => {
    if (threadId && !isLoading && pendingContextRef.current) {
      const ctx = pendingContextRef.current;
      const contextMsg = `I'm currently browsing a web page. Here's the context:\n\nURL: ${ctx.url}\nTitle: ${ctx.title}\nContent Preview: ${ctx.content.substring(0, 3000)}\n\nPlease analyze this page from a security perspective and provide a brief summary.`;
      setScannedPage({ url: ctx.url, title: ctx.title, summary: 'Page content received from browser extension' });
      handleSend(contextMsg);
      pendingContextRef.current = null;
    }
  }, [threadId, isLoading]);

  const initSession = useCallback(async () => {
    if (!configured) return;
    setIsInitializing(true);
    setError(null);
    try {
      const assistantId = await getOrCreateAssistant();
      const tid = await getOrCreateThread(assistantId);
      setThreadId(tid);
    } catch (err: any) {
      setThreadId('fallback-local');
      setError('Backboard unavailable. Switched to local AI advisor mode.');
    } finally {
      setIsInitializing(false);
    }
  }, [configured]);

  useEffect(() => {
    if (configured && !threadId) {
      initSession();
    }
  }, [configured, threadId, initSession]);

  const handleScanPage = async () => {
    if (!scanUrl.trim() || isScanning) return;
    let targetUrl = scanUrl.trim();
    if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;
    try {
      new URL(targetUrl);
    } catch {
      setError('Please enter a valid URL.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const result = await scanWebPage(targetUrl);
      setScannedPage({ url: targetUrl, title: result.title, summary: result.summary });

      const contextMsg = `I just scanned a web page and need your security analysis. Here's what I found:\n\nURL: ${targetUrl}\nPage Title: ${result.title}\n\nPage Summary:\n${result.summary}\n\nKey findings from AI scan:\n${result.securityNotes.join('\n')}\n\nPlease provide your expert analysis of this page — is it safe? What should I be aware of?`;
      
      if (threadId) {
        await handleSend(contextMsg);
      }
      setScanUrl('');
    } catch (err: any) {
      setError('Failed to scan page: ' + (err.message || 'Unknown error'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || isLoading || !threadId) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = threadId === 'fallback-local'
        ? (await aiApi.chat(content, FALLBACK_SYSTEM_PROMPT)).text
        : await sendMessage(threadId, content);
      const botMsg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      try {
        const fallback = await aiApi.chat(content, FALLBACK_SYSTEM_PROMPT);
        const botMsg: ChatMessage = {
          id: Math.random().toString(36).substr(2, 9),
          role: 'assistant',
          content: fallback.text || 'I encountered an error processing your request.',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, botMsg]);
        setThreadId('fallback-local');
        setError('Primary advisor unavailable. Response generated in local fallback mode.');
      } catch {
        setError(err.message || 'Failed to get response');
        const errorMsg: ChatMessage = {
          id: Math.random().toString(36).substr(2, 9),
          role: 'assistant',
          content: 'I encountered an error processing your request. Please try again.',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNewThread = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const tid = threadId === 'fallback-local' ? 'fallback-local' : await startNewThread();
      setThreadId(tid);
      setMessages([]);
      setScannedPage(null);
      localStorage.removeItem('gp_bb_messages');
    } catch (err: any) {
      setThreadId('fallback-local');
      setMessages([]);
      setScannedPage(null);
      setError('Started a new local fallback conversation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = () => {
    clearSession();
    setMessages([]);
    setThreadId(null);
    setScannedPage(null);
    localStorage.removeItem('gp_bb_messages');
    initSession();
  };

  const handleDeleteConversation = () => {
    const confirmed = window.confirm('Delete this conversation and clear all advisor history?');
    if (!confirmed || isLoading) return;
    handleClearAll();
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <h3 key={i} className="text-base font-black text-white mt-3 mb-1">{line.replace('# ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h4 key={i} className="text-sm font-bold text-white mt-2 mb-1">{line.replace('## ', '')}</h4>;
      }
      if (line.startsWith('### ')) {
        return <h5 key={i} className="text-xs font-bold text-white mt-2 mb-1">{line.replace('### ', '')}</h5>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={i} className="ml-4 text-xs leading-relaxed">{line.replace(/^[-*] /, '')}</li>;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 text-xs leading-relaxed list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
      }
      if (line.match(/\*\*(.+?)\*\*/)) {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={i} className="text-xs leading-relaxed">
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j} className="text-white font-bold">{part}</strong> : part)}
          </p>
        );
      }
      if (line.trim() === '') return <br key={i} />;
      return <p key={i} className="text-xs leading-relaxed">{line}</p>;
    });
  };

  if (!configured) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="text-center py-20">
          <div className="p-4 bg-amber-500/10 rounded-3xl border border-amber-500/20 w-fit mx-auto mb-6">
            <Bot className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-black text-white mb-3">AI ADVISOR NOT CONFIGURED</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            The Backboard.io API key is required to power the AI Security Advisor. 
            Add your BACKBOARD_API_KEY to the environment secrets to enable this feature.
          </p>
          <a href="https://app.backboard.io/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-wider rounded-2xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
            <Sparkles className="w-4 h-4" /> Get Backboard.io API Key
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight uppercase">AI Security Advisor</h1>
              <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Powered by Backboard.io
                {threadId && <span className="text-slate-700 ml-2">Thread Active</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewThread}
              disabled={isLoading}
              className="p-2.5 text-slate-500 hover:text-indigo-400 transition-all rounded-xl hover:bg-white/5 disabled:opacity-50"
              title="New conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteConversation}
              disabled={isLoading}
              className="p-2.5 text-slate-500 hover:text-red-400 transition-all rounded-xl hover:bg-white/5 disabled:opacity-50"
              title="Delete conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="mb-4">
          <button
            onClick={handleDeleteConversation}
            disabled={isLoading}
            className="w-full px-4 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/20 transition-all disabled:opacity-40"
          >
            Delete Conversation
          </button>
        </div>

        <div className="mb-4 p-3 rounded-2xl bg-slate-900/50 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Web Page Scanner</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={scanUrl}
              onChange={(e) => setScanUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleScanPage()}
              placeholder="Paste a URL to scan and analyze..."
              disabled={isScanning || isLoading || !threadId}
              className="flex-1 px-4 py-2.5 bg-black/30 border border-white/5 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 transition-all disabled:opacity-50"
            />
            <button
              onClick={handleScanPage}
              disabled={isScanning || !scanUrl.trim() || isLoading || !threadId}
              className="px-4 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-30 text-[10px] font-black uppercase tracking-wider flex items-center gap-2"
            >
              {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              {isScanning ? 'Scanning...' : 'Scan'}
            </button>
          </div>
          {scannedPage && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2">
              <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-[9px] text-emerald-400 font-bold truncate">{scannedPage.title || scannedPage.url}</span>
              <a href={scannedPage.url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0">
                <ExternalLink className="w-3 h-3 text-slate-600 hover:text-emerald-400 transition-colors" />
              </a>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
        {isInitializing && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-3 text-xs text-slate-500 font-bold">Initializing AI session...</span>
          </div>
        )}

        {!isInitializing && messages.length === 0 && (
          <div className="py-8">
            <div className="text-center mb-8">
              <div className="p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-3xl border border-indigo-500/10 w-fit mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Your Personal Security Expert</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Ask me anything about cybersecurity. I remember our past conversations, 
                can scan web pages, and provide personalized advice based on your security profile.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              {QUICK_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.prompt)}
                  disabled={isLoading || !threadId}
                  className="p-4 rounded-2xl bg-slate-900/50 border border-white/5 hover:border-indigo-500/20 hover:bg-indigo-500/[0.03] transition-all text-left group disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">{prompt.icon}</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">{prompt.label}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">{prompt.prompt.substring(0, 60)}...</p>
                </button>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-white/5">
                <div className="flex items-start gap-3">
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Web Scanner</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Paste any URL above to scan and analyze web pages. Get summaries, security assessments, and answers to questions about any article or website.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border border-white/5">
                <div className="flex items-start gap-3">
                  <Brain className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Persistent Memory</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      I remember your past conversations and security concerns across sessions for personalized advice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-4 ${
              msg.role === 'user'
                ? 'bg-indigo-500/10 border border-indigo-500/20 text-slate-200'
                : 'bg-slate-900/60 border border-white/5 text-slate-300'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">AI ADVISOR</span>
                </div>
              )}
              <div className="space-y-1">{formatMessage(msg.content)}</div>
              <div className="mt-2 text-[8px] text-slate-700 font-mono">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 max-w-[80%]">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">AI ADVISOR</span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-500">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={threadId ? "Ask your security advisor..." : "Initializing..."}
            disabled={isLoading || !threadId}
            className="flex-1 px-5 py-3.5 bg-slate-900/50 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim() || !threadId}
            className="p-3.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20 hover:bg-indigo-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[8px] text-slate-700 mt-2 font-mono tracking-wider">
          BACKBOARD.IO MEMORY ENGINE — WEB SCANNER + PERSISTENT CONTEXT
        </p>
      </div>
    </div>
  );
};

export default AIAdvisor;
