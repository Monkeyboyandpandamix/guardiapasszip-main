
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ExternalLink, Shield, AlertTriangle, Lock, Eye, Mail, Wifi, Smartphone, BookOpen, Award, Target, ChevronRight, Search, Play, RotateCcw, XCircle, CheckCircle, ArrowRight, Bug, RefreshCw } from 'lucide-react';
import { cyberIntelApi } from '../services/api';

interface Resource {
  title: string;
  description: string;
  url: string;
  type: 'quiz' | 'course' | 'guide' | 'tool' | 'video';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  provider: string;
}

interface Category {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  resources: Resource[];
}

interface CyberIntelItem {
  cveId: string;
  published: string | null;
  lastModified: string | null;
  description: string;
  severity: string;
  score: number | null;
  references: string[];
  exploitedInWild: boolean;
  kev: null | {
    vendorProject: string;
    product: string;
    vulnerabilityName: string;
    dateAdded: string;
    knownRansomwareCampaignUse: string;
  };
}

interface CyberIntelPayload {
  updatedAt: number;
  sourceWindowHours: number;
  cves: CyberIntelItem[];
  totalNvdItems: number;
  totalKevItems: number;
  cache?: { hit: boolean; stale: boolean; ttlMs: number };
  warning?: string;
  sourceStatus?: { nvd?: string; kev?: string; circl?: string };
  sourceErrors?: { nvd?: string | null; kev?: string | null; circl?: string | null };
}

const categories: Category[] = [
  {
    id: 'phishing',
    title: 'Phishing Defense',
    subtitle: 'Learn to spot and avoid phishing attacks',
    icon: <Mail className="w-5 h-5" />,
    color: 'red',
    resources: [
      {
        title: "Google's Phishing Quiz",
        description: "Test your ability to identify phishing emails in this interactive quiz by Google's Jigsaw team.",
        url: "https://phishingquiz.withgoogle.com/",
        type: 'quiz',
        difficulty: 'beginner',
        provider: 'Google Jigsaw'
      },
      {
        title: "Phishing 101: How It Works",
        description: "Comprehensive guide from the Anti-Phishing Working Group on how phishing attacks are crafted and delivered.",
        url: "https://apwg.org/trendsreports/",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'APWG'
      },
      {
        title: "FBI Internet Crime Report",
        description: "Annual report on internet crime trends including phishing, BEC, and social engineering statistics.",
        url: "https://www.ic3.gov/",
        type: 'guide',
        difficulty: 'intermediate',
        provider: 'FBI IC3'
      },
      {
        title: "KnowBe4 Phishing Security Test",
        description: "Free simulated phishing test to assess your organization's vulnerability to phishing attacks.",
        url: "https://www.knowbe4.com/phishing-security-test-offer",
        type: 'tool',
        difficulty: 'beginner',
        provider: 'KnowBe4'
      },
      {
        title: "OpenPhish Threat Intelligence",
        description: "Real-time phishing threat intelligence feed showing active phishing campaigns worldwide.",
        url: "https://openphish.com/",
        type: 'tool',
        difficulty: 'advanced',
        provider: 'OpenPhish'
      }
    ]
  },
  {
    id: 'passwords',
    title: 'Password Security',
    subtitle: 'Create and manage strong passwords',
    icon: <Lock className="w-5 h-5" />,
    color: 'emerald',
    resources: [
      {
        title: "NIST Password Guidelines",
        description: "The official NIST Digital Identity Guidelines on creating secure passwords and modern best practices.",
        url: "https://pages.nist.gov/800-63-3/sp800-63b.html",
        type: 'guide',
        difficulty: 'intermediate',
        provider: 'NIST'
      },
      {
        title: "How Secure Is My Password?",
        description: "Check how long it would take a computer to crack your password with this interactive strength checker.",
        url: "https://www.security.org/how-secure-is-my-password/",
        type: 'tool',
        difficulty: 'beginner',
        provider: 'Security.org'
      },
      {
        title: "Have I Been Pwned",
        description: "Check if your email or phone has been compromised in a data breach. Free service by Troy Hunt.",
        url: "https://haveibeenpwned.com/",
        type: 'tool',
        difficulty: 'beginner',
        provider: 'Troy Hunt'
      },
      {
        title: "EFF's Creating Strong Passwords",
        description: "The Electronic Frontier Foundation's guide to creating strong passwords using the diceware method.",
        url: "https://www.eff.org/dice",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'EFF'
      }
    ]
  },
  {
    id: 'privacy',
    title: 'Online Privacy',
    subtitle: 'Protect your digital footprint',
    icon: <Eye className="w-5 h-5" />,
    color: 'violet',
    resources: [
      {
        title: "Privacy Guides",
        description: "Community-driven resource for protecting your online privacy with tool recommendations and guides.",
        url: "https://www.privacyguides.org/",
        type: 'guide',
        difficulty: 'intermediate',
        provider: 'Privacy Guides'
      },
      {
        title: "EFF's Surveillance Self-Defense",
        description: "Expert guide to protecting yourself from online surveillance with step-by-step tutorials.",
        url: "https://ssd.eff.org/",
        type: 'course',
        difficulty: 'intermediate',
        provider: 'EFF'
      },
      {
        title: "Cover Your Tracks",
        description: "See how trackers view your browser. Test your browser's protection against web tracking techniques.",
        url: "https://coveryourtracks.eff.org/",
        type: 'tool',
        difficulty: 'beginner',
        provider: 'EFF'
      },
      {
        title: "Mozilla Internet Health Report",
        description: "Annual report on the state of internet health including privacy, security, and digital inclusion.",
        url: "https://foundation.mozilla.org/en/internet-health-report/",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'Mozilla'
      }
    ]
  },
  {
    id: 'network',
    title: 'Network Security',
    subtitle: 'Secure your connections and devices',
    icon: <Wifi className="w-5 h-5" />,
    color: 'sky',
    resources: [
      {
        title: "CISA Cybersecurity Resources",
        description: "Official US government cybersecurity resources, alerts, and best practices for individuals and organizations.",
        url: "https://www.cisa.gov/cybersecurity",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'CISA'
      },
      {
        title: "Cloudflare Learning Center",
        description: "Learn about DDoS attacks, DNS, SSL/TLS, and web security fundamentals from Cloudflare's education hub.",
        url: "https://www.cloudflare.com/learning/",
        type: 'course',
        difficulty: 'intermediate',
        provider: 'Cloudflare'
      },
      {
        title: "SANS Cyber Aces Online",
        description: "Free cybersecurity courses covering operating systems, networking, and system administration.",
        url: "https://www.sans.org/cyberaces/",
        type: 'course',
        difficulty: 'intermediate',
        provider: 'SANS'
      },
      {
        title: "Shodan Search Engine",
        description: "Search engine for internet-connected devices. Learn what's exposed on your network.",
        url: "https://www.shodan.io/",
        type: 'tool',
        difficulty: 'advanced',
        provider: 'Shodan'
      }
    ]
  },
  {
    id: 'social',
    title: 'Social Engineering',
    subtitle: 'Recognize manipulation tactics',
    icon: <Target className="w-5 h-5" />,
    color: 'amber',
    resources: [
      {
        title: "Social Engineering Framework",
        description: "Comprehensive knowledge base covering social engineering attack vectors, techniques, and prevention.",
        url: "https://www.social-engineer.org/framework/general-discussion/",
        type: 'guide',
        difficulty: 'intermediate',
        provider: 'Social-Engineer.org'
      },
      {
        title: "Google Safety Center",
        description: "Google's tips and tools for staying safe online including privacy checkups and security recommendations.",
        url: "https://safety.google/",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'Google'
      },
      {
        title: "FTC Scam Alerts",
        description: "Latest scam alerts and consumer protection advice from the Federal Trade Commission.",
        url: "https://consumer.ftc.gov/scams",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'FTC'
      },
      {
        title: "Cisco Cybersecurity Essentials",
        description: "Free course covering cybersecurity fundamentals including threat detection and network security basics.",
        url: "https://www.netacad.com/courses/cybersecurity",
        type: 'course',
        difficulty: 'beginner',
        provider: 'Cisco'
      }
    ]
  },
  {
    id: 'mobile',
    title: 'Mobile Security',
    subtitle: 'Keep your mobile devices safe',
    icon: <Smartphone className="w-5 h-5" />,
    color: 'pink',
    resources: [
      {
        title: "Google's Advanced Protection Program",
        description: "Google's strongest security protections for users at high risk of targeted online attacks.",
        url: "https://landing.google.com/advancedprotection/",
        type: 'tool',
        difficulty: 'intermediate',
        provider: 'Google'
      },
      {
        title: "Apple Platform Security Guide",
        description: "Detailed guide on Apple's hardware and software security features across all Apple devices.",
        url: "https://support.apple.com/guide/security/welcome/web",
        type: 'guide',
        difficulty: 'intermediate',
        provider: 'Apple'
      },
      {
        title: "OWASP Mobile Security Testing Guide",
        description: "Comprehensive manual for mobile app security testing and reverse engineering.",
        url: "https://mas.owasp.org/",
        type: 'guide',
        difficulty: 'advanced',
        provider: 'OWASP'
      },
      {
        title: "StaySafeOnline by NCA",
        description: "National Cybersecurity Alliance's resources for individuals and families on staying safe online.",
        url: "https://staysafeonline.org/",
        type: 'guide',
        difficulty: 'beginner',
        provider: 'NCA'
      }
    ]
  }
];

const typeColors: Record<string, { bg: string; text: string; label: string }> = {
  quiz: { bg: 'bg-purple-500/10', text: 'text-purple-400', label: 'QUIZ' },
  course: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'COURSE' },
  guide: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'GUIDE' },
  tool: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'TOOL' },
  video: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'VIDEO' },
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  intermediate: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  advanced: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

const severityClass = (severity: string) => {
  const s = String(severity || '').toUpperCase();
  if (s.includes('CRITICAL')) return 'bg-red-500/10 text-red-400 border border-red-500/20';
  if (s.includes('HIGH')) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  if (s.includes('MEDIUM')) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
  if (s.includes('LOW')) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  if (s.includes('KNOWN-EXPLOITED')) return 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20';
  return 'bg-slate-500/10 text-slate-300 border border-white/10';
};

const withTimeout = async <T,>(promise: Promise<T>, ms = 15000): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('CVE feed timed out. Please try refresh again.')), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const ScamSimulator: React.FC = () => {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [typedChars, setTypedChars] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (val.length > password.length) {
      const newChar = val[val.length - 1];
      setTypedChars(prev => [...prev, newChar]);
      setIsCapturing(true);
      setTimeout(() => setIsCapturing(false), 300);
    }
  };

  const handleSubmit = () => {
    if (email && password) {
      setStep(2);
      setShowReveal(true);
    }
  };

  const reset = () => {
    setStep(0);
    setEmail('');
    setPassword('');
    setTypedChars([]);
    setShowPassword(false);
    setShowReveal(false);
    setIsCapturing(false);
  };

  return (
    <div className="rounded-3xl border border-red-500/20 bg-gradient-to-br from-red-500/5 to-slate-900/50 overflow-hidden">
      <div className="p-6 border-b border-red-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Scam Site Simulator</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">See what happens when you type a password on a phishing site</p>
            </div>
          </div>
          {step > 0 && (
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/5 hover:bg-slate-700/50 transition-all">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="p-6">
        {step === 0 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Shield className="w-8 h-8 text-red-400" />
            </div>
            <h4 className="text-base font-bold text-white mb-2">Interactive Phishing Demo</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
              This safe simulation shows exactly how a phishing site captures your credentials in real-time. 
              Use any fake data — nothing leaves your browser.
            </p>
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-wider rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all"
            >
              <Play className="w-4 h-4" /> Start Simulation
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="rounded-2xl border border-white/10 bg-white overflow-hidden">
                <div className="bg-slate-100 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-2">
                    <div className="bg-white rounded-lg px-3 py-1.5 text-[10px] text-slate-500 font-mono flex items-center gap-1.5 border border-slate-200">
                      <XCircle className="w-3 h-3 text-red-500" />
                      <span className="text-red-600">https://</span>
                      <span className="text-slate-800 font-bold">secur1ty-update-g00gle.com</span>
                      <span className="text-slate-400">/signin</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white">
                  <div className="text-center mb-5">
                    <div className="text-2xl font-medium text-slate-800 mb-1" style={{ fontFamily: "'Product Sans', 'Roboto', sans-serif" }}>
                      <span className="text-blue-500">G</span>
                      <span className="text-red-500">o</span>
                      <span className="text-yellow-500">0</span>
                      <span className="text-blue-500">g</span>
                      <span className="text-green-500">l</span>
                      <span className="text-red-500">e</span>
                    </div>
                    <p className="text-sm text-slate-600">Sign in to continue</p>
                  </div>

                  <div className="space-y-3 max-w-[280px] mx-auto">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email or phone"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <div className="relative">
                      <input
                        ref={passwordRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={handlePasswordChange}
                        placeholder="Password"
                        className={`w-full px-3 py-2.5 border rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white transition-all ${
                          isCapturing ? 'border-red-400 ring-1 ring-red-300' : 'border-slate-300'
                        }`}
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      >
                        <Eye className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-xs text-slate-500">Show password</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <button className="text-xs text-blue-600 font-medium hover:underline">Forgot password?</button>
                      <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Sign in
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-center text-slate-600 mt-2 italic">This is a simulation. No data is sent anywhere.</p>
            </div>

            <div>
              <div className="rounded-2xl border border-red-500/20 bg-slate-950/80 overflow-hidden">
                <div className="px-4 py-3 bg-red-500/5 border-b border-red-500/10 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">Attacker's Server Log</span>
                </div>
                <div className="p-4 font-mono text-[11px] space-y-1.5 max-h-[300px] overflow-y-auto">
                  <div className="text-slate-600">{`>`} Phishing page loaded</div>
                  <div className="text-slate-600">{`>`} Waiting for victim input...</div>
                  {email && (
                    <div className="text-amber-400">
                      <span className="text-slate-600">{`>`}</span> Email captured: <span className="text-white bg-amber-500/20 px-1 rounded">{email}</span>
                    </div>
                  )}
                  {typedChars.length > 0 && (
                    <>
                      <div className="text-red-400 mt-2">
                        <span className="text-slate-600">{`>`}</span> Keylogger active — capturing keystrokes:
                      </div>
                      <div className="flex flex-wrap gap-1 pl-4 py-1">
                        {typedChars.map((char, i) => (
                          <span
                            key={i}
                            className="inline-block px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] border border-red-500/30 animate-in fade-in zoom-in duration-200"
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                      <div className="text-red-400">
                        <span className="text-slate-600">{`>`}</span> Password assembled: <span className="text-white bg-red-500/20 px-1 rounded">{password}</span>
                      </div>
                    </>
                  )}
                  {isCapturing && (
                    <div className="text-red-500 animate-pulse">
                      <span className="text-slate-600">{`>`}</span> *** KEYSTROKE INTERCEPTED ***
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-400 mb-1">What you're seeing</p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Every character you type is captured in real-time by the attacker's keylogger. 
                      The fake page looks identical to Google's login, but the URL reveals it's a phishing site.
                      Always check the URL bar before entering credentials.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && showReveal && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h4 className="text-lg font-black text-red-400 mb-1">CREDENTIALS COMPROMISED</h4>
              <p className="text-xs text-slate-500">Here's what the attacker now has access to:</p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="font-mono text-xs space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                  <span className="text-slate-500">Email/Username:</span>
                  <span className="text-red-400 font-bold">{email}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                  <span className="text-slate-500">Password:</span>
                  <span className="text-red-400 font-bold">{password}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-red-500/10">
                  <span className="text-slate-500">IP Address:</span>
                  <span className="text-amber-400">192.168.x.x (simulated)</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Browser/OS:</span>
                  <span className="text-amber-400">Chrome / {navigator.platform || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                <h5 className="text-xs font-black text-red-400 uppercase tracking-wider mb-2">What attackers do next</h5>
                <ul className="space-y-1.5">
                  {[
                    'Try your password on other sites',
                    'Access your email & reset other accounts',
                    'Sell credentials on dark web ($1-10 each)',
                    'Use your identity for further scams',
                    'Access financial/banking accounts',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <ArrowRight className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/50 border border-white/5">
                <h5 className="text-xs font-black text-emerald-400 uppercase tracking-wider mb-2">How to protect yourself</h5>
                <ul className="space-y-1.5">
                  {[
                    'Always check the URL before entering credentials',
                    'Look for subtle misspellings (g00gle, amaz0n)',
                    'Use a password manager like GuardiaPass',
                    'Enable 2FA/MFA on all important accounts',
                    'Never reuse passwords across sites',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
                      <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="text-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 text-emerald-400 text-xs font-black uppercase tracking-wider rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Education: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [intel, setIntel] = useState<CyberIntelPayload | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const [intelError, setIntelError] = useState('');
  const [intelExpanded, setIntelExpanded] = useState(true);

  const filteredCategories = categories.map(cat => ({
    ...cat,
    resources: cat.resources.filter(r =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.provider.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => searchQuery === '' || cat.resources.length > 0);

  const totalResources = categories.reduce((sum, cat) => sum + cat.resources.length, 0);

  const loadIntel = useCallback(async (force = false) => {
    setIntelLoading(true);
    setIntelError('');
    try {
      let data = await withTimeout(cyberIntelApi.getRecentCves({ refresh: force, windowHours: 336 }) as Promise<CyberIntelPayload>, 18000);
      if ((!data?.cves || data.cves.length === 0) && !force) {
        data = await withTimeout(cyberIntelApi.getRecentCves({ refresh: true, windowHours: 720 }) as Promise<CyberIntelPayload>, 18000);
      }
      setIntel(data);
    } catch (err) {
      setIntelError(err instanceof Error ? err.message : 'Failed to fetch live CVE feed');
    } finally {
      setIntelLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntel(false);
    const interval = setInterval(() => loadIntel(false), 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadIntel]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
            <BookOpen className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">CYBER ACADEMY</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Security Education & Training Resources</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
            <div className="text-3xl font-black text-white">{categories.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Topic Areas</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
            <div className="text-3xl font-black text-white">{totalResources}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Curated Resources</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-white/5">
            <div className="text-3xl font-black text-emerald-400">FREE</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">All Resources</div>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <ScamSimulator />
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search resources, topics, or providers..."
          className="w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20 transition-all"
        />
      </div>

      <div className="space-y-4">
        {filteredCategories.map((category) => {
          const isExpanded = activeCategory === category.id;

          return (
            <div key={category.id} className="rounded-3xl border border-white/5 bg-slate-900/30 overflow-hidden transition-all">
              <button
                onClick={() => setActiveCategory(isExpanded ? null : category.id)}
                className="w-full p-6 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-all"
              >
                <div className={`p-3 rounded-2xl bg-${category.color}-500/10 text-${category.color}-400 border border-${category.color}-500/20`}>
                  {category.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">{category.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{category.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{category.resources.length} resources</span>
                  <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="h-px bg-white/5 mb-4" />
                  {category.resources.map((resource, idx) => (
                    <a
                      key={idx}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-5 rounded-2xl bg-slate-950/50 border border-white/5 hover:border-emerald-500/20 hover:bg-emerald-500/[0.02] transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${typeColors[resource.type].bg} ${typeColors[resource.type].text}`}>
                              {typeColors[resource.type].label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${difficultyColors[resource.difficulty].bg} ${difficultyColors[resource.difficulty].text}`}>
                              {resource.difficulty}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-800/50 text-slate-500">
                              {resource.provider}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{resource.title}</h3>
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{resource.description}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-slate-700 group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-3xl border border-white/5 bg-slate-900/30 overflow-hidden">
        <button
          onClick={() => setIntelExpanded(v => !v)}
          className="w-full p-6 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-all"
        >
          <div className="p-3 rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
            <Bug className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Technical Threat Intel (Live CVEs)</h2>
            <p className="text-xs text-slate-500 mt-0.5">Most recent vulnerabilities from NVD + CISA KEV, auto-refreshes every 6 hours</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); loadIntel(true); }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/70 border border-white/10 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:text-white hover:border-fuchsia-500/30"
            >
              <RefreshCw className={`w-3 h-3 ${intelLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform duration-300 ${intelExpanded ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {intelExpanded && (
          <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="h-px bg-white/5 mb-1" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5">
                <div className="text-2xl font-black text-white">{intel?.cves?.length ?? 0}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Recent CVEs Loaded</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5">
                <div className="text-2xl font-black text-fuchsia-400">{intel?.cves?.filter(c => c.exploitedInWild).length ?? 0}</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Known Exploited</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-white/5">
                <div className="text-xs font-black text-slate-300">
                  {intel?.updatedAt ? new Date(intel.updatedAt).toLocaleString() : 'Not synced'}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Last Updated</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="https://nvd.nist.gov/vuln/search"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-300 text-[10px] font-black uppercase tracking-wider hover:bg-sky-500/20"
              >
                Open NVD
              </a>
              <a
                href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 text-[10px] font-black uppercase tracking-wider hover:bg-fuchsia-500/20"
              >
                Open CISA KEV
              </a>
              <a
                href="https://cve.circl.lu/"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20"
              >
                Open CIRCL Feed
              </a>
            </div>

            {intelError && (
              <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-xs text-red-300">{intelError}</div>
            )}
            {intel?.warning && !intelError && (
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-300">{intel.warning}</div>
            )}
            {!intelError && intel?.sourceStatus && (
              <div className="p-4 rounded-2xl border border-white/10 bg-slate-950/40 text-[11px] text-slate-400">
                Sources:
                <span className="ml-2">NVD: <span className={intel.sourceStatus.nvd === 'ok' ? 'text-emerald-400' : 'text-amber-300'}>{intel.sourceStatus.nvd || 'unknown'}</span></span>
                <span className="ml-3">CISA KEV: <span className={intel.sourceStatus.kev === 'ok' ? 'text-emerald-400' : 'text-amber-300'}>{intel.sourceStatus.kev || 'unknown'}</span></span>
                <span className="ml-3">CIRCL: <span className={intel.sourceStatus.circl === 'ok' ? 'text-emerald-400' : 'text-amber-300'}>{intel.sourceStatus.circl || 'unknown'}</span></span>
              </div>
            )}
            {!intelError && intel && (!intel.cves || intel.cves.length === 0) && (
              <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-300">
                No CVEs were returned yet. Click refresh to re-pull a wider live window.
              </div>
            )}

            {intelLoading && !intel && (
              <div className="p-5 rounded-2xl border border-white/10 bg-slate-950/40 text-xs text-slate-400">Loading latest vulnerability feed...</div>
            )}

            <div className="space-y-3">
              {(intel?.cves || []).slice(0, 12).map((item) => (
                <div key={item.cveId} className="p-4 rounded-2xl bg-slate-950/50 border border-white/5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-800/70 text-white">
                      {item.cveId}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${severityClass(item.severity)}`}>
                      {item.severity}{typeof item.score === 'number' ? ` (${item.score.toFixed(1)})` : ''}
                    </span>
                    {item.exploitedInWild && (
                      <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                        Exploited In Wild
                      </span>
                    )}
                    {item.published && (
                      <span className="text-[10px] text-slate-500">Published: {new Date(item.published).toLocaleDateString()}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                  {item.references?.[0] && (
                    <a
                      href={item.references[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 text-[10px] font-black uppercase tracking-wider text-sky-400 hover:text-sky-300"
                    >
                      Open Reference <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 p-8 rounded-3xl bg-gradient-to-br from-emerald-500/5 to-sky-500/5 border border-white/5">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 shrink-0">
            <Award className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Security Pro Tip</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Start with Google's Phishing Quiz to test your current awareness level. Then work through the password security 
              and privacy guides. Cybersecurity is a continuous learning process — even a few minutes of education can 
              significantly reduce your risk of falling victim to online threats. Bookmark this page and revisit regularly 
              as new threats emerge.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <a href="https://phishingquiz.withgoogle.com/" target="_blank" rel="noopener noreferrer"
                className="px-4 py-2.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-2">
                <Shield className="w-3 h-3" /> Take the Phishing Quiz
              </a>
              <a href="https://haveibeenpwned.com/" target="_blank" rel="noopener noreferrer"
                className="px-4 py-2.5 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" /> Check Your Breaches
              </a>
              <a href="https://coveryourtracks.eff.org/" target="_blank" rel="noopener noreferrer"
                className="px-4 py-2.5 bg-violet-500/10 text-violet-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-violet-500/20 hover:bg-violet-500/20 transition-all flex items-center gap-2">
                <Eye className="w-3 h-3" /> Test Your Privacy
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Education;
