import React, { useState, useEffect } from 'react';
import { getDrivers, scanDriverQR, verifyDriver, rejectDriver, updateDriverStatus, getGateConfigs } from '../services/dataService';
import { DriverData, QueueStatus, Gate, GateConfig, UserProfile } from '../types';
import { 
  Search, ShieldCheck, Camera, MapPin, QrCode, X, FileText, 
  CheckCircle, XCircle, LogIn, LogOut, ArrowLeft, Loader2, 
  User, Truck, Activity, Lock, Eye, ChevronDown, UserCheck
} from 'lucide-react';

interface Props {
  onBack?: () => void;
  currentUser?: UserProfile | null;
}

const SecurityDashboard: React.FC<Props> = ({ onBack, currentUser }) => {
  const [view, setView] = useState<'DASHBOARD' | 'VERIFY'>('DASHBOARD');
  const [securityName, setSecurityName] = useState(currentUser?.name || 'Security Officer');
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannedDriver, setScannedDriver] = useState<DriverData | null>(null);
  const [search, setSearch] = useState('');
  const [verifyNote, setVerifyNote] = useState('');
  const [activeTab, setActiveTab] = useState<'GATE_IN' | 'GATE_OUT'>('GATE_IN');
  
  // Dynamic Gates State
  const [availableGates, setAvailableGates] = useState<GateConfig[]>([]);

  // Scan Modal State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [manualIdInput, setManualIdInput] = useState('');

  // Document Modal State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  // State for Gate Selection (Now uses string to support dynamic gate names)
  const [selectedGate, setSelectedGate] = useState<string>('');

  const refreshDrivers = async () => {
      const data = await getDrivers();
      setDrivers(data);
  };

  // Ensure securityName is updated if currentUser prop changes
  useEffect(() => {
    if (currentUser?.name) {
        setSecurityName(currentUser.name);
    }
  }, [currentUser]);

  // Fetch Gates when view changes to Verify or Dashboard
  useEffect(() => {
      const loadGates = async () => {
          const gates = await getGateConfigs();
          // Hanya ambil gate yang statusnya OPEN
          const activeGates = gates.filter(g => g.status === 'OPEN');
          setAvailableGates(activeGates);
      };
      loadGates();
  }, [view]);

  useEffect(() => {
    refreshDrivers();
    const interval = setInterval(refreshDrivers, 5000);
    return () => clearInterval(interval);
  }, [view]);

  useEffect(() => {
    if (view === 'VERIFY') {
        setVerifyNote('');
        // Default select first available gate if exists, otherwise empty
        setSelectedGate(availableGates.length > 0 ? availableGates[0].name : '');
        setIsDocModalOpen(false);
    }
  }, [view, availableGates]);

  const handleOpenScan = () => {
    setIsScanModalOpen(true);
    setManualIdInput('');
  };

  const processScan = async (driverId: string) => {
    setLoading(true);
    const result = await scanDriverQR(driverId);
    setLoading(false);
    
    if (result) {
        setScannedDriver(result);
        setIsScanModalOpen(false);
        setView('VERIFY');
    } else {
        alert("❌ Data Driver Tidak Ditemukan atau Status Tidak Valid!");
    }
  };

  const handleManualSelect = (driver: DriverData) => {
      setScannedDriver(driver);
      setView('VERIFY');
  };

  const handleVerify = async (approved: boolean) => {
    if (!scannedDriver) return;
    if (approved && !selectedGate) {
        alert("Mohon pilih Gate terlebih dahulu.");
        return;
    }
    
    setLoading(true);
    if (approved) {
        // Cast string selectedGate to any/Gate type to satisfy interface
        const success = await verifyDriver(scannedDriver.id, securityName, selectedGate as Gate, verifyNote);
        if (success) {
            setScannedDriver(null);
            setView('DASHBOARD');
        } else {
            alert("❌ Gagal: Status driver mungkin sudah berubah.");
            setScannedDriver(null);
            setView('DASHBOARD');
        }
    } else {
        const reason = prompt("Masukkan alasan penolakan:");
        if (reason) {
            await rejectDriver(scannedDriver.id, reason, securityName);
            setScannedDriver(null);
            setView('DASHBOARD');
        }
    }
    setLoading(false);
    refreshDrivers();
  };

  const handleGateOut = async (id: string) => {
      if(confirm('Konfirmasi Keluar?')) {
          setLoading(true);
          await updateDriverStatus(id, QueueStatus.EXITED);
          setLoading(false);
          refreshDrivers();
      }
  };

  // --- VERIFY VIEW ---
  if (view === 'VERIFY' && scannedDriver) {
      return (
          <div className="min-h-screen bg-[#FDF2F4] p-4 md:p-8 pb-24 font-sans text-[#2D2D2D]">
              <div className="max-w-3xl mx-auto animate-fade-in-up">
                  <button 
                    onClick={() => setView('DASHBOARD')} 
                    className="mb-6 flex items-center gap-2 text-slate-400 font-bold hover:text-[#D46A83] transition-colors bg-white/50 px-5 py-2 rounded-full backdrop-blur-sm"
                  >
                      <ArrowLeft className="w-5 h-5"/> Batal / Kembali
                  </button>
                  
                  {/* MAIN CARD */}
                  <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/60 mb-8">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-[#2D2D2D] to-slate-800 p-8 text-white flex justify-between items-center relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                          <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-1 opacity-80">
                                <ShieldCheck className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-widest">Verifikasi Data</span>
                            </div>
                            <h2 className="text-3xl font-serif font-bold text-white">{scannedDriver.licensePlate}</h2>
                          </div>
                          <div className="relative z-10 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                              <QrCode className="w-8 h-8 text-white" />
                          </div>
                      </div>

                      <div className="p-8">
                          {/* Driver & Cargo Info */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                              <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-[#D46A83] shrink-0">
                                      <User className="w-6 h-6" />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Driver</label>
                                      <div className="text-xl font-bold text-[#2D2D2D]">{scannedDriver.name}</div>
                                      <div className="text-slate-500 font-medium">{scannedDriver.phone}</div>
                                  </div>
                              </div>
                              <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                                      <Truck className="w-6 h-6" />
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vendor</label>
                                      <div className="text-xl font-bold text-[#2D2D2D]">{scannedDriver.company}</div>
                                      <div className="text-slate-500 font-medium font-mono">{scannedDriver.doNumber}</div>
                                  </div>
                              </div>
                          </div>

                          <div className="bg-[#FDF2F4] p-6 rounded-3xl border border-pink-100 flex items-center justify-between mb-8">
                              <div>
                                  <label className="text-xs font-bold text-[#D46A83] uppercase tracking-widest">Tujuan</label>
                                  <div className="text-2xl font-serif font-bold text-[#2D2D2D]">{scannedDriver.purpose}</div>
                              </div>
                              <button 
                                onClick={() => setIsDocModalOpen(true)}
                                className="px-5 py-3 bg-white text-[#D46A83] border-2 border-[#F4A8B6] rounded-xl font-bold text-sm hover:bg-pink-50 transition-colors flex items-center gap-2 shadow-sm"
                              >
                                  <FileText className="w-4 h-4"/> CEK DOKUMEN
                              </button>
                          </div>

                          {/* Gate Selection DYNAMIC */}
                          <div className="space-y-4">
                              <h3 className="font-serif font-bold text-xl text-[#2D2D2D] mb-4">Assign Location (Gate)</h3>
                              {availableGates.length === 0 ? (
                                  <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold text-center border border-red-200">
                                      ⚠️ Tidak ada Gate yang statusnya OPEN. Hubungi Admin.
                                  </div>
                              ) : (
                                  <div className="grid grid-cols-2 gap-4">
                                      {availableGates.map((gate) => {
                                          const isSelected = selectedGate === gate.name;
                                          const isDock = gate.type === 'DOCK';
                                          
                                          // Conditional Styles
                                          const activeStyle = isDock 
                                            ? 'border-indigo-500 bg-indigo-500 text-white shadow-xl shadow-indigo-200 scale-[1.02]' 
                                            : 'border-[#D46A83] bg-[#D46A83] text-white shadow-xl shadow-pink-200 scale-[1.02]';
                                          
                                          const inactiveStyle = isDock
                                            ? 'border-slate-100 bg-white text-slate-400 hover:border-indigo-200'
                                            : 'border-slate-100 bg-white text-slate-400 hover:border-pink-200';

                                          const iconColor = isSelected 
                                            ? 'text-white' 
                                            : (isDock ? 'text-slate-300 group-hover:text-indigo-300' : 'text-slate-300 group-hover:text-pink-300');

                                          return (
                                              <button 
                                                key={gate.id}
                                                onClick={() => setSelectedGate(gate.name)}
                                                className={`p-5 rounded-[1.5rem] border-2 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group ${isSelected ? activeStyle : inactiveStyle}`}
                                              >
                                                  <MapPin className={`w-8 h-8 mb-3 ${iconColor}`} />
                                                  <span className="font-bold tracking-wide text-sm">{gate.name}</span>
                                                  <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest mt-1">{gate.type}</span>
                                              </button>
                                          );
                                      })}
                                  </div>
                              )}
                          </div>
                          
                          {/* Notes */}
                          <div className="mt-8">
                             <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block ml-2">Security Notes</label>
                             <textarea 
                                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-[#F4A8B6] font-medium text-[#2D2D2D] placeholder:text-slate-400 transition-all focus:bg-white"
                                rows={2}
                                placeholder="Catatan kondisi fisik kendaraan..."
                                value={verifyNote}
                                onChange={e => setVerifyNote(e.target.value)}
                              ></textarea>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-4 mt-8">
                              <button 
                                onClick={() => handleVerify(false)} 
                                disabled={loading} 
                                className="py-4 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-full hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                              >
                                  {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><XCircle className="w-5 h-5" /> TOLAK MASUK</>}
                              </button>
                              <button 
                                onClick={() => handleVerify(true)} 
                                disabled={loading || !selectedGate} 
                                className="py-4 bg-[#D46A83] text-white font-bold rounded-full hover:bg-[#be566d] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                   {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><CheckCircle className="w-5 h-5" /> APPROVE ENTRY</>}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

              {/* DOCUMENT MODAL */}
              {isDocModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/80 backdrop-blur-md p-6 animate-fade-in-up">
                      <div className="relative w-full max-w-2xl bg-white rounded-[2rem] p-4 shadow-2xl flex flex-col items-center max-h-[90vh]">
                          <button 
                            onClick={() => setIsDocModalOpen(false)}
                            className="absolute -top-12 right-0 text-white hover:text-pink-300 p-2 transition-colors"
                          >
                              <X className="w-8 h-8" />
                          </button>
                          
                          <div className="w-full h-full overflow-auto rounded-xl bg-slate-50 flex items-center justify-center">
                              {scannedDriver.documentFile && scannedDriver.documentFile.startsWith('data:image') ? (
                                  <img src={scannedDriver.documentFile} alt="Surat Jalan" className="w-full h-auto object-contain" />
                              ) : scannedDriver.documentFile ? (
                                  <div className="text-center p-10">
                                      <FileText className="w-20 h-20 text-slate-300 mx-auto mb-4" />
                                      <p className="font-bold text-slate-600">Dokumen PDF / Eksternal</p>
                                      <p className="text-xs text-slate-400 mt-2 truncate max-w-xs">{scannedDriver.documentFile}</p>
                                  </div>
                              ) : (
                                  <div className="text-center p-10">
                                      <XCircle className="w-20 h-20 text-slate-200 mx-auto mb-4" />
                                      <p className="font-bold text-slate-400">Tidak Ada Dokumen</p>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // --- DASHBOARD VIEW ---
  const filteredList = drivers.filter(d => {
      const match = d.licensePlate.includes(search.toUpperCase()) || d.name.toLowerCase().includes(search.toLowerCase());
      if (activeTab === 'GATE_IN') {
          return match && [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status);
      } else {
          return match && d.status === QueueStatus.COMPLETED;
      }
  });

  return (
    <div className="min-h-screen bg-[#FDF2F4] font-sans text-[#2D2D2D] pb-24 relative overflow-hidden">
        {/* Background Elements */}
        <div className="fixed top-0 left-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#F4A8B6]/20 to-[#D46A83]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        {/* Header - Optimized for Mobile */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-white/60 sticky top-0 z-30 px-4 md:px-6 py-4 shadow-sm">
            <div className="max-w-5xl mx-auto flex justify-between items-center gap-3">
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#D46A83] to-[#F4A8B6] rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-pink-200 shrink-0">
                        <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-serif font-bold text-lg md:text-xl text-[#2D2D2D] leading-none truncate">Security Ops</h1>
                        <p className="text-[10px] md:text-xs font-bold text-[#D46A83] uppercase tracking-widest mt-1 truncate">
                            Officer: {securityName || 'Guest'}
                        </p>
                    </div>
                </div>
                {onBack && (
                    <button 
                        onClick={onBack} 
                        className="shrink-0 px-3 py-2 md:px-4 bg-white border border-slate-200 text-slate-500 font-bold rounded-full text-[10px] md:text-xs hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors whitespace-nowrap"
                    >
                        LOG OUT
                    </button>
                )}
            </div>
        </div>

        <div className="max-w-xl mx-auto p-6 space-y-8 relative z-10">
            
            {/* Main Action - SCAN QR */}
            <button 
                onClick={handleOpenScan}
                className="w-full py-10 bg-gradient-to-r from-[#D46A83] to-[#F4A8B6] rounded-[2.5rem] shadow-2xl shadow-pink-300 hover:scale-[1.02] active:scale-95 transition-all group relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
                <div className="relative z-10 flex flex-col items-center gap-3 text-white">
                    <div className="p-4 bg-white/20 backdrop-blur-md rounded-2xl group-hover:rotate-12 transition-transform duration-500">
                         <Camera className="w-8 h-8" />
                    </div>
                    <span className="text-3xl font-serif font-bold">Scan Driver</span>
                    <span className="text-white/80 text-sm font-bold uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full">Ketuk untuk Scan QR</span>
                </div>
            </button>

            {/* List Control Tabs */}
            <div className="flex p-1.5 bg-white rounded-full shadow-sm border border-white/60">
                <button 
                    onClick={() => setActiveTab('GATE_IN')} 
                    className={`flex-1 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'GATE_IN' ? 'bg-[#2D2D2D] text-white shadow-lg' : 'text-slate-400 hover:text-[#D46A83]'}`}
                >
                    <LogIn className="w-4 h-4" /> Masuk ({drivers.filter(d => [QueueStatus.BOOKED, QueueStatus.CHECKED_IN, QueueStatus.AT_GATE].includes(d.status)).length})
                </button>
                <button 
                    onClick={() => setActiveTab('GATE_OUT')} 
                    className={`flex-1 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'GATE_OUT' ? 'bg-[#2D2D2D] text-white shadow-lg' : 'text-slate-400 hover:text-[#D46A83]'}`}
                >
                    <LogOut className="w-4 h-4" /> Keluar ({drivers.filter(d => d.status === QueueStatus.COMPLETED).length})
                </button>
            </div>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#D46A83] transition-colors w-5 h-5" />
                <input 
                    type="text" placeholder="Cari Plat Nomor / Nama..." 
                    className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white border-2 border-slate-50 font-bold text-[#2D2D2D] outline-none focus:border-[#F4A8B6] focus:shadow-lg transition-all placeholder:text-slate-300"
                    value={search} onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* List Items */}
            <div className="space-y-4">
                {filteredList.length === 0 && (
                    <div className="text-center py-10 opacity-50">
                        <Activity className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-400">Tidak ada antrian.</p>
                    </div>
                )}
                
                {filteredList.map(d => (
                    <div key={d.id} className="bg-white/60 backdrop-blur-md p-5 rounded-[2rem] border border-white shadow-sm flex justify-between items-center group hover:bg-white hover:shadow-xl hover:shadow-pink-100/50 hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-5">
                             <div className="h-14 w-14 bg-gradient-to-br from-slate-100 to-white rounded-2xl flex items-center justify-center font-black text-xl text-slate-400 group-hover:text-[#D46A83] group-hover:from-pink-50 group-hover:to-white transition-colors shadow-inner">
                                 {d.licensePlate.substring(0,1)}
                             </div>
                             <div>
                                 <h4 className="font-black text-lg text-[#2D2D2D]">{d.licensePlate}</h4>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">{d.name}</p>
                             </div>
                        </div>
                        {activeTab === 'GATE_IN' ? (
                            <button 
                                onClick={() => handleManualSelect(d)} 
                                className="w-10 h-10 rounded-full bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:bg-[#D46A83] hover:text-white hover:border-[#D46A83] transition-all shadow-sm"
                            >
                                <ArrowLeft className="w-5 h-5 rotate-180" />
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleGateOut(d.id)} 
                                className="px-4 py-2 bg-[#2D2D2D] text-white font-bold rounded-xl text-xs hover:bg-black transition-colors shadow-lg"
                            >
                                GATE OUT
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* --- SCAN MODAL --- */}
        {isScanModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/60 backdrop-blur-md p-4 animate-fade-in-up">
                <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-white">
                    <div className="bg-[#FDF2F4] p-6 flex justify-between items-center border-b border-pink-100">
                        <div className="flex items-center gap-2 font-serif font-bold text-xl text-[#2D2D2D]">
                            <QrCode className="w-5 h-5 text-[#D46A83]"/> Scanner
                        </div>
                        <button onClick={() => setIsScanModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400"/></button>
                    </div>
                    
                    <div className="p-6">
                        {/* Mock Camera */}
                        <div className="aspect-square bg-slate-900 rounded-3xl mb-6 relative overflow-hidden flex items-center justify-center group border-4 border-slate-100 shadow-inner">
                            <div className="absolute inset-8 border-2 border-white/30 rounded-2xl">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                            </div>
                            <div className="w-full h-0.5 bg-red-500 absolute top-1/2 left-0 animate-pulse shadow-[0_0_20px_rgba(239,68,68,1)]"></div>
                            <p className="text-white/50 text-xs font-bold uppercase tracking-widest animate-pulse">Scanning...</p>
                        </div>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                            <div className="relative flex justify-center"><span className="bg-white px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Atau Pilih Manual</span></div>
                        </div>

                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                            {drivers.filter(d => [QueueStatus.BOOKED, QueueStatus.CHECKED_IN].includes(d.status)).map(d => (
                                <button 
                                    key={d.id}
                                    onClick={() => processScan(d.id)}
                                    className="w-full p-3 hover:bg-pink-50 rounded-xl flex justify-between items-center transition-colors group border border-transparent hover:border-pink-100"
                                >
                                    <div className="text-left">
                                        <div className="font-bold text-[#2D2D2D]">{d.licensePlate}</div>
                                        <div className="text-xs text-slate-400 font-bold uppercase">{d.name}</div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#D46A83] group-hover:text-white transition-all">
                                        <ArrowLeft className="w-4 h-4 rotate-180"/>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default SecurityDashboard;