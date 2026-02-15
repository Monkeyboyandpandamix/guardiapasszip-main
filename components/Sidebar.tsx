
import React, { useState } from 'react';
import { AppSection } from '../types';
import { Shield, Key, BarChart3, Search, Download, Menu, X, ShieldCheck, ShieldX, Settings, Activity, Skull, GraduationCap, Bot } from 'lucide-react';

interface SidebarProps {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  isSecure?: boolean;
  activeColor?: string;
  accentColor?: string;
  brandColor?: string;
  bgColor?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection, isSecure, activeColor = 'emerald', accentColor = '#10b981', brandColor = '#10b981', bgColor = '#020617' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const items = [
    { id: AppSection.Vault, label: 'Secure Vault', icon: Key },
    { id: AppSection.Verifier, label: 'Live Shield', icon: Search },
    { id: AppSection.BreachScanner, label: 'Breach Scanner', icon: Skull },
    { id: AppSection.Network, label: 'Network Hub', icon: Activity },
    { id: AppSection.Analytics, label: 'Activity Hub', icon: BarChart3 },
    { id: AppSection.AIAdvisor, label: 'AI Advisor', icon: Bot },
    { id: AppSection.Education, label: 'Cyber Academy', icon: GraduationCap },
    { id: AppSection.Download, label: 'Deployment', icon: Download },
    { id: AppSection.Settings, label: 'System Config', icon: Settings },
  ];

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-5 right-5 z-[100] w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl"
        style={{ backgroundColor: accentColor, boxShadow: `0 20px 40px ${accentColor}66` }}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[85vw] max-w-72 lg:w-64 border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      style={{ backgroundColor: `${bgColor}F2`, borderRightColor: `${accentColor}2A` }}>
        <div className="p-6 lg:p-8">
          <div className="mb-10 flex items-center gap-3">
             <div className="p-2 rounded-xl border" style={{ backgroundColor: `${accentColor}22`, borderColor: `${accentColor}55` }}>
               <Shield className="w-6 h-6" style={{ color: accentColor }} />
             </div>
             <span className="font-black text-xl text-white tracking-tighter uppercase">Guardia<span style={{ color: brandColor }}>Pass</span></span>
          </div>
          <nav className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveSection(item.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${
                  activeSection === item.id
                    ? 'text-white border'
                    : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'
                }`}
                style={activeSection === item.id ? { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}55`, color: accentColor } : undefined}
              >
                <item.icon className="w-5 h-5" style={{ color: activeSection === item.id ? accentColor : '#64748b' }} />
                <span className="font-bold text-xs uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div
            className="p-5 rounded-3xl border transition-all duration-500"
            style={{
              borderColor: isSecure ? `${accentColor}55` : '#1e293b',
              backgroundColor: isSecure ? `${accentColor}1F` : '#0f172a80'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: isSecure ? accentColor : '#475569' }}>Bridge Status</p>
              {isSecure ? <ShieldCheck className="w-3 h-3" style={{ color: accentColor }} /> : <ShieldX className="w-3 h-3 text-slate-600" />}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isSecure ? accentColor : '#334155' }} />
                {isSecure && <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: accentColor }} />}
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${isSecure ? 'text-white' : 'text-slate-500'}`}>
                {isSecure ? 'Signal Locked' : 'Tunnel Offline'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div onClick={() => setIsOpen(false)} className="lg:hidden fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40" />
      )}
    </>
  );
};

export default Sidebar;
