
import React, { useState, useMemo, useEffect } from 'react';
import { PasswordEntry, IdentityEntry, AddressSuggestion, HiddenPhotoEntry } from '../types';
import { Plus, Search, Trash2, X, MapPin, Lock, Loader2, RefreshCw, Globe, Image as ImageIcon, Eye, Download } from 'lucide-react';
import { encryptData, decryptData } from '../services/cryptoService';
import { suggestAddresses, analyzePasswordStrength, generateNeuralPassphrase } from '../services/geminiService';
import { vaultApi } from '../services/api';

const Vault: React.FC<{
  passwords: PasswordEntry[];
  setPasswords: React.Dispatch<React.SetStateAction<PasswordEntry[]>>;
  identities: IdentityEntry[];
  setIdentities: React.Dispatch<React.SetStateAction<IdentityEntry[]>>;
  userEmail: string;
}> = ({ passwords, setPasswords, identities, setIdentities, userEmail }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState<'passwords' | 'identities' | 'hiddenPhotos'>('passwords');
  const [isAdding, setIsAdding] = useState(false);
  
  const [newIdentity, setNewIdentity] = useState<IdentityEntry>({ id: '', label: '', firstName: '', lastName: '', email: '', password: '', phone: '', address: '', city: '', state: '', zipCode: '', country: '' });
  const [newEntry, setNewEntry] = useState({ name: '', url: '', username: '', password: '', category: 'Other' as const });
  const [hiddenPhotos, setHiddenPhotos] = useState<HiddenPhotoEntry[]>([]);
  const [activePhotoSrc, setActivePhotoSrc] = useState<string | null>(null);
  const [activePhotoName, setActivePhotoName] = useState<string>('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPhotoEncrypting, setIsPhotoEncrypting] = useState(false);
  const [genTheme, setGenTheme] = useState('Cyberpunk');

  useEffect(() => {
    if (view === 'identities' && newIdentity.address.length > 5) {
      const timer = setTimeout(async () => {
        try {
          setIsSuggesting(true);
          const results = await suggestAddresses(newIdentity.address);
          setAddressSuggestions(results.slice(0, 5));
        } catch {
          setAddressSuggestions([]);
        } finally {
          setIsSuggesting(false);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
    setAddressSuggestions([]);
  }, [newIdentity.address, view]);

  useEffect(() => {
    const raw = localStorage.getItem('gp_hidden_photos');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setHiddenPhotos(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem('gp_hidden_photos', JSON.stringify(hiddenPhotos));
  }, [hiddenPhotos]);

  const runAnalysis = async (id: string) => {
    setIsAnalyzing(true);
    const entry = passwords.find(p => p.id === id);
    if (entry?.password) {
      const decrypted = await decryptData(entry.password);
      if (decrypted) {
        const analysis = await analyzePasswordStrength(decrypted);
        setPasswords(prev => prev.map(p => p.id === id ? { ...p, securityAnalysis: analysis } : p));
        vaultApi.updatePassword(id, { securityAnalysis: analysis }).catch(console.error);
      }
    }
    setIsAnalyzing(false);
  };

  const filteredPasswords = useMemo(() => passwords.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())), [passwords, searchTerm]);
  const filteredIdentities = useMemo(() => identities.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase())), [identities, searchTerm]);
  const filteredHiddenPhotos = useMemo(
    () => hiddenPhotos.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [hiddenPhotos, searchTerm]
  );

  const handleAiGenerate = async () => {
    setIsGenerating(true);
    try {
      const pass = await generateNeuralPassphrase(genTheme);
      if (view === 'passwords') {
        setNewEntry(prev => ({ ...prev, password: pass }));
      } else if (view === 'identities') {
        setNewIdentity(prev => ({ ...prev, password: pass }));
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const applyAddressSuggestion = (address: string) => {
    const normalized = address.trim();
    const parts = normalized.match(/^\s*(.+?),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?(?:,\s*(.+))?\s*$/i);
    setNewIdentity(prev => {
      if (!parts) return { ...prev, address: normalized };
      const [, street, city, state, zip, country] = parts;
      return {
        ...prev,
        address: street || prev.address,
        city: city || prev.city,
        state: (state || prev.state).toUpperCase(),
        zipCode: zip || prev.zipCode,
        country: country || prev.country || 'USA',
      };
    });
    setAddressSuggestions([]);
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsPhotoEncrypting(true);
    try {
      const nextEntries: HiddenPhotoEntry[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        const dataUrl = await readFileAsDataUrl(file);
        const encryptedData = await encryptData(dataUrl);
        nextEntries.push({
          id: Math.random().toString(36).slice(2, 11),
          name: file.name,
          mimeType: file.type || 'image/*',
          encryptedData,
          createdAt: Date.now(),
        });
      }
      setHiddenPhotos(prev => [...nextEntries, ...prev].slice(0, 200));
    } finally {
      setIsPhotoEncrypting(false);
      e.target.value = '';
    }
  };

  const handleViewPhoto = async (photo: HiddenPhotoEntry) => {
    const decrypted = await decryptData(photo.encryptedData);
    if (decrypted) {
      setActivePhotoSrc(decrypted);
      setActivePhotoName(photo.name);
    }
  };

  const handleDownloadPhoto = async (photo: HiddenPhotoEntry) => {
    const decrypted = await decryptData(photo.encryptedData);
    if (!decrypted) return;
    const link = document.createElement('a');
    link.href = decrypted;
    link.download = photo.name;
    link.click();
  };

  const handleDeletePhoto = (id: string) => {
    setHiddenPhotos(prev => prev.filter(p => p.id !== id));
  };

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'passwords') {
      const encrypted = await encryptData(newEntry.password);
      const entry: PasswordEntry = { id: Math.random().toString(36).substr(2, 9), ...newEntry, password: encrypted, lastModified: Date.now(), isEncrypted: true };
      setPasswords(prev => [...prev, entry]);
      vaultApi.savePassword({ ...entry, userEmail }).catch(console.error);
    } else if (view === 'identities') {
      const identityPassword = newIdentity.password?.trim() ? await encryptData(newIdentity.password.trim()) : '';
      const entry: IdentityEntry = { ...newIdentity, id: Math.random().toString(36).substr(2, 9), password: identityPassword };
      setIdentities(prev => [...prev, entry]);
      vaultApi.saveIdentity({ ...entry, userEmail }).catch(console.error);
    }
    setIsAdding(false);
  };

  const handleDeletePassword = (id: string) => {
    setPasswords(prev => prev.filter(x => x.id !== id));
    vaultApi.deletePassword(id).catch(console.error);
  };

  const handleDeleteIdentity = (id: string) => {
    setIdentities(prev => prev.filter(x => x.id !== id));
    vaultApi.deleteIdentity(id).catch(console.error);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Neural <span className="text-emerald-500">Vault</span></h1>
          <p className="text-slate-500 font-medium text-[10px] mt-1 uppercase tracking-[0.3em]">Hardware-Derived Cryptographic Node</p>
        </div>
        <div className="flex gap-4">
          {view !== 'hiddenPhotos' ? (
            <button onClick={() => setIsAdding(true)} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-black uppercase text-[10px] transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20">
              <Plus className="w-4 h-4" /> Add Entry
            </button>
          ) : (
            <label className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-white font-black uppercase text-[10px] transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer">
              <ImageIcon className="w-4 h-4" /> {isPhotoEncrypting ? 'Encrypting...' : 'Upload Photos'}
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-4 mb-10">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
          <input placeholder="Search vault..." className="w-full bg-black/20 border border-white/5 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:border-indigo-500/30 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5">
           {['passwords', 'identities', 'hiddenPhotos'].map((tab) => (
             <button key={tab} onClick={() => setView(tab as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}>{tab}</button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {view === 'passwords' ? (
          filteredPasswords.length > 0 ? filteredPasswords.map(p => (
            <div key={p.id} className="glass-panel p-8 rounded-[2.5rem] bg-black/20 border-white/5 relative group hover:border-indigo-500/20 transition-all">
              <div className="flex items-center justify-between mb-6">
                 <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400"><Lock className="w-5 h-5" /></div>
                 <div className="flex gap-2">
                    <button onClick={() => runAnalysis(p.id)} disabled={isAnalyzing} className="p-2 text-slate-600 hover:text-emerald-400 transition-colors"><RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} /></button>
                    <button onClick={() => handleDeletePassword(p.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                 </div>
              </div>
              <h3 className="text-lg font-black text-white mb-1 uppercase tracking-tight">{p.name}</h3>
              <p className="text-[10px] text-slate-600 font-mono mb-6 truncate">{p.url}</p>
              <div className="p-4 bg-black/40 rounded-2xl text-[11px] text-slate-300 font-bold border border-white/5">{p.username}</div>
            </div>
          )) : <div className="col-span-3 py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">Vault is currently empty</div>
        ) : view === 'identities' ? (
          filteredIdentities.length > 0 ? filteredIdentities.map(i => (
            <div key={i.id} className="glass-panel p-8 rounded-[2.5rem] bg-black/20 border-white/5">
               <div className="flex items-center justify-between mb-6">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400"><Globe className="w-5 h-5" /></div>
                  <button onClick={() => handleDeleteIdentity(i.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
               </div>
               <h3 className="text-lg font-black text-white mb-1 uppercase tracking-tight">{i.label}</h3>
               <p className="text-[10px] text-slate-600 font-mono opacity-60">{i.email}</p>
               {i.password && <p className="text-[10px] text-emerald-400 font-bold mt-2 uppercase tracking-wider">Has encrypted password</p>}
            </div>
          )) : <div className="col-span-3 py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">No identity nodes stored</div>
        ) : (
          filteredHiddenPhotos.length > 0 ? filteredHiddenPhotos.map(photo => (
            <div key={photo.id} className="glass-panel p-8 rounded-[2.5rem] bg-black/20 border-white/5">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400"><ImageIcon className="w-5 h-5" /></div>
                <div className="flex gap-2">
                  <button onClick={() => handleViewPhoto(photo)} className="p-2 text-slate-600 hover:text-emerald-400 transition-colors"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleDownloadPhoto(photo)} className="p-2 text-slate-600 hover:text-indigo-400 transition-colors"><Download className="w-4 h-4" /></button>
                  <button onClick={() => handleDeletePhoto(photo.id)} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <h3 className="text-lg font-black text-white mb-1 truncate">{photo.name}</h3>
              <p className="text-[10px] text-slate-600 font-mono opacity-60">{new Date(photo.createdAt).toLocaleString()}</p>
              <p className="text-[10px] text-purple-400 font-bold mt-2 uppercase tracking-wider">Encrypted at rest</p>
            </div>
          )) : <div className="col-span-3 py-20 text-center opacity-30 text-xs font-black uppercase tracking-widest">No encrypted photos stored</div>
        )}
      </div>

      {isAdding && view !== 'hiddenPhotos' && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[500] flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-slate-900 rounded-[3rem] p-12 relative border border-white/10 shadow-2xl">
            <button onClick={() => setIsAdding(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X className="w-6 h-6"/></button>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-10">Deploy New {view === 'passwords' ? 'Neural Secret' : 'Identity Hub'}</h2>
            <form onSubmit={saveEntry} className="space-y-6">
              {view === 'passwords' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="Label (e.g. Gmail)" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newEntry.name} onChange={e => setNewEntry({...newEntry, name: e.target.value})}/>
                    <input required placeholder="Domain (e.g. google.com)" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newEntry.url} onChange={e => setNewEntry({...newEntry, url: e.target.value})}/>
                  </div>
                  <input required placeholder="Username" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newEntry.username} onChange={e => setNewEntry({...newEntry, username: e.target.value})}/>
                  <div className="flex gap-2">
                    <input required type="password" placeholder="Password" className="flex-1 bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newEntry.password} onChange={e => setNewEntry({...newEntry, password: e.target.value})}/>
                    <button type="button" onClick={handleAiGenerate} disabled={isGenerating} className="p-4 bg-indigo-600 rounded-2xl text-white font-black uppercase text-[10px]">{isGenerating ? '...' : 'AI'}</button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <input required placeholder="Profile Label" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.label} onChange={e => setNewIdentity({...newIdentity, label: e.target.value})}/>
                  <input required placeholder="Email Address" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.email} onChange={e => setNewIdentity({...newIdentity, email: e.target.value})}/>
                  <div className="flex gap-2">
                    <input type="password" placeholder="Identity Password (optional)" className="flex-1 bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.password || ''} onChange={e => setNewIdentity({...newIdentity, password: e.target.value})}/>
                    <button type="button" onClick={handleAiGenerate} disabled={isGenerating} className="p-4 bg-indigo-600 rounded-2xl text-white font-black uppercase text-[10px]">{isGenerating ? '...' : 'AI'}</button>
                  </div>
                  <input placeholder="Physical Address" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.address} onChange={e => setNewIdentity({...newIdentity, address: e.target.value})}/>
                  {isSuggesting && <p className="text-[10px] text-slate-500 uppercase tracking-widest">Finding likely addresses...</p>}
                  {addressSuggestions.length > 0 && (
                    <div className="max-h-36 overflow-y-auto rounded-2xl border border-white/5 bg-black/30">
                      {addressSuggestions.map((suggestion, idx) => (
                        <button
                          type="button"
                          key={`${suggestion.address}-${idx}`}
                          className="w-full text-left px-4 py-3 text-xs text-slate-300 hover:bg-indigo-500/10 border-b border-white/5 last:border-b-0"
                          onClick={() => applyAddressSuggestion(suggestion.address)}
                        >
                          {suggestion.address}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="City" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.city} onChange={e => setNewIdentity({...newIdentity, city: e.target.value})}/>
                    <input placeholder="State" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.state} onChange={e => setNewIdentity({...newIdentity, state: e.target.value})}/>
                    <input placeholder="ZIP Code" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.zipCode} onChange={e => setNewIdentity({...newIdentity, zipCode: e.target.value})}/>
                    <input placeholder="Country" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl text-sm" value={newIdentity.country} onChange={e => setNewIdentity({...newIdentity, country: e.target.value})}/>
                  </div>
                </div>
              )}
              <div className="flex gap-4 pt-10">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-5 text-slate-500 font-black uppercase text-xs">Abort</button>
                <button type="submit" className="flex-2 py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-white font-black uppercase text-xs">Authorize Store</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activePhotoSrc && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[600] flex items-center justify-center p-6">
          <div className="w-full max-w-4xl bg-slate-900 rounded-[2rem] p-6 border border-white/10 shadow-2xl relative">
            <button onClick={() => { setActivePhotoSrc(null); setActivePhotoName(''); }} className="absolute top-4 right-4 text-slate-500 hover:text-white">
              <X className="w-6 h-6" />
            </button>
            <p className="text-sm text-slate-300 font-bold mb-4">{activePhotoName}</p>
            <img src={activePhotoSrc} alt={activePhotoName} className="w-full max-h-[75vh] object-contain rounded-xl border border-white/10" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Vault;
