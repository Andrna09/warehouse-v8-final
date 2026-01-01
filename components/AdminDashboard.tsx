import React, { useEffect, useState } from 'react';
import { getDrivers, callDriver, updateDriverStatus } from '../services/dataService';
import { DriverData, QueueStatus, Gate } from '../types';
import { 
  Truck, Activity, ExternalLink, Loader2, MapPin, Megaphone, Settings, 
  X, CheckCircle, Clock, Calendar, FileText, ArrowRight, User, Package, CheckSquare
} from 'lucide-react';
import { getStatusLabel, getStatusColor } from '../utils/formatters';

const AdminDashboard: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverData | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Filter State: 'VERIFIKASI' | 'BONGKAR' | 'SELESAI'
  const [activeFilter, setActiveFilter] = useState<'VERIFIKASI' | 'BONGKAR' | 'SELESAI'>('VERIFIKASI');

  const refresh = async () => {
    const data = await getDrivers();
    setDrivers(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenAssign = (driver: DriverData) => {
    setSelectedDriver(driver);
    setIsModalOpen(true);
  };

  const handleConfirmCall = async () => {
    if (selectedDriver) {
      setProcessingId(selectedDriver.id);
      await callDriver(selectedDriver.id, "Admin Ops");
      setIsModalOpen(false);
      setProcessingId(null);
      await refresh();
    }
  };

  const handleStatusUpdate = async (id: string, status: QueueStatus) => {
      setProcessingId(id);
      await updateDriverStatus(id, status);
      await refresh();
      setProcessingId(null);
  };

  const generateWATemplate = (driver: DriverData) => {
      const gateName = driver.gate.replace(/_/g, ' '); 
      return `PANGGILAN OPERASIONAL BONGKAR MUAT \n` +
             `--------------------------------------------\n` +
             `IDENTITAS UNIT:\n` +
             `No. Polisi    : ${driver.licensePlate}\n` +
             `Nama Driver   : ${driver.name}\n` +
             `No. Antrian   : ${driver.queueNumber || '-'}\n\n` +
             `INSTRUKSI MERAPAT:\n` +
             `Lokasi Tujuan : ${gateName}\n\n` +
             `Personel operasional telah siap di Gate (dock) untuk memproses muatan Anda. \n` +
             `Mohon segera memindahkan unit dari area parkir tunggu menuju lokasi tersebut dalam waktu maksimal 10 menit.\n` +
             `--------------------------------------------\n` +
             `Admin Operations\n` +
             `Sociolla Warehouse Management`;
  };

  // --- DATASETS ---
  const verifikasiData = drivers.filter(d => d.status === QueueStatus.VERIFIED);
  const readyBongkarData = drivers.filter(d => [QueueStatus.CALLED, QueueStatus.LOADING].includes(d.status));
  const selesaiData = drivers.filter(d => d.status === QueueStatus.COMPLETED);

  let currentData: DriverData[] = [];
  if (activeFilter === 'VERIFIKASI') currentData = verifikasiData;
  else if (activeFilter === 'BONGKAR') currentData = readyBongkarData;
  else if (activeFilter === 'SELESAI') currentData = selesaiData;

  // --- REUSABLE COMPONENTS ---

  const StatCard = ({ title, count, icon: Icon, color }: any) => (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white shadow-lg bg-${color}-500`}>
              <Icon className="w-7 h-7" />
          </div>
          <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{title}</h3>
              <p className="text-3xl font-black text-slate-800">{count}</p>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#FDF2F4] flex flex-col font-sans text-[#2D2D2D]">
        
        {/* HEADER */}
        <div className="bg-white/80 backdrop-blur-md border-b border-pink-100 px-8 py-5 flex justify-between items-center sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-sociolla-accent to-sociolla-pink rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-pink-200">
                    <Truck />
                </div>
                <div>
                    <h1 className="font-serif font-bold text-xl text-sociolla-dark tracking-wide">Traffic Control</h1>
                    <p className="text-[10px] text-sociolla-accent font-bold uppercase tracking-widest">Dock Management</p>
                </div>
            </div>
            <div className="flex gap-3">
                 <button className="p-2 text-slate-400 hover:text-sociolla-accent transition-colors"><Settings className="w-5 h-5"/></button>
            </div>
        </div>

        <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-8">
            
            {/* STATISTICS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="Antrian Masuk" 
                    count={verifikasiData.length} 
                    icon={Clock} 
                    color="yellow" 
                />
                <StatCard 
                    title="Proses Bongkar Muat" 
                    count={readyBongkarData.length} 
                    icon={Package} 
                    color="blue" 
                />
                <StatCard 
                    title="Selesai" 
                    count={selesaiData.length} 
                    icon={CheckCircle} 
                    color="green" 
                />
            </div>

            {/* FILTER TABS */}
            <div className="flex gap-4 border-b border-slate-200 pb-1 overflow-x-auto">
                <button 
                    onClick={() => setActiveFilter('VERIFIKASI')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 whitespace-nowrap
                        ${activeFilter === 'VERIFIKASI' 
                            ? 'text-yellow-600 border-b-4 border-yellow-500' 
                            : 'text-slate-400 hover:text-yellow-500'}`}
                >
                    Antrian Masuk (Verifikasi)
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'VERIFIKASI' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                        {verifikasiData.length}
                    </span>
                </button>

                <button 
                    onClick={() => setActiveFilter('BONGKAR')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 whitespace-nowrap
                        ${activeFilter === 'BONGKAR' 
                            ? 'text-blue-600 border-b-4 border-blue-500' 
                            : 'text-slate-400 hover:text-blue-500'}`}
                >
                    Ready Bongkar Muat
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'BONGKAR' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                        {readyBongkarData.length}
                    </span>
                </button>

                <button 
                    onClick={() => setActiveFilter('SELESAI')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wider transition-all relative flex items-center gap-2 whitespace-nowrap
                        ${activeFilter === 'SELESAI' 
                            ? 'text-emerald-600 border-b-4 border-emerald-500' 
                            : 'text-slate-400 hover:text-emerald-500'}`}
                >
                    Riwayat Selesai
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeFilter === 'SELESAI' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {selesaiData.length}
                    </span>
                </button>
            </div>

            {/* DATA TABLE */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-widest text-slate-500">
                                <th className="p-6 font-bold">No Truck</th>
                                <th className="p-6 font-bold">Driver</th>
                                <th className="p-6 font-bold">Muatan</th>
                                {/* Gate visible on Bongkar and Selesai */}
                                {(activeFilter === 'BONGKAR' || activeFilter === 'SELESAI') && <th className="p-6 font-bold">Gate</th>}
                                <th className="p-6 font-bold">{activeFilter === 'SELESAI' ? 'Waktu Selesai' : 'Waktu/Tanggal'}</th>
                                <th className="p-6 font-bold">Status</th>
                                {/* Action hidden for Selesai tab unless we want view detail later */}
                                <th className="p-6 font-bold text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {currentData.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            {activeFilter === 'VERIFIKASI' && <Clock className="w-12 h-12 mb-3 opacity-20"/>}
                                            {activeFilter === 'BONGKAR' && <Activity className="w-12 h-12 mb-3 opacity-20"/>}
                                            {activeFilter === 'SELESAI' && <CheckCircle className="w-12 h-12 mb-3 opacity-20"/>}
                                            <p className="font-bold text-lg">Tidak ada data saat ini.</p>
                                            <p className="text-sm">Silakan cek tab lain atau tunggu pembaruan.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentData.map((d) => (
                                    <tr key={d.id} className="hover:bg-pink-50/20 transition-colors group">
                                        {/* No Truck / Queue */}
                                        <td className="p-6">
                                            <span className={`text-lg font-black font-mono 
                                                ${activeFilter === 'VERIFIKASI' ? 'text-yellow-600' : 
                                                  activeFilter === 'BONGKAR' ? 'text-blue-600' : 'text-emerald-600'}`}>
                                                {d.queueNumber || '-'}
                                            </span>
                                        </td>

                                        {/* Driver */}
                                        <td className="p-6">
                                            <div className="font-bold text-slate-800">{d.name}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200">{d.licensePlate}</span>
                                                <span className="text-xs text-slate-500 truncate max-w-[120px]">{d.company}</span>
                                            </div>
                                        </td>

                                        {/* Muatan */}
                                        <td className="p-6">
                                            <div className="font-mono text-sm font-bold text-slate-700">{d.doNumber}</div>
                                            <div className={`inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${d.purpose === 'LOADING' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                                {d.purpose}
                                            </div>
                                        </td>

                                        {/* Gate (Conditional) */}
                                        {(activeFilter === 'BONGKAR' || activeFilter === 'SELESAI') && (
                                            <td className="p-6">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-slate-400"/>
                                                    <span className="font-bold text-slate-800">{d.gate.replace('_', ' ')}</span>
                                                </div>
                                            </td>
                                        )}

                                        {/* Waktu */}
                                        <td className="p-6">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Clock className="w-4 h-4 text-slate-400"/>
                                                <span className="font-bold text-sm">
                                                    {new Date(
                                                        activeFilter === 'SELESAI' ? (d.endTime || d.exitTime || Date.now()) :
                                                        activeFilter === 'VERIFIKASI' ? (d.verifiedTime || d.checkInTime) : 
                                                        (d.calledTime || d.loadingStartTime || Date.now())
                                                    ).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-1 pl-6 uppercase">
                                                {activeFilter === 'SELESAI' ? 'Completed At' : 
                                                 activeFilter === 'VERIFIKASI' ? 'Verified At' : 'Last Update'}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="p-6">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(d.status)}`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                {getStatusLabel(d.status)}
                                            </div>
                                        </td>

                                        {/* Action */}
                                        <td className="p-6 text-right">
                                            {activeFilter === 'VERIFIKASI' && (
                                                <button 
                                                    onClick={() => handleOpenAssign(d)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-sociolla-accent transition-colors shadow-lg hover:shadow-pink-200"
                                                >
                                                    PROSES <ArrowRight className="w-3 h-3"/>
                                                </button>
                                            )}

                                            {activeFilter === 'BONGKAR' && (
                                                <div className="flex justify-end gap-2">
                                                    {d.status === QueueStatus.CALLED && (
                                                        <>
                                                            <button 
                                                                onClick={() => window.open(`https://wa.me/${d.phone.replace(/^0/, '62')}?text=${encodeURIComponent(generateWATemplate(d))}`, '_blank')}
                                                                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                                                                title="WhatsApp"
                                                            >
                                                                <ExternalLink className="w-4 h-4"/>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleStatusUpdate(d.id, QueueStatus.LOADING)}
                                                                disabled={processingId === d.id}
                                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors flex items-center gap-2"
                                                            >
                                                                {processingId === d.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Truck className="w-3 h-3"/>}
                                                                MULAI
                                                            </button>
                                                        </>
                                                    )}
                                                    {d.status === QueueStatus.LOADING && (
                                                        <button 
                                                            onClick={() => handleStatusUpdate(d.id, QueueStatus.COMPLETED)}
                                                            disabled={processingId === d.id}
                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg hover:shadow-emerald-200"
                                                        >
                                                             {processingId === d.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <CheckCircle className="w-3 h-3"/>}
                                                             SELESAI
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {activeFilter === 'SELESAI' && (
                                                 <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                                                     Archived
                                                 </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Modal Logic for Call Confirmation */}
        {isModalOpen && selectedDriver && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2D2D2D]/60 backdrop-blur-md p-4 animate-fade-in-up">
                <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden border border-white">
                    <div className="bg-gradient-to-r from-sociolla-accent to-sociolla-pink p-6 flex justify-between items-center text-white">
                        <h3 className="font-serif font-bold text-xl flex items-center gap-2"><Megaphone/> KONFIRMASI PANGGILAN</h3>
                        <button onClick={() => setIsModalOpen(false)}><X/></button>
                    </div>
                    <div className="p-8">
                        <div className="mb-6 bg-pink-50 p-6 rounded-2xl border border-pink-100 text-center">
                             <h4 className="font-black text-2xl text-slate-800 mb-1">{selectedDriver.licensePlate}</h4>
                             <p className="text-slate-500 font-medium">{selectedDriver.name} • {selectedDriver.company}</p>
                        </div>
                        <p className="text-center text-slate-600 mb-6 px-4">
                            Pastikan Gate <strong>{selectedDriver.gate.replace('_', ' ')}</strong> tersedia sebelum memanggil driver. Notifikasi WhatsApp akan dikirim.
                        </p>
                        <button onClick={handleConfirmCall} disabled={loading || processingId === selectedDriver.id} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                            {processingId === selectedDriver.id ? <Loader2 className="w-5 h-5 animate-spin"/> : "PANGGIL SEKARANG"}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AdminDashboard;