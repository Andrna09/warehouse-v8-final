import React, { useState } from 'react';
import { 
  Loader2, AlertCircle, Eye, EyeOff, ArrowLeft,
  ChevronRight, User, KeyRound, ShieldCheck, LayoutDashboard, Settings
} from 'lucide-react';
import { loginSystem, verifyDivisionCredential } from '../services/dataService';
import { UserProfile, DivisionConfig } from '../types';

interface Props {
  onLoginSuccess: (user: UserProfile) => void;
  onBack: () => void;
}

// NAMED EXPORT
export const LoginPage: React.FC<Props> = ({ onLoginSuccess, onBack }) => {
  // --- STATE ---
  const [step, setStep] = useState<1 | 2>(1); // 1 = Division Login, 2 = Personal Login
  const [authenticatedDiv, setAuthenticatedDiv] = useState<DivisionConfig | null>(null);

  // Form Data
  const [inputID, setInputID] = useState('');
  const [inputPass, setInputPass] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- HANDLER: STEP 1 (DIVISION LOGIN) ---
  const handleDivisionLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 600));

        const idTrimmed = inputID.trim();
        
        // Verify against stored divisions
        const divConfig = await verifyDivisionCredential(idTrimmed, inputPass);

        if (divConfig) {
            setAuthenticatedDiv(divConfig);
            setStep(2);
            // Reset Inputs for Step 2
            setInputID('');
            setInputPass('');
            setError(null);
        } else {
            throw new Error("ID Divisi atau Password salah.");
        }
    } catch (err: any) {
        setError(err.message);
    }
    
    setLoading(false);
  };

  // --- HANDLER: STEP 2 (PERSONAL LOGIN) ---
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800)); 
      
      // 1. Authenticate generic user
      const user = await loginSystem(inputID, inputPass);
      
      // 2. Validate Role matches Division Role
      if (!authenticatedDiv) throw new Error("Sesi Divisi tidak valid.");
      
      if (user.role !== authenticatedDiv.role) {
          throw new Error(`User ${user.name} tidak memiliki izin akses di divisi ${authenticatedDiv.name}.`);
      }

      // Success -> Trigger Animation in App.tsx
      onLoginSuccess(user);

    } catch (err: any) {
      setError(err.message || "Login gagal. Periksa Username dan Password.");
      setLoading(false);
    }
  };

  // Switch submit handler based on step
  const handleSubmit = (e: React.FormEvent) => {
      if (step === 1) handleDivisionLogin(e);
      else handleUserLogin(e);
  };

  // UI Helpers
  const getRoleBadge = () => {
      if (!authenticatedDiv) return null;
      let color = 'bg-slate-100 text-slate-600';
      let Icon = ShieldCheck;

      if (authenticatedDiv.theme === 'emerald') { color = 'bg-emerald-100 text-emerald-600'; Icon = ShieldCheck; }
      else if (authenticatedDiv.theme === 'blue') { color = 'bg-blue-100 text-blue-600'; Icon = LayoutDashboard; }
      else if (authenticatedDiv.theme === 'purple') { color = 'bg-purple-100 text-purple-600'; Icon = Settings; }
      else { color = 'bg-slate-100 text-slate-600'; Icon = KeyRound; }

      return (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${color} mb-4 animate-fade-in-up`}>
              <Icon className="w-3 h-3" />
              {authenticatedDiv.id} DIVISION ACTIVE
          </div>
      );
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#FDF2F4] font-sans animate-fade-in-up overflow-hidden">
      
      {/* Background Ambience (Soft Circles) */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-[#FCE7F3] rounded-full blur-[120px] pointer-events-none opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#FBCFE8] rounded-full blur-[100px] pointer-events-none opacity-50"></div>
      
      {/* Side Label (Watermark) */}
      <div className="absolute left-10 top-1/3 hidden lg:flex items-center gap-2 opacity-30">
        <div className="w-2 h-2 rounded-full bg-[#D46A83]"></div>
        <span className="text-xs font-bold tracking-[0.2em] text-[#D46A83] uppercase">Warehouse V4.0</span>
      </div>

      {/* BACK BUTTON (Logic Changes based on Step) */}
      <button 
        onClick={step === 2 ? () => { setStep(1); setInputID(''); setInputPass(''); setError(null); } : onBack}
        className="fixed top-8 left-8 z-[100] group flex items-center gap-3 px-6 py-3 bg-white/60 backdrop-blur-md rounded-full border border-white/50 text-[#D46A83] font-bold tracking-widest text-[10px] hover:bg-white transition-all shadow-sm uppercase"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {step === 2 ? 'GANTI DIVISI' : 'KEMBALI KE MENU'}
      </button>

      <div className="relative z-10 w-full max-w-[420px] mx-4">
        
        {/* --- MAIN CARD --- */}
        <div className="bg-white/40 backdrop-blur-xl border border-white/80 rounded-[2.5rem] shadow-2xl shadow-pink-100/50 p-8 md:p-10 relative">
            
            {/* Logo S & Header */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg shadow-pink-100 flex items-center justify-center mx-auto mb-6 transform hover:scale-105 transition-transform duration-500">
                    <span className="font-sans font-bold text-5xl text-[#F4A8B6]">S</span>
                </div>
                
                {/* Dynamic Title based on Step */}
                <h2 className="text-3xl font-serif font-bold text-[#4A4A4A] mb-1">
                    {step === 1 ? 'Division Access' : 'Staff Login'}
                </h2>
                
                {step === 1 && (
                    <p className="text-[#D46A83]/60 text-[10px] font-bold uppercase tracking-[0.2em]">Pilih Hak Akses Departemen</p>
                )}
                
                {/* Step 2 Badge */}
                {step === 2 && getRoleBadge()}
            </div>

            {/* Error Alert */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-pulse">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="text-xs font-bold text-red-600 leading-tight">{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* ID Field */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                        {step === 1 ? 'Division ID' : 'Personal Username'}
                    </label>
                    <div className="relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                            <User className="w-5 h-5 text-slate-300 group-focus-within:text-[#D46A83] transition-colors" />
                        </div>
                        <input 
                            type="text" 
                            value={inputID}
                            onChange={(e) => setInputID(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-[#F4A8B6] rounded-xl py-3.5 pl-12 pr-4 text-slate-700 font-bold outline-none placeholder:text-slate-300 transition-all text-sm"
                            placeholder={step === 1 ? "Ex: SECURITY" : "Ex: Budi"}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Password Field */}
                <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-1">
                        {step === 1 ? 'Division Key' : 'Personal PIN'}
                    </label>
                    <div className="relative group">
                        <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center pointer-events-none">
                            <KeyRound className="w-5 h-5 text-slate-300 group-focus-within:text-[#D46A83] transition-colors" />
                        </div>
                        <input 
                            type={showPassword ? 'text' : 'password'}
                            value={inputPass}
                            onChange={(e) => setInputPass(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 focus:border-[#F4A8B6] rounded-xl py-3.5 pl-12 pr-12 text-slate-700 font-bold outline-none placeholder:text-slate-300 transition-all font-mono tracking-widest text-sm"
                            placeholder="••••"
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#D46A83] transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                    </div>
                </div>

                {/* Submit Button */}
                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-[#F4A8B6] to-[#F9A8D4] hover:from-[#D46A83] hover:to-[#DB2777] text-white font-bold rounded-xl shadow-lg shadow-pink-200 hover:shadow-pink-300 transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed group text-sm tracking-wide uppercase"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <> {step === 1 ? 'VERIFY DIVISION' : 'ACCESS PORTAL'} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> </>
                    )}
                </button>
            </form>

            {/* Helper Data (Demo) - Only show in Step 1 for Division Hints */}
            {step === 1 && (
                <div className="mt-10 pt-6 text-center">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-3">Quick Login (Default)</p>
                    <div className="flex justify-center gap-2">
                        <button className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 hover:text-[#D46A83] transition-colors shadow-sm" onClick={() => {setInputID('SECURITY'); setInputPass('Sec@123')}}>
                        Security
                        </button>
                        <button className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 hover:text-[#D46A83] transition-colors shadow-sm" onClick={() => {setInputID('ADMIN'); setInputPass('Adm@123')}}>
                        Admin
                        </button>
                        <button className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 hover:text-[#D46A83] transition-colors shadow-sm" onClick={() => {setInputID('MANAGER'); setInputPass('Man@123')}}>
                        Manager
                        </button>
                    </div>
                </div>
            )}

            {/* Helper Data for Step 2 */}
            {step === 2 && authenticatedDiv?.role === 'SECURITY' && (
                 <div className="mt-10 pt-6 text-center animate-fade-in-up">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-3">Quick User (Security)</p>
                    <div className="flex justify-center gap-2">
                        <button className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 hover:text-[#D46A83] transition-colors shadow-sm" onClick={() => {setInputID('budi'); setInputPass('1234')}}>
                           Budi (Staff)
                        </button>
                    </div>
                 </div>
            )}
            
            {step === 2 && authenticatedDiv?.role === 'ADMIN' && (
                 <div className="mt-10 pt-6 text-center animate-fade-in-up">
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-3">Quick User (Admin)</p>
                    <div className="flex justify-center gap-2">
                        <button className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-400 hover:text-[#D46A83] transition-colors shadow-sm" onClick={() => {setInputID('siti'); setInputPass('1234')}}>
                           Siti (Staff)
                        </button>
                    </div>
                 </div>
            )}

        </div>

      </div>
    </div>
  );
};