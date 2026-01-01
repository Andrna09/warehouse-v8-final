import React, { useState, useEffect } from 'react';
import { 
  User, Truck, MapPin, Calendar, FileText, CheckCircle, 
  ArrowRight, ArrowLeft, Upload, AlertTriangle, Info, Clock, Check, ChevronDown, Navigation, RefreshCw, Building, Lock as LockIcon, Loader2
} from 'lucide-react';
import { createCheckIn } from '../services/dataService';
import { EntryType, Priority } from '../types';

interface Props {
  onSuccess: (driverId: string) => void;
  onBack?: () => void;
}

// TARGET LOCATION: Sociolla Warehouse Cikupa / Gudang Pink
const TARGET_LOCATION = {
  lat: -6.226976,
  lng: 106.5446167,
  name: "Sociolla Warehouse Cikupa (Gudang Pink)",
  address: "Pergudangan Griya Idola, Jl. Raya Serang No.KM12 Blok W1"
};

const MAX_DISTANCE_METERS = 1000; // 1km threshold

const DriverCheckIn: React.FC<Props> = ({ onSuccess, onBack }) => {
  // Location State
  const [checkingLocation, setCheckingLocation] = useState(true);
  const [locationData, setLocationData] = useState<{lat: number, lng: number, distance: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [bypassLocation, setBypassLocation] = useState(false);

  // Form State
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // PO Specific State
  const [poEntity, setPoEntity] = useState('SBI'); // New: Controls PO Format & PIC
  const [poInputs, setPoInputs] = useState({
    year: new Date().getFullYear().toString(),
    sequence: ''
  });

  // License Plate State (3 Parts)
  const [plateInputs, setPlateInputs] = useState({
    prefix: '',
    number: '',
    suffix: ''
  });
  
  // Form Data
  const [formData, setFormData] = useState({
    entryType: EntryType.WALK_IN,
    name: '',
    phone: '',
    licensePlate: '',
    company: '', // Now this is Manual Input for Vendor Name
    pic: 'Bu Santi', // Default for SBI
    purpose: 'UNLOADING' as 'LOADING' | 'UNLOADING',
    doNumber: '', // Will be auto-formatted
    itemType: '',
    priority: Priority.NORMAL,
    notes: '',
    documentFile: null as File | null,
    // documentBase64: '' as string // REMOVED: No longer needed for Supabase direct upload
  });

  // Auto-format PO Number based on poEntity (Internal) + Inputs
  useEffect(() => {
    // Skip auto-formatting if OTHER selected
    if (poEntity === 'OTHER') return;

    // Format: PO/[ENTITY]/[YEAR]/[SEQUENCE]
    // Example: PO/SBI/2025/0001
    const cleanSeq = poInputs.sequence.replace(/\D/g, ''); // Ensure only numbers
    const cleanYear = poInputs.year.replace(/\D/g, '');
    
    // Construct the formatted string using poEntity
    const formattedPO = `PO/${poEntity}/${cleanYear}/${cleanSeq}`;
    
    setFormData(prev => {
        if (prev.doNumber !== formattedPO) {
            return { ...prev, doNumber: formattedPO };
        }
        return prev;
    });
  }, [poEntity, poInputs.year, poInputs.sequence]);

  // Sync Plate Inputs to formData
  useEffect(() => {
      // Logic to sync back if formData has value (e.g. going back steps)
      if (formData.licensePlate && !plateInputs.prefix && !plateInputs.number) {
          const parts = formData.licensePlate.split(' ');
          if (parts.length >= 1) {
              setPlateInputs({
                  prefix: parts[0] || '',
                  number: parts[1] || '',
                  suffix: parts.slice(2).join('') || ''
              });
          }
      }
  }, []);

  // Handle Internal Entity Change (Controls PIC & PO Format)
  const handleEntityChange = (entity: string) => {
      setPoEntity(entity);
      
      // Auto-set PIC based on Entity
      let newPic = '';
      if (entity === 'SBI') newPic = 'Bu Santi';
      else if (entity === 'SDI') newPic = 'Pak Azhari';
      // SRI & OTHER default to empty (manual input)
      else newPic = ''; 

      setFormData(prev => ({ 
          ...prev, 
          pic: newPic,
          // Reset DO Number if switching to OTHER so it's empty for manual input
          doNumber: entity === 'OTHER' ? '' : prev.doNumber
      }));
  };

  // Handle Plate Input Changes
  const handlePlateChange = (part: 'prefix' | 'number' | 'suffix', value: string) => {
      let cleanValue = value.toUpperCase();

      if (part === 'number') {
          // Only Numbers
          cleanValue = cleanValue.replace(/\D/g, '');
          if (cleanValue.length > 4) return; 
      } else {
          // Only Letters
          cleanValue = cleanValue.replace(/[^A-Z]/g, '');
          // Modified limits based on user request:
          // Prefix: Max 4 chars
          // Suffix: Max 5 chars
          if (part === 'prefix' && cleanValue.length > 4) return;
          if (part === 'suffix' && cleanValue.length > 5) return;
      }

      const newInputs = { ...plateInputs, [part]: cleanValue };
      setPlateInputs(newInputs);

      // Update Parent FormData
      const fullPlate = `${newInputs.prefix} ${newInputs.number} ${newInputs.suffix}`.trim();
      handleChange('licensePlate', fullPlate);
  };

  // Calculate Distance (Haversine Formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const handleCheckLocation = () => {
    setCheckingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Browser tidak mendukung Geolocation.");
      setCheckingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const dist = calculateDistance(
          latitude, 
          longitude, 
          TARGET_LOCATION.lat, 
          TARGET_LOCATION.lng
        );
        
        setLocationData({
          lat: latitude,
          lng: longitude,
          distance: Math.round(dist) // integer meters
        });
        setCheckingLocation(false);
      },
      (error) => {
        console.error("Geo Error:", error);
        let errorMsg = "Gagal mendeteksi lokasi.";
        if (error.code === 1) errorMsg = "Akses lokasi ditolak. Mohon aktifkan GPS.";
        else if (error.code === 2) errorMsg = "Sinyal GPS tidak tersedia.";
        else if (error.code === 3) errorMsg = "Waktu deteksi lokasi habis.";
        
        setLocationError(errorMsg);
        setCheckingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    handleCheckLocation();
  }, []);

  // --- LOCATION UI RENDERERS ---

  if (checkingLocation) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in-up">
         <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20"></span>
            <MapPin className="w-10 h-10 text-blue-600 animate-bounce" />
         </div>
         <h2 className="text-2xl font-black text-slate-900 mb-2">Mendeteksi Lokasi...</h2>
         <p className="text-slate-500 max-w-xs">Sistem sedang memverifikasi posisi Anda di area gudang.</p>
      </div>
    );
  }

  const isFar = locationData && locationData.distance > MAX_DISTANCE_METERS;
  const showLocationWarning = !bypassLocation && (locationError || isFar);

  // Reusable Back Button Component for consistency
  const FloatingBackButton = () => (
    onBack ? (
      <button 
          onClick={onBack}
          className="fixed top-6 left-6 md:top-8 md:left-8 z-[100] group flex items-center gap-3 px-5 py-2.5 bg-white/80 backdrop-blur-md rounded-full border border-white/50 text-slate-600 font-bold tracking-wide hover:bg-white hover:text-[#D46A83] hover:scale-105 transition-all shadow-xl shadow-pink-100/50"
      >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="uppercase text-xs tracking-widest hidden md:inline">Back to Home</span>
      </button>
    ) : null
  );

  if (showLocationWarning) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in-up pb-20 pt-28 px-4">
        <FloatingBackButton />

        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 border border-white/50 relative overflow-hidden text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-orange-600" />
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">Peringatan Lokasi</h2>
            
            {locationError ? (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl mb-6">
                    <p className="text-red-600 font-bold">{locationError}</p>
                    <p className="text-xs text-red-400 mt-1">Pastikan GPS aktif dan izin browser diberikan.</p>
                </div>
            ) : (
                <div className="space-y-4 mb-8">
                    <p className="text-slate-600 font-medium">
                        Posisi Anda terdeteksi <span className="font-black text-orange-600">{locationData?.distance} meter</span> dari titik gudang.
                    </p>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-sm space-y-2">
                         <div className="flex justify-between">
                            <span className="text-slate-500">Target Lokasi:</span>
                            <span className="font-bold text-slate-800 text-right">{TARGET_LOCATION.name}</span>
                         </div>
                         <div className="flex justify-between">
                             <span className="text-slate-500">Alamat:</span>
                             <span className="font-bold text-slate-800 text-right max-w-[60%]">{TARGET_LOCATION.address}</span>
                         </div>
                         <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                             <span className="text-slate-500">Maksimal Jarak:</span>
                             <span className="font-bold text-green-600 text-right">{MAX_DISTANCE_METERS} m</span>
                         </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3">
                <button 
                    onClick={handleCheckLocation}
                    className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCw className="w-5 h-5"/> COBA DETEKSI ULANG
                </button>
                <button 
                    onClick={() => setBypassLocation(true)}
                    className="w-full py-4 bg-orange-600 text-white font-bold rounded-2xl shadow-xl shadow-orange-200 hover:bg-orange-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                    TETAP LANJUT (WARNING) <ArrowRight className="w-5 h-5"/>
                </button>
            </div>
        </div>
      </div>
    );
  }

  // --- MAIN FORM LOGIC ---

  const handleEntryTypeSelect = (type: EntryType) => {
    setFormData({ ...formData, entryType: type });
    setStep(2);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({ 
          ...prev, 
          documentFile: file
      }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Pass the raw File object to the service for upload
      const driver = await createCheckIn({
        ...formData,
        notes: `${formData.notes} [GPS: ${bypassLocation ? 'BYPASS' : 'OK'} Dist: ${locationData?.distance || '?'}m]`,
        documentFile: undefined // We pass the file as the second argument
      }, formData.documentFile);

      onSuccess(driver.id);
    } catch (error: any) {
      console.error("CheckIn Error:", error);
      alert("Gagal melakukan check-in: " + error.message);
      setIsSubmitting(false);
    }
  };

  // --- RENDER STEPS ---

  if (step === 1) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in-up pb-20 pt-28 md:pt-32 px-4">
        <FloatingBackButton />
        
        <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">Selamat Datang</h2>
            <p className="text-lg text-slate-600 font-medium">Sistem Manajemen Antrian Gudang</p>
            
            {locationData && (
                <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-green-100 text-green-700 rounded-full text-xs font-bold border border-green-200">
                    <Navigation className="w-3 h-3" />
                    GPS Terkonfirmasi ({locationData.distance}m)
                </div>
            )}
            {bypassLocation && (
                 <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200">
                    <AlertTriangle className="w-3 h-3" />
                    GPS Warning (Bypass)
                </div>
            )}
        </div>
        
        <div className="grid gap-6">
            <button 
                onClick={() => handleEntryTypeSelect(EntryType.WALK_IN)}
                className="group relative bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/50 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all text-left overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 flex justify-between items-center mb-4">
                    <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform"><MapPin className="w-8 h-8"/></div>
                    <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-blue-500 transition-colors"/>
                </div>
                <h3 className="relative z-10 text-2xl font-black text-slate-800 mb-1">Check-in Langsung</h3>
                <p className="relative z-10 text-slate-500 font-medium">Untuk kedatangan hari ini (Walk-in).</p>
            </button>

            <button 
                onClick={() => handleEntryTypeSelect(EntryType.BOOKING)}
                className="group relative bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/50 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all text-left overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
                <div className="relative z-10 flex justify-between items-center mb-4">
                     <div className="bg-purple-600 text-white p-4 rounded-2xl shadow-lg shadow-purple-200 group-hover:scale-110 transition-transform"><Calendar className="w-8 h-8"/></div>
                     <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-purple-500 transition-colors"/>
                </div>
                <h3 className="relative z-10 text-2xl font-black text-slate-800 mb-1">Booking Jadwal</h3>
                <p className="relative z-10 text-slate-500 font-medium">Registrasi untuk kunjungan terjadwal.</p>
            </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pb-20 px-4 pt-28 md:pt-32">
      <FloatingBackButton />
      
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-black text-slate-400 mb-3 uppercase tracking-widest px-1">
            <span className={step >= 2 ? 'text-blue-600' : ''}>1. Data Diri</span>
            <span className={step >= 3 ? 'text-blue-600' : ''}>2. Muatan</span>
            <span className={step >= 4 ? 'text-blue-600' : ''}>3. Upload</span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out shadow-lg" style={{ width: `${((step-1)/3)*100}%` }}></div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-6 md:p-10 border border-white/50 relative overflow-hidden">
        
        {/* STEP 2: PERSONAL DATA */}
        {step === 2 && (
            <div className="space-y-8 animate-fade-in-up">
                <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-xl text-blue-600"><User className="w-8 h-8" /></div>
                        Identitas Driver
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium ml-14">Lengkapi data diri supir.</p>
                </div>
                
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Nama Lengkap</label>
                        <input 
                            type="text" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all text-lg shadow-sm focus:shadow-md placeholder:font-normal"
                            value={formData.name} onChange={e => handleChange('name', e.target.value)}
                            placeholder="Contoh: Budi Santoso"
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">No. HP (WhatsApp)</label>
                            <input 
                                type="tel" className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all text-lg shadow-sm focus:shadow-md placeholder:font-normal"
                                value={formData.phone} onChange={e => handleChange('phone', e.target.value)}
                                placeholder="08..."
                            />
                        </div>

                        {/* SPLIT LICENSE PLATE INPUT */}
                        <div className="col-span-1 md:col-span-2 md:w-full">
                            <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Plat Nomor</label>
                            <div className="flex gap-3">
                                {/* Box 1: Prefix (Letters) */}
                                <input 
                                    type="text" 
                                    className="w-[25%] px-3 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-slate-900 uppercase text-center focus:border-blue-500 focus:bg-white outline-none transition-all text-lg"
                                    value={plateInputs.prefix} 
                                    onChange={e => handlePlateChange('prefix', e.target.value)}
                                    placeholder="B"
                                />
                                {/* Box 2: Number (Digits) */}
                                <input 
                                    type="tel" 
                                    className="flex-1 px-3 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-slate-900 text-center focus:border-blue-500 focus:bg-white outline-none transition-all text-lg"
                                    value={plateInputs.number} 
                                    onChange={e => handlePlateChange('number', e.target.value)}
                                    placeholder="1234"
                                />
                                {/* Box 3: Suffix (Letters) */}
                                <input 
                                    type="text" 
                                    className="w-[30%] px-3 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-black text-slate-900 uppercase text-center focus:border-blue-500 focus:bg-white outline-none transition-all text-lg"
                                    value={plateInputs.suffix} 
                                    onChange={e => handlePlateChange('suffix', e.target.value)}
                                    placeholder="XYZ"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 pt-6">
                    <button onClick={() => setStep(1)} className="px-6 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Kembali</button>
                    <button 
                        onClick={() => {
                            if(formData.name && formData.phone && plateInputs.prefix && plateInputs.number) setStep(3);
                            else alert("Mohon lengkapi data wajib (Nama, HP, Plat Nomor Lengkap).");
                        }} 
                        className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2"
                    >
                        LANJUT <ArrowRight className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        )}

        {/* STEP 3: CARGO DETAIL (UPDATED) */}
        {step === 3 && (
            <div className="space-y-8 animate-fade-in-up">
                 <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-xl text-purple-600"><Truck className="w-8 h-8" /></div>
                        Detail Muatan
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium ml-14">Informasi barang, perusahaan, dan PO.</p>
                </div>

                <div className="space-y-6">
                    {/* 1. Purpose */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Tujuan Kunjungan</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button 
                                onClick={() => handleChange('purpose', 'UNLOADING')}
                                className={`p-6 rounded-2xl border-2 font-black text-lg transition-all shadow-sm ${formData.purpose === 'UNLOADING' ? 'border-purple-600 bg-purple-600 text-white shadow-xl shadow-purple-200 scale-105' : 'border-slate-100 bg-white text-slate-400 hover:border-purple-200'}`}
                            >
                                BONGKAR <br/><span className="text-sm font-medium opacity-80">(Unloading)</span>
                            </button>
                            <button 
                                onClick={() => handleChange('purpose', 'LOADING')}
                                className={`p-6 rounded-2xl border-2 font-black text-lg transition-all shadow-sm ${formData.purpose === 'LOADING' ? 'border-blue-600 bg-blue-600 text-white shadow-xl shadow-blue-200 scale-105' : 'border-slate-100 bg-white text-slate-400 hover:border-blue-200'}`}
                            >
                                MUAT <br/><span className="text-sm font-medium opacity-80">(Loading)</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. Internal Entity / PO Type (Controls PO Format) */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Tujuan / Jenis PO (Internal)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {['SBI', 'SDI', 'SRI', 'OTHER'].map(ent => (
                                <button 
                                    key={ent}
                                    onClick={() => handleEntityChange(ent)}
                                    className={`py-3 px-2 rounded-xl font-bold border-2 transition-all shadow-sm ${poEntity === ent ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200 shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                                >
                                    {ent}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. Vendor Name (Manual Input) */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Nama Perusahaan (Vendor/Ekspedisi)</label>
                        <div className="relative">
                            <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input 
                                type="text" className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm focus:shadow-md"
                                value={formData.company} onChange={e => handleChange('company', e.target.value)}
                                placeholder="Ketik Nama PT / Vendor..."
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2 ml-1">Nama perusahaan ekspedisi atau vendor pengirim.</p>
                    </div>

                    {/* 4. PO Number Generation or Manual Input */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                            {poEntity === 'OTHER' ? 'Nomor Surat Jalan / Catatan' : 'Nomor PO / DO (Format Otomatis)'}
                        </label>
                        
                        {poEntity === 'OTHER' ? (
                            <div className="relative">
                                <input 
                                    type="text" 
                                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold text-slate-800 focus:border-blue-500 focus:bg-white outline-none transition-all shadow-sm focus:shadow-md placeholder:font-normal"
                                    value={formData.doNumber} 
                                    onChange={e => handleChange('doNumber', e.target.value)}
                                    placeholder="Masukkan Nomor Surat Jalan atau Keterangan..."
                                />
                                <p className="text-xs text-slate-400 mt-2 ml-1">Input manual untuk dokumen non-standar.</p>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-4">
                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Tahun</span>
                                        <input 
                                            type="tel"
                                            maxLength={4} 
                                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 focus:border-blue-500 outline-none text-center"
                                            value={poInputs.year} 
                                            onChange={e => setPoInputs({...poInputs, year: e.target.value.replace(/\D/g, '')})}
                                            placeholder="YYYY"
                                        />
                                    </div>
                                    <div className="col-span-8">
                                        <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Nomor Urut</span>
                                        <input 
                                            type="tel"
                                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-800 focus:border-blue-500 outline-none"
                                            value={poInputs.sequence} 
                                            onChange={e => setPoInputs({...poInputs, sequence: e.target.value.replace(/\D/g, '')})}
                                            placeholder="Ketik angka nomor urut..."
                                        />
                                    </div>
                                </div>
                                
                                {/* Visual Preview */}
                                <div className="bg-blue-100 border border-blue-200 rounded-xl p-3 text-center">
                                    <span className="text-xs text-blue-600 font-bold uppercase tracking-wider block mb-1">Hasil Format System</span>
                                    <span className="font-mono text-xl font-black text-blue-900 tracking-tight break-all">
                                        {formData.doNumber}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 5. PIC (Auto or Manual) - LOCKED FOR SBI/SDI */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">PIC / Penerima</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                className={`w-full px-5 py-4 rounded-2xl border-2 font-bold outline-none transition-all shadow-sm
                                    ${['SBI', 'SDI'].includes(poEntity) 
                                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                                        : 'bg-slate-50 border-slate-100 text-slate-800 focus:border-blue-500 focus:bg-white focus:shadow-md'
                                    }`}
                                value={formData.pic} 
                                onChange={e => handleChange('pic', e.target.value)}
                                disabled={['SBI', 'SDI'].includes(poEntity)}
                                placeholder="Nama Penerima..."
                            />
                            {['SBI', 'SDI'].includes(poEntity) && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded">
                                    <LockIcon className="w-3 h-3"/> LOCKED
                                </div>
                            )}
                        </div>
                        {['SBI', 'SDI'].includes(poEntity) && (
                            <p className="text-xs text-slate-400 mt-2 ml-1">PIC otomatis terkunci untuk {poEntity}.</p>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 pt-6">
                    <button onClick={() => setStep(2)} className="px-6 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Kembali</button>
                    <button 
                         onClick={() => {
                            // Validation Logic
                            const isPoValid = poEntity === 'OTHER' 
                                ? formData.doNumber && formData.doNumber.trim().length > 0 
                                : poInputs.sequence.length > 0;

                            if(isPoValid && formData.company) setStep(4);
                            else alert("Mohon lengkapi Nama Vendor dan Nomor PO/DO (atau catatan).");
                        }} 
                        className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-xl hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex justify-center items-center gap-2"
                    >
                        LANJUT <ArrowRight className="w-5 h-5"/>
                    </button>
                </div>
            </div>
        )}

        {/* STEP 4: UPLOAD & REVIEW */}
        {step === 4 && (
            <div className="space-y-8 animate-fade-in-up">
                 <div className="border-b border-slate-100 pb-4">
                    <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-xl text-orange-600"><Upload className="w-8 h-8" /></div>
                        Dokumen & Review
                    </h2>
                    <p className="text-slate-500 mt-2 font-medium ml-14">Upload Surat Jalan dan periksa data.</p>
                </div>

                <div className="space-y-6">
                    <div className="border-3 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer relative group bg-slate-50/50">
                        <input 
                            type="file" id="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            accept="image/*,.pdf"
                            onChange={handleFileChange}
                        />
                        {formData.documentFile ? (
                            <div className="flex flex-col items-center text-emerald-600 animate-zoom-in">
                                <div className="bg-emerald-100 p-4 rounded-full mb-3"><CheckCircle className="w-10 h-10" /></div>
                                <span className="font-bold text-lg text-slate-800">{formData.documentFile.name}</span>
                                <span className="text-sm font-medium text-emerald-600 mt-1 bg-emerald-50 px-3 py-1 rounded-full">File Terpilih</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center text-slate-400 group-hover:text-blue-500 transition-colors">
                                <div className="bg-white p-4 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform"><Upload className="w-10 h-10" /></div>
                                <span className="font-bold text-lg text-slate-600">Upload Foto Surat Jalan</span>
                                <span className="text-sm mt-1">Format PDF atau Foto (Max 5MB)</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 p-6 rounded-3xl space-y-3 border border-slate-200 shadow-inner">
                        <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs border-b border-slate-200 pb-3 mb-2">Ringkasan Data</h4>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Nama</span>
                            <span className="font-bold text-slate-900 text-right">{formData.name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Plat Nomor</span>
                            <span className="font-black text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 text-right">{formData.licensePlate}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Vendor</span>
                            <span className="font-bold text-slate-900 text-right">{formData.company}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">No. DO</span>
                            <span className="font-mono font-bold text-slate-900 text-right">{formData.doNumber}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <button onClick={() => setStep(3)} className="px-6 py-4 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-colors">Kembali</button>
                    <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting || !formData.documentFile}
                        className="flex-1 py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <><Loader2 className="w-6 h-6 animate-spin"/> MENGUPLOAD...</> : <><Check className="w-6 h-6"/> KONFIRMASI CHECK-IN</>}
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default DriverCheckIn;