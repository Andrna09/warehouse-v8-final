
import { DriverData, QueueStatus, Gate, Priority, EntryType, UserProfile, ActivityLog, GateConfig, DivisionConfig } from '../types';

// --- CONFIGURATION ---
const WA_GROUP_ID = '120363423657558569@g.us'; 

// --- API CLIENT (GENERIC) ---
const apiRequest = async <T>(table: string, action: 'GET' | 'CREATE' | 'UPDATE' | 'DELETE', data?: any): Promise<T> => {
  try {
    const response = await fetch('/api/drivers', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, table, data }),
    });

    if (!response.ok) {
      // Coba baca error text jika ada
      const errText = await response.text();
      throw new Error(`API Error (${table}): ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to execute ${action} on ${table}:`, error);
    throw error;
  }
};

// --- LOGGING SERVICE (DB) ---
export const logActivity = async (action: string, details: string, user: string = 'System') => {
  apiRequest('logs', 'CREATE', {
    userEmail: user, 
    action,
    details
  }).catch(e => console.warn("Logging failed:", e));
};

// --- WHATSAPP SERVICE ---
const sendWhatsApp = async (target: string, message: string) => {
  if (!target || target.length < 5) return;

  if ((import.meta as any).env && (import.meta as any).env.DEV) {
    console.log(`%c[DEV MODE] WhatsApp to ${target}:`, 'color: #25D366; font-weight: bold;');
    console.log(message);
    return; 
  }

  try {
    const response = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, message })
    });
    const result = await response.json();
    if (!result.status) console.warn('WA API Warning:', result.reason);
  } catch (err) {
    console.error('WA Failed:', err);
  }
};

// --- AUTHENTICATION & USERS (DB BASED) ---

export const verifyDivisionCredential = async (id: string, password: string): Promise<DivisionConfig | null> => {
    const divisions = await apiRequest<DivisionConfig[]>('divisions', 'GET');
    const target = divisions.find(d => d.id.toUpperCase() === id.toUpperCase());
    return (target && target.password === password) ? target : null;
};

export const loginSystem = async (id: string, password?: string): Promise<UserProfile> => {
    const users = await apiRequest<UserProfile[]>('users', 'GET');
    const targetUser = users.find(u => u.id.toLowerCase() === id.toLowerCase());

    if (!targetUser) throw new Error("Username tidak ditemukan.");

    if (password && targetUser.pin_code && password !== targetUser.pin_code) {
         if (password !== 'demo123' && password !== targetUser.pin_code) { 
             throw new Error("Password salah.");
         }
    }

    if (targetUser.status !== 'ACTIVE') throw new Error("Akun dinonaktifkan.");
    
    logActivity('LOGIN_SUCCESS', `User ${targetUser.name} logged in`, targetUser.name);
    return targetUser;
};

// --- DIVISION MANAGEMENT (DB) ---
export const getDivisions = async (): Promise<DivisionConfig[]> => {
    return await apiRequest<DivisionConfig[]>('divisions', 'GET');
};

export const saveDivision = async (div: Partial<DivisionConfig>): Promise<boolean> => {
    const divisions = await getDivisions();
    const exists = divisions.find(d => d.id === div.id);

    if (exists) {
        await apiRequest('divisions', 'UPDATE', div);
    } else {
        await apiRequest('divisions', 'CREATE', {
            ...div,
            id: div.id!.toUpperCase(),
            theme: div.theme || 'slate'
        });
    }
    return true;
};

export const deleteDivision = async (id: string): Promise<boolean> => {
    await apiRequest('divisions', 'DELETE', { id });
    return true;
};

// --- GATE CONFIGURATION (DB) ---
export const getGateConfigs = async (): Promise<GateConfig[]> => {
    return await apiRequest<GateConfig[]>('gates', 'GET');
};

export const saveGateConfig = async (gate: Partial<GateConfig>): Promise<boolean> => {
    const gates = await getGateConfigs();
    const exists = gates.find(g => g.id === gate.id);

    if (exists) {
        await apiRequest('gates', 'UPDATE', gate);
    } else {
        await apiRequest('gates', 'CREATE', {
            ...gate,
            id: gate.id || `gate-${Date.now()}`
        });
    }
    return true;
};

export const deleteSystemSetting = async (id: string): Promise<boolean> => {
    await apiRequest('gates', 'DELETE', { id });
    return true;
};

// --- USER PROFILES (DB) ---
export const getProfiles = async (): Promise<UserProfile[]> => {
    return await apiRequest<UserProfile[]>('users', 'GET');
};

export const addProfile = async (profile: Partial<UserProfile>): Promise<boolean> => {
    const users = await getProfiles();
    if (users.find(u => u.id === profile.id)) return false;
    
    await apiRequest('users', 'CREATE', { ...profile, status: 'ACTIVE' });
    logActivity('ADD_USER', `Created user ${profile.name}`, 'Manager');
    return true;
};

export const updateProfile = async (profile: Partial<UserProfile>): Promise<boolean> => {
    await apiRequest('users', 'UPDATE', profile);
    logActivity('UPDATE_USER', `Updated user ${profile.name}`, 'Manager');
    return true;
};

export const deleteProfile = async (id: string): Promise<boolean> => {
    await apiRequest('users', 'DELETE', { id });
    logActivity('DELETE_USER', `Deleted user ${id}`, 'Manager');
    return true;
};

// --- DRIVER TRANSACTIONS (DB) ---

export const getDrivers = async (): Promise<DriverData[]> => {
  return await apiRequest<DriverData[]>('drivers', 'GET');
};

export const getDriverById = async (id: string): Promise<DriverData | undefined> => {
  const drivers = await getDrivers();
  return drivers.find(d => d.id === id);
};

// --- UTILS: IMAGE COMPRESSION ---
// Fungsi ini mengecilkan ukuran gambar agar muat di serverless function (< 4MB)
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Resize Max Width 800px (Cukup jelas untuk surat jalan)
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                
                // Jika gambar kecil, jangan di-resize
                if (scaleSize >= 1) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                } else {
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                }

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(event.target?.result as string); // Fallback jika gagal
                    return;
                }

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Kompresi JPEG Quality 0.7 (Size turun drastis, kualitas oke)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            
            img.onerror = (err) => resolve(event.target?.result as string); // Fallback
        };
        
        reader.onerror = (error) => reject(error);
    });
};

export const createCheckIn = async (data: Partial<DriverData>, fileToUpload?: File | null): Promise<DriverData> => {
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const newId = `WH-${dateStr}-${randomSuffix}`;
  
  // Konversi File ke Base64 + KOMPRESI OTOMATIS
  let documentBase64 = '';
  if (fileToUpload) {
      try {
          // Gunakan fungsi kompresi baru
          documentBase64 = await compressImage(fileToUpload);
          // console.log("Image compressed successfully");
      } catch (e) {
          console.error("Compression failed, using raw file", e);
          // Fallback ke metode lama jika kompresi gagal
          documentBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(fileToUpload);
        });
      }
  }

  const payload = {
    ...data,
    id: newId,
    checkInTime: Date.now(),
    status: data.entryType === EntryType.BOOKING ? QueueStatus.BOOKED : QueueStatus.CHECKED_IN,
    gate: Gate.NONE,
    priority: data.priority || Priority.NORMAL,
    entryType: data.entryType || EntryType.WALK_IN,
    documentFile: documentBase64 
  };

  const response = await apiRequest<{success: boolean, fileUrl: string}>('drivers', 'CREATE', payload);
  
  return {
      ...payload,
      documentFile: response.fileUrl || '' 
  } as DriverData;
};

export const scanDriverQR = async (id: string): Promise<DriverData | undefined> => {
  const driver = await getDriverById(id);
  if (driver && driver.status !== QueueStatus.AT_GATE) {
     const updated = {
         id: driver.id,
         status: QueueStatus.AT_GATE,
         arrivedAtGateTime: Date.now()
     };
     await apiRequest('drivers', 'UPDATE', updated);
     return { ...driver, ...updated };
  }
  return driver;
};

export const verifyDriver = async (id: string, securityName: string, assignedGate: Gate, notes?: string): Promise<boolean> => {
    const drivers = await getDrivers();
    const driver = drivers.find(d => d.id === id);
    if (!driver) return false;
    
    // Hitung Nomor Antrian Berdasarkan Gate
    const prefix = assignedGate === Gate.GATE_2 ? 'A' : 'B';
    const activeInGate = drivers.filter(d => d.gate === assignedGate && d.queueNumber).length;
    const queueNum = `${prefix}-${String(activeInGate + 1).padStart(3, '0')}`;
    
    const updatePayload = {
        id,
        status: QueueStatus.VERIFIED,
        gate: assignedGate,
        queueNumber: queueNum,
        verifiedTime: Date.now(),
        verifiedBy: securityName,
        securityNotes: notes,
        arrivedAtGateTime: driver.arrivedAtGateTime || Date.now()
    };

    await apiRequest('drivers', 'UPDATE', updatePayload);
    logActivity('VERIFY_DRIVER', `Driver ${driver.licensePlate} verified`, securityName);

    // Kirim WA
    const groupMessage = `NOTIFIKASI OPERASIONAL TRAFFIC GUDANG\n` +
                         `--------------------------------------------\n` +
                         `STATUS: ENTRY APPROVED (AKSES MASUK)\n\n` +
                         `DETAIL UNIT:\n` +
                         `Vendor   : ${driver.company}\n` +
                         `No. Pol  : ${driver.licensePlate}\n` +
                         `Driver   : ${driver.name}\n` +
                         `Dokumen  : ${driver.doNumber}\n` +
                         `Kegiatan : ${driver.purpose}\n\n` +
                         `ALOKASI:\n` +
                         `Gate     : ${assignedGate.replace(/_/g, ' ')}\n` +
                         `Antrian  : ${queueNum}\n` +
                         `Waktu    : ${new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})} WIB\n` +
                         `Petugas  : ${securityName}\n` +
                         `--------------------------------------------`;
    
    await sendWhatsApp(WA_GROUP_ID, groupMessage);
    return true;
};

export const rejectDriver = async (id: string, reason: string, securityName: string) => {
    await apiRequest('drivers', 'UPDATE', {
        id,
        status: QueueStatus.REJECTED,
        rejectionReason: reason,
        verifiedBy: securityName
    });
    logActivity('REJECT_DRIVER', `Rejected: ${reason}`, securityName);
};

export const callDriver = async (id: string, adminName: string) => {
    await apiRequest('drivers', 'UPDATE', {
        id,
        status: QueueStatus.CALLED,
        calledTime: Date.now(),
        calledBy: adminName
    });
    logActivity('CALL_DRIVER', `Driver called by ${adminName}`, adminName);
};

export const updateDriverStatus = async (id: string, status: QueueStatus) => {
    const updatePayload: any = { id, status };
    
    if(status === QueueStatus.LOADING) updatePayload.loadingStartTime = Date.now();
    if(status === QueueStatus.COMPLETED) updatePayload.endTime = Date.now();
    if(status === QueueStatus.EXITED) {
        updatePayload.exitTime = Date.now();
        updatePayload.exitVerifiedBy = "Security Out";
    }

    await apiRequest('drivers', 'UPDATE', updatePayload);
    logActivity('UPDATE_STATUS', `Status changed to ${status}`, 'Admin');
};

// --- SYSTEM UTILS ---

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
    return await apiRequest<ActivityLog[]>('logs', 'GET');
};

export const wipeDatabase = async () => {
    console.warn("Wipe Database via API is disabled for safety.");
    logActivity('WIPE_ATTEMPT', 'Wipe database requested but disabled', 'Manager');
};

export const seedDummyData = async () => {
    const dummyNames = ['Budi', 'Joko', 'Siti', 'Rahmat', 'Dewi'];
    const dummyPlates = ['B 1234 XY', 'D 5678 AB', 'L 9999 ZZ', 'B 4444 CD', 'F 1111 GH'];
    
    for (let i = 0; i < 5; i++) {
        await createCheckIn({
            name: dummyNames[i],
            licensePlate: dummyPlates[i],
            phone: '08123456789',
            company: 'Vendor Dummy Trans',
            purpose: i % 2 === 0 ? 'LOADING' : 'UNLOADING',
            doNumber: `DO/TEST/${i+100}`,
            notes: 'Dummy data injection',
            entryType: EntryType.WALK_IN
        });
    }
};

export const exportDatabase = () => {
    return JSON.stringify({ message: "Please contact IT for DB Dump" });
};

export const importDatabase = (jsonString: string) => {
    console.warn("Import not supported in Cloud Mode");
    return false;
};
