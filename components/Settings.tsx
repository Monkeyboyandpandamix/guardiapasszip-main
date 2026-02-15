import React, { useState } from 'react';
import { Palette, Shield, Save, RefreshCcw, Lock, Key, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { PasswordEntry } from '../types';
import { encryptData, decryptData, changeMasterPassword } from '../services/cryptoService';

export type AppTheme = 'forest' | 'obsidian' | 'neon' | 'arctic';

interface SettingsProps {
  currentTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  bgColor: string;
  setBgColor: (color: string) => void;
  passwords: PasswordEntry[];
  setPasswords: React.Dispatch<React.SetStateAction<PasswordEntry[]>>;
}

const Settings: React.FC<SettingsProps> = ({ currentTheme, setTheme, bgColor, setBgColor, passwords, setPasswords }) => {
  const [isSaved, setIsSaved] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<'idle' | 'changing' | 'success' | 'error'>('idle');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  const themes: { id: AppTheme; name: string; color: string; desc: string }[] = [
    { id: 'forest', name: 'Midnight Forest', color: 'bg-emerald-500', desc: 'Secure environment profile' },
    { id: 'obsidian', name: 'Obsidian Gold', color: 'bg-amber-500', desc: 'Elite vault aesthetic' },
    { id: 'neon', name: 'Cyber Neon', color: 'bg-pink-500', desc: 'High-visibility threat layer' },
    { id: 'arctic', name: 'Arctic Frost', color: 'bg-sky-500', desc: 'Minimalist clinical interface' }
  ];

  const bgColors = [
    { name: 'Deep Void', value: '#020617' },
    { name: 'Emerald Abyss', value: '#061a14' },
    { name: 'Obsidian Glow', value: '#1a1606' },
    { name: 'Arctic Slate', value: '#0f172a' }
  ];

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');

    const currentMaster = localStorage.getItem('guardiapass_master_pass') || 'admin123';
    if (oldPassword !== currentMaster) {
      setPasswordChangeError('Current password is incorrect');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordChangeError('New password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }
    if (newPassword === oldPassword) {
      setPasswordChangeError('New password must be different from current');
      return;
    }

    setPasswordChangeStatus('changing');

    try {
      const decryptedEntries = await Promise.all(
        passwords.map(async (p) => {
          if (p.password && p.isEncrypted) {
            const decrypted = await decryptData(p.password);
            return { ...p, _decrypted: decrypted };
          }
          return { ...p, _decrypted: null };
        })
      );

      await changeMasterPassword(newPassword);

      const reEncryptedPasswords = await Promise.all(
        decryptedEntries.map(async (p) => {
          const { _decrypted, ...entry } = p;
          if (_decrypted) {
            const reEncrypted = await encryptData(_decrypted);
            return { ...entry, password: reEncrypted };
          }
          return entry;
        })
      );

      setPasswords(reEncryptedPasswords as PasswordEntry[]);
      setPasswordChangeStatus('success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordChangeStatus('idle'), 3000);
    } catch (err) {
      setPasswordChangeStatus('error');
      setPasswordChangeError('Failed to re-encrypt vault data');
      setTimeout(() => setPasswordChangeStatus('idle'), 3000);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full pb-32 relative">
      <div className="absolute top-8 right-8 flex items-center gap-2 px-3 py-1 bg-indigo-500/5 border border-indigo-500/10 rounded-full z-10">
        <Shield className="w-3 h-3 text-indigo-500" />
        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">System Core Root Integrity (Verified)</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">System <span className="text-indigo-400">Config</span></h1>
          <p className="text-slate-500 font-medium text-[10px] mt-1 uppercase tracking-[0.3em]">Environment Calibration Panel</p>
        </div>
        <button onClick={() => { localStorage.setItem('gp_theme', currentTheme); localStorage.setItem('gp_bg_color', bgColor); setIsSaved(true); setTimeout(() => setIsSaved(false), 2000); }} className="px-8 py-4 bg-indigo-600 rounded-[1.5rem] text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/20">
          {isSaved ? 'Environment Updated' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-black/20">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-8"><Palette className="w-6 h-6 text-indigo-400" /> Visual Neural Profile</h3>
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4">
              {themes.map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id)} className={`p-6 rounded-[2rem] border transition-all text-left ${currentTheme === t.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-slate-950/40'}`}>
                  <div className={`w-3 h-3 rounded-full mb-4 ${t.color}`} />
                  <h4 className="font-black text-white text-sm uppercase mb-1">{t.name}</h4>
                  <p className="text-[10px] text-slate-500">{t.desc}</p>
                </button>
              ))}
            </div>
            <div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Background Chroma Tuning</h4>
              <div className="flex flex-wrap gap-3">
                {bgColors.map(c => (
                  <button key={c.value} onClick={() => setBgColor(c.value)} className={`px-4 py-2 rounded-xl border text-[10px] font-black transition-all ${bgColor === c.value ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-white/5 text-slate-500'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-10 rounded-[3rem] border-white/5 bg-black/20">
          <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 mb-8">
            <Key className="w-6 h-6 text-emerald-400" /> Change Vault Password
          </h3>
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Password</label>
              <div className="relative">
                <input
                  type={showOld ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm pr-12 focus:outline-none focus:border-emerald-500/30"
                />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm pr-12 focus:outline-none focus:border-emerald-500/30"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm focus:outline-none focus:border-emerald-500/30"
              />
            </div>

            {passwordChangeError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{passwordChangeError}</span>
              </div>
            )}

            {passwordChangeStatus === 'success' && (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Vault password updated successfully</span>
              </div>
            )}

            <button
              type="submit"
              disabled={passwordChangeStatus === 'changing' || !oldPassword || !newPassword || !confirmPassword}
              className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {passwordChangeStatus === 'changing' ? (
                <><RefreshCcw className="w-4 h-4 animate-spin" /> Re-encrypting Vault...</>
              ) : (
                <><Lock className="w-4 h-4" /> Update Master Key</>
              )}
            </button>
          </form>

          <div className="mt-8 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
            <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
              Changing your vault password will re-encrypt all stored passwords with the new master key. Make sure to remember your new password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
