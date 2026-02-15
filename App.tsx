
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppSection, PasswordEntry, IdentityEntry, VisitRecord, SessionState } from './types';
import Sidebar from './components/Sidebar';
import Vault from './components/Vault';
import Verifier from './components/Verifier';
import BreachScanner from './components/BreachScanner';
import Analytics from './components/Analytics';
import DownloadPage from './components/Download';
import Settings, { AppTheme } from './components/Settings';
import AuthGateway from './components/AuthGateway';
import NetworkMonitor from './components/NetworkMonitor';
import ExtensionSimulator from './components/ExtensionSimulator';
import Education from './components/Education';
import AIAdvisor from './components/AIAdvisor';
import { Lock, Terminal, X, Activity, FlaskConical, Volume2 } from 'lucide-react';
import { askPageQuestion } from './services/geminiService';
import { decryptData, encryptData } from './services/cryptoService';
import { verifyEmail } from './services/hunterService';
import { vaultApi, visitsApi } from './services/api';
import { demoMode } from './services/demoMode';
import { DEMO_PASSWORDS, DEMO_IDENTITIES, DEMO_VISITS } from './services/demoData';

const IN_MEMORY_VISIT_LIMIT = 10000;
const THEME_ACCENTS: Record<AppTheme, string> = {
  forest: '#10b981',
  obsidian: '#f59e0b',
  neon: '#ec4899',
  arctic: '#38bdf8',
  light: '#2563eb',
  midnight: '#3b82f6',
  sunset: '#f97316',
};

const mergeRecentVisits = (incoming: VisitRecord[], existing: VisitRecord[], limit = IN_MEMORY_VISIT_LIMIT): VisitRecord[] => {
  const merged = [...incoming, ...existing].sort((a, b) => b.timestamp - a.timestamp);
  const deduped: VisitRecord[] = [];
  const seen = new Set<string>();
  for (const visit of merged) {
    if (seen.has(visit.id)) continue;
    seen.add(visit.id);
    deduped.push(visit);
    if (deduped.length >= limit) break;
  }
  return deduped;
};

const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = String(hex || '').trim().replace('#', '');
  const full = cleaned.length === 3 ? cleaned.split('').map(c => c + c).join('') : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(15,23,42,${alpha})`;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const App: React.FC = () => {
  const [session, setSession] = useState<SessionState>({ isLocked: true, userEmail: null, lastActive: Date.now() });
  const [activeSection, setActiveSection] = useState<AppSection>(AppSection.Vault);
  const [theme, setTheme] = useState<AppTheme>(() => (localStorage.getItem('gp_theme') as AppTheme) || 'forest');
  const [bgColor, setBgColor] = useState(() => localStorage.getItem('gp_bg_color') || '#020617');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('gp_accent_color') || THEME_ACCENTS[(localStorage.getItem('gp_theme') as AppTheme) || 'forest']);
  const [brandColor, setBrandColor] = useState(() => localStorage.getItem('gp_brand_color') || localStorage.getItem('gp_accent_color') || THEME_ACCENTS[(localStorage.getItem('gp_theme') as AppTheme) || 'forest']);
  const [accessibilityMode, setAccessibilityMode] = useState<boolean>(() => localStorage.getItem('gp_accessibility_mode') === '1');
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState<boolean>(() => localStorage.getItem('gp_voice_guidance') === '1');
  const [uiScale, setUiScale] = useState<number>(() => {
    const raw = Number(localStorage.getItem('gp_ui_scale') || '100');
    return [90, 100, 110].includes(raw) ? raw : 100;
  });
  
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);
  const [identities, setIdentities] = useState<IdentityEntry[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [isExtensionActive, setIsExtensionActive] = useState(false);
  const [debugLogs, setDebugLogs] = useState<{time: string, msg: string, type: 'in' | 'out' | 'sys', traceId?: string}[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [chatHistories, setChatHistories] = useState<Record<string, { role: 'user' | 'model', text: string }[]>>({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [advisorPageContext, setAdvisorPageContext] = useState<{ url: string; title: string; content: string } | null>(null);
  const [isDemoActive, setIsDemoActive] = useState(false);
  
  const lastHeartbeat = useRef<number>(Date.now());
  const pendingVisitBatchRef = useRef<VisitRecord[]>([]);
  const lastSpokenLabelRef = useRef('');

  const addLog = useCallback((msg: string, type: 'in' | 'out' | 'sys' = 'sys', traceId?: string) => {
    setDebugLogs(prev => [{ 
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
      msg, type, traceId
    }, ...prev].slice(0, 50));
  }, []);

  const loadFromDB = useCallback(async (email: string) => {
    try {
      const [dbPasswords, dbIdentities, dbVisits] = await Promise.all([
        vaultApi.getPasswords(email),
        vaultApi.getIdentities(email),
        visitsApi.getVisits(email),
      ]);
      setPasswords(dbPasswords);
      setIdentities(dbIdentities);
      setVisits(dbVisits);
      addLog(`Database: Loaded ${dbPasswords.length} passwords, ${dbIdentities.length} identities, ${dbVisits.length} visits`, 'sys');
    } catch (err) {
      console.error('Failed to load from DB:', err);
      addLog('Database: Connection error — vault data may be unavailable', 'sys');
    }
    setIsLoaded(true);
  }, [addLog]);

  useEffect(() => {
    if (!session.isLocked && session.userEmail) {
      loadFromDB(session.userEmail);
    }
  }, [session.isLocked, session.userEmail, loadFromDB]);

  useEffect(() => {
    if (session.isLocked || !session.userEmail || pendingVisitBatchRef.current.length === 0) return;
    const queued = [...pendingVisitBatchRef.current];
    pendingVisitBatchRef.current = [];
    visitsApi.saveBatch(queued, session.userEmail).catch((err) => {
      console.error('Failed to flush queued visits:', err);
      pendingVisitBatchRef.current = mergeRecentVisits(queued, pendingVisitBatchRef.current);
      addLog(`Telemetry: Failed to flush ${queued.length} queued packets`, 'sys');
    });
  }, [session.isLocked, session.userEmail, addLog]);

  useEffect(() => {
    const handleDemoShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const nowActive = demoMode.toggle();
        setIsDemoActive(nowActive);
        if (nowActive) {
          setPasswords(DEMO_PASSWORDS);
          setIdentities(DEMO_IDENTITIES);
          setVisits(DEMO_VISITS);
          setIsExtensionActive(true);
          setSession({ isLocked: false, userEmail: 'sarah.chen@gmail.com', lastActive: Date.now() });
          setIsLoaded(true);
          addLog('SIMULATION MODE ACTIVATED — All data is simulated for demonstration', 'sys');
          addLog('Extension Bridge: Handshake established (simulated)', 'in');
          addLog('Vault Sync: 8 passwords, 2 identities loaded', 'out');
          addLog('Network Monitor: 32 visits captured, 6 threats diverted', 'sys');
        } else {
          setPasswords([]);
          setIdentities([]);
          setVisits([]);
          setIsExtensionActive(false);
          setIsLoaded(false);
          setSession({ isLocked: true, userEmail: null, lastActive: Date.now() });
          setDebugLogs([]);
          addLog('SIMULATION MODE DEACTIVATED — Returning to live mode', 'sys');
        }
      }
    };
    window.addEventListener('keydown', handleDemoShortcut);
    return () => window.removeEventListener('keydown', handleDemoShortcut);
  }, [addLog]);

  useEffect(() => {
    document.body.style.backgroundColor = bgColor;
  }, [bgColor]);

  useEffect(() => {
    localStorage.setItem('gp_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('gp_bg_color', bgColor);
  }, [bgColor]);

  useEffect(() => {
    localStorage.setItem('gp_accent_color', accentColor);
    document.documentElement.style.setProperty('--gp-accent', accentColor);
    document.documentElement.style.setProperty('--gp-focus-ring', `${accentColor}99`);
    document.documentElement.style.setProperty('--gp-panel-border', hexToRgba(accentColor, 0.24));
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem('gp_brand_color', brandColor);
    document.documentElement.style.setProperty('--gp-brand', brandColor);
  }, [brandColor]);

  useEffect(() => {
    document.documentElement.style.setProperty('--gp-panel-bg', hexToRgba(bgColor, 0.76));
  }, [bgColor]);

  useEffect(() => {
    localStorage.setItem('gp_ui_scale', String(uiScale));
  }, [uiScale]);

  useEffect(() => {
    localStorage.setItem('gp_accessibility_mode', accessibilityMode ? '1' : '0');
  }, [accessibilityMode]);

  useEffect(() => {
    localStorage.setItem('gp_voice_guidance', voiceGuidanceEnabled ? '1' : '0');
  }, [voiceGuidanceEnabled]);

  const syncVaultToExtension = useCallback(() => {
    window.postMessage({ source: 'guardiapass_dashboard', type: 'VAULT_SYNC', payload: { passwords, identities } }, "*");
  }, [passwords, identities]);

  useEffect(() => {
    syncVaultToExtension();
  }, [syncVaultToExtension]);

  const syncUiSettingsToExtension = useCallback(() => {
    window.postMessage({
      source: 'guardiapass_dashboard',
      type: 'UI_SETTINGS_SYNC',
      payload: {
        theme,
        bgColor,
        accentColor,
        brandColor,
        uiScale,
        accessibilityMode,
        voiceGuidanceEnabled,
      },
    }, "*");
  }, [theme, bgColor, accentColor, brandColor, uiScale, accessibilityMode, voiceGuidanceEnabled]);

  useEffect(() => {
    syncUiSettingsToExtension();
  }, [syncUiSettingsToExtension]);

  useEffect(() => {
    if (!voiceGuidanceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    const onFocus = (ev: FocusEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const label = target.getAttribute('aria-label')
        || target.getAttribute('title')
        || target.textContent?.trim()
        || target.getAttribute('placeholder')
        || target.id;
      const clean = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!clean || clean === lastSpokenLabelRef.current) return;
      lastSpokenLabelRef.current = clean;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 1;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    };
    window.addEventListener('focusin', onFocus, true);
    return () => window.removeEventListener('focusin', onFocus, true);
  }, [voiceGuidanceEnabled]);

  const handleBridgeMessages = useCallback(async (event: MessageEvent) => {
    const data = event.data;
    if (data?.source !== 'guardiapass_extension') return;

    const { type, payload, correlationId, targetTabId, traceId } = data;

    if (type === 'HEARTBEAT') {
      lastHeartbeat.current = Date.now();
      if (!isExtensionActive) {
        setIsExtensionActive(true);
        addLog("Bridge: Signal Established", "sys");
      }
      syncVaultToExtension();
      syncUiSettingsToExtension();
      return;
    }

    if (type === 'VISIT_BATCH') {
      const batch = Array.isArray(payload) ? payload : [payload];
      setVisits(prev => mergeRecentVisits(batch, prev));
      if (!session.isLocked && session.userEmail) {
        visitsApi.saveBatch(batch, session.userEmail).catch(console.error);
      } else {
        pendingVisitBatchRef.current = mergeRecentVisits(batch, pendingVisitBatchRef.current);
      }
      addLog(`Telemetry: Received ${batch.length} packets`, 'in', traceId);
    }

    if (type === 'GEMINI_CHAT_REQUEST') {
      addLog(`Scout: Processing Query`, 'in', traceId);
      const { contents, page } = payload || {};
      const question = typeof contents === 'string' ? contents.trim() : '';
      const safePage = page && typeof page === 'object' ? page : null;
      if (!question || !safePage?.url || !safePage?.title) {
        window.postMessage({
          source: 'guardiapass_dashboard',
          type: 'AI_AUDIT_RESULT',
          text: 'Invalid request payload. Please try again.',
          correlationId,
          traceId
        }, "*");
        addLog(`Scout: Invalid payload rejected`, 'sys', traceId);
        return;
      }
      const history = chatHistories[safePage.url] || [];
      try {
        const response = await askPageQuestion(safePage, question, history);
        setChatHistories(prev => {
          const prior = prev[safePage.url] || [];
          return {
            ...prev,
            [safePage.url]: [...prior, { role: 'user', text: question }, { role: 'model', text: response }]
          };
        });

        window.postMessage({ 
          source: 'guardiapass_dashboard', 
          type: 'AI_AUDIT_RESULT', 
          text: response, 
          correlationId, 
          traceId 
        }, "*");
        addLog(`Scout: Response Dispatched`, 'out', traceId);
      } catch (err) {
        addLog(`Scout: Analysis Failed`, 'sys', traceId);
        window.postMessage({
          source: 'guardiapass_dashboard',
          type: 'AI_AUDIT_RESULT',
          text: 'I could not analyze this page right now. Please try again.',
          correlationId,
          traceId
        }, "*");
      }
    }

    if (type === 'REQUEST_DECRYPT_FOR_AUTOFILL') {
      if (!payload || typeof payload !== 'object' || typeof payload.password !== 'string' || typeof targetTabId !== 'number') {
        addLog(`Autofill: Invalid decrypt payload rejected`, 'sys', traceId);
        return;
      }
      addLog(`Autofill: Decrypting node for Tab ${targetTabId}`, 'in', traceId);
      const dec = await decryptData(payload.password);
      if (!dec) {
        addLog(`Autofill: Decrypt failed`, 'sys', traceId);
        return;
      }
      window.postMessage({ 
        source: 'guardiapass_dashboard', 
        type: 'DECRYPTED_AUTOFILL_READY', 
        targetTabId, 
        payload: { ...payload, password: dec }, 
        traceId 
      }, "*");
      addLog(`Autofill: Decrypted payload released to bridge`, 'out', traceId);
    }

    if (type === 'HUNTER_VERIFY_REQUEST') {
      addLog(`Hunter: Verifying ${payload.email}`, 'in', traceId);
      try {
        const result = await verifyEmail(payload.email);
        window.postMessage({
          source: 'guardiapass_dashboard',
          type: 'HUNTER_VERIFY_RESULT',
          payload: result,
          correlationId: data.correlationId,
          traceId
        }, "*");
        addLog(`Hunter: ${payload.email} → ${result.status} (${result.score}/100)`, 'out', traceId);
      } catch (err) {
        addLog(`Hunter: Verification failed for ${payload.email}`, 'sys', traceId);
      }
    }

    if (type === 'PAGE_CONTENT_FOR_ADVISOR') {
      addLog(`Advisor: Received page content from extension`, 'in', traceId);
      setAdvisorPageContext({
        url: payload.url,
        title: payload.title,
        content: payload.content,
      });
      setActiveSection(AppSection.AIAdvisor);
    }

    if (type === 'SAVE_CREDENTIAL') {
      if (!payload || typeof payload !== 'object' || typeof payload.password !== 'string' || typeof payload.url !== 'string') {
        addLog(`Vault: Invalid credential payload rejected`, 'sys', traceId);
        return;
      }
      addLog(`Vault: Saving credential for ${payload.url}`, 'in', traceId);
      const encrypted = await encryptData(payload.password);
      const newEntry: PasswordEntry = {
        id: Math.random().toString(36).substr(2, 9),
        name: payload.name || payload.url,
        url: payload.url,
        username: payload.username,
        password: encrypted,
        category: 'Other',
        lastModified: Date.now(),
        isEncrypted: true
      };
      setPasswords(prev => [...prev, newEntry]);
      if (session.userEmail) {
        vaultApi.savePassword({ ...newEntry, userEmail: session.userEmail }).catch(console.error);
      }
      window.postMessage({ source: 'guardiapass_dashboard', type: 'CREDENTIAL_SAVED', traceId }, "*");
      addLog(`Vault: Credential saved for ${payload.url}`, 'out', traceId);
    }

    if (type === 'REQUEST_VAULT_SNAPSHOT') {
      syncVaultToExtension();
      addLog(`Vault: Snapshot sync requested by extension`, 'sys', traceId);
    }
    if (type === 'REQUEST_UI_SETTINGS') {
      syncUiSettingsToExtension();
      addLog(`UI: Settings sync requested by extension`, 'sys', traceId);
    }
  }, [isExtensionActive, addLog, syncVaultToExtension, syncUiSettingsToExtension, chatHistories, session.userEmail, session.isLocked]);

  useEffect(() => {
    window.addEventListener('message', handleBridgeMessages);
    const watchdog = setInterval(() => {
      if (Date.now() - lastHeartbeat.current > 10000 && isExtensionActive) {
        setIsExtensionActive(false);
        addLog("Bridge: Signal Lost", "sys");
      }
    }, 5000);
    return () => {
      window.removeEventListener('message', handleBridgeMessages);
      clearInterval(watchdog);
    };
  }, [handleBridgeMessages, isExtensionActive, addLog]);

  const handleUnlock = (email: string) => {
    setSession({ isLocked: false, userEmail: email, lastActive: Date.now() });
    addLog(`Identity Confirmed: ${email}`, 'sys');
  };

  if (session.isLocked) return <AuthGateway onUnlock={handleUnlock} />;

  const activeColor =
    theme === 'forest' ? 'emerald' :
    theme === 'obsidian' ? 'amber' :
    theme === 'neon' ? 'pink' :
    theme === 'midnight' ? 'blue' :
    theme === 'sunset' ? 'orange' :
    'sky';
  const effectiveUiScale = accessibilityMode ? Math.max(uiScale, 125) : uiScale;

  return (
    <div className={`flex flex-col lg:flex-row h-screen overflow-hidden text-slate-200 theme-${theme} ${accessibilityMode ? 'gp-a11y' : ''}`} style={{ backgroundColor: bgColor, fontSize: `${effectiveUiScale}%` }}>
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} isSecure={isExtensionActive} activeColor={activeColor} accentColor={accentColor} brandColor={brandColor} bgColor={bgColor} />
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-16 shrink-0 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 bg-black/20 backdrop-blur-xl z-30">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isExtensionActive ? accentColor : '#334155', boxShadow: isExtensionActive ? `0 0 10px ${accentColor}` : 'none' }} />
             <span className="hidden sm:inline text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
               {isExtensionActive ? 'Uplink Synchronized' : 'Searching for Signal...'}
             </span>
             {isDemoActive && (
               <div className="flex items-center gap-1.5 ml-4 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full animate-pulse">
                 <FlaskConical className="w-3 h-3 text-amber-400" />
                 <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Sim</span>
               </div>
             )}
          </div>
          <div className="flex items-center gap-4">
             <button
               onClick={() => setVoiceGuidanceEnabled(v => !v)}
               className="p-2.5 text-slate-500 hover:text-cyan-400 transition-all"
               title={voiceGuidanceEnabled ? 'Disable voice guidance' : 'Enable voice guidance'}
               aria-label={voiceGuidanceEnabled ? 'Disable voice guidance' : 'Enable voice guidance'}
             >
               <Volume2 className="w-4 h-4" />
             </button>
             <button onClick={() => setShowDebug(!showDebug)} className={`p-2.5 transition-all relative ${showDebug ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-400'}`}>
               <Terminal className="w-4 h-4" />
               {isExtensionActive && !showDebug && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping" />}
             </button>
             <button onClick={() => setSession(s => ({...s, isLocked: true}))} className="p-2.5 text-slate-500 hover:text-red-400 transition-all">
               <Lock className="w-4 h-4" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {activeSection === AppSection.Vault && <Vault passwords={passwords} setPasswords={setPasswords} identities={identities} setIdentities={setIdentities} userEmail={session.userEmail || ''} />}
          {activeSection === AppSection.Verifier && <Verifier onVisit={(url) => { window.open(url, '_blank'); }} />}
          {activeSection === AppSection.BreachScanner && <BreachScanner />}
          {activeSection === AppSection.Network && <NetworkMonitor isSecure={isExtensionActive} visits={visits} />}
          {activeSection === AppSection.Analytics && <Analytics visits={visits} />}
          {activeSection === AppSection.AIAdvisor && <AIAdvisor pageContext={advisorPageContext} />}
          {activeSection === AppSection.Education && <Education />}
          {activeSection === AppSection.Download && <DownloadPage />}
          {activeSection === AppSection.Settings && (
            <Settings
              currentTheme={theme}
              setTheme={setTheme}
              bgColor={bgColor}
              setBgColor={setBgColor}
              accentColor={accentColor}
              setAccentColor={setAccentColor}
              brandColor={brandColor}
              setBrandColor={setBrandColor}
              uiScale={uiScale}
              setUiScale={setUiScale}
              accessibilityMode={accessibilityMode}
              setAccessibilityMode={setAccessibilityMode}
              voiceGuidanceEnabled={voiceGuidanceEnabled}
              setVoiceGuidanceEnabled={setVoiceGuidanceEnabled}
              passwords={passwords}
              setPasswords={setPasswords}
            />
          )}
        </div>

        {activeSection === AppSection.Verifier && (
          <div className="fixed bottom-0 right-0 w-1/2 h-1/2 z-[50] pointer-events-none opacity-20 hover:opacity-100 transition-opacity">
            <div className="w-full h-full pointer-events-auto">
               <ExtensionSimulator onNavigate={() => {}} />
            </div>
          </div>
        )}

        {showDebug && (
          <div className="absolute right-0 top-16 bottom-0 w-96 bg-[#020617]/98 backdrop-blur-3xl border-l border-white/10 z-[100] flex flex-col font-mono animate-in slide-in-from-right duration-500 shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
              <span className="text-xs font-black uppercase text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-500"/> Bridge Telemetry
              </span>
              <button onClick={() => setShowDebug(false)}><X className="w-4 h-4 text-slate-500 hover:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-[10px]">
              {debugLogs.map((log, i) => (
                <div key={i} className={`p-3 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-1 ${log.type === 'in' ? 'text-indigo-400 bg-indigo-500/5' : log.type === 'out' ? 'text-emerald-400 bg-emerald-500/5' : 'text-amber-500 bg-amber-500/5'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="opacity-40 text-[8px] font-bold">{log.type.toUpperCase()}</span>
                    <span className="opacity-40 text-[8px] font-bold">{log.time}</span>
                  </div>
                  <div className="font-bold leading-relaxed mb-1">{log.msg}</div>
                  {log.traceId && <div className="text-[7px] text-slate-600 font-mono tracking-tighter">TRACE_ID: {log.traceId}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
