import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

// --- CONFIGURATION ---
// PERBAIKAN: Hapus fallback string panjang. Wajib baca dari process.env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validasi Credentials sebelum lanjut
if (!supabaseUrl || !supabaseKey) {
  throw new Error("CRITICAL: Missing Supabase Credentials in Environment Variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

// --- UTILITIES: CASE CONVERSION ---
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const mapKeys = (obj: any, fn: (key: string) => string): any => {
  if (Array.isArray(obj)) return obj.map(i => mapKeys(i, fn));
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      acc[fn(key)] = mapKeys(obj[key], fn);
      return acc;
    }, {} as any);
  }
  return obj;
};

// --- API HANDLER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', "true");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, table = 'drivers', data } = req.body;

  // Security Whitelist Tables
  const ALLOWED_TABLES = ['drivers', 'users', 'gates', 'logs', 'divisions'];
  if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({ error: `Table '${table}' is not allowed.` });
  }

  try {
    // --- READ (GET) ---
    if (action === 'GET') {
      let query = supabase.from(table).select('*');

      if (table === 'drivers') {
          query = query.order('check_in_time', { ascending: false }).limit(500);
      } else if (table === 'logs') {
          query = query.order('created_at', { ascending: false }).limit(100);
      } else {
          query = query.order('id', { ascending: true });
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const formatted = mapKeys(rows, toCamelCase);
      return res.status(200).json(formatted);
    }

    // --- CREATE ---
    if (action === 'CREATE') {
      let payload = { ...data };

      // Upload Gambar Base64 ke Storage (Jika ada)
      if (payload.documentFile && typeof payload.documentFile === 'string' && payload.documentFile.startsWith('data:')) {
        try {
           const base64Data = payload.documentFile.split(',')[1];
           const buffer = Buffer.from(base64Data, 'base64');
           const fileName = `SJ_${payload.id || Date.now()}_${Date.now()}.jpg`;

           const { error: uploadError } = await supabase.storage
             .from('documents')
             .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

           if (uploadError) throw uploadError;

           const { data: publicUrlData } = supabase.storage
             .from('documents')
             .getPublicUrl(fileName);

           payload.documentFile = publicUrlData.publicUrl;
        } catch (err) {
           console.error("Storage Upload Error:", err);
           payload.documentFile = null;
        }
      }

      const dbPayload = mapKeys(payload, toSnakeCase);
      const { error } = await supabase.from(table).insert([dbPayload]);
      if (error) throw error;

      return res.status(200).json({ success: true, fileUrl: payload.documentFile });
    }

    // --- UPDATE ---
    if (action === 'UPDATE') {
      const payload = { ...data };
      const dbPayload = mapKeys(payload, toSnakeCase);
      const { id, ...updateFields } = dbPayload;

      if (!id) throw new Error("ID is required for UPDATE");

      const { error } = await supabase.from(table).update(updateFields).eq('id', id);
      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    // --- DELETE ---
    if (action === 'DELETE') {
        if (!data.id) throw new Error("ID is required for DELETE");
        const { error } = await supabase.from(table).delete().eq('id', data.id);
        if (error) throw error;

        return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid Action' });

  } catch (error: any) {
    console.error(`Supabase API Error [${table}]:`, error);
    return res.status(500).json({ error: error.message });
  }
}
