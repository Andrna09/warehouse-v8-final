import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { target, message } = req.body;

  // PERBAIKAN: Baca Token dari Environment Variable (Aman)
  // Jangan pernah tulis token asli di sini!
  const token = process.env.FONNTE_TOKEN;

  // Cek apakah token ada di setting Vercel
  if (!token) {
    console.error("Fonnte Token is missing in Environment Variables");
    return res.status(500).json({ error: 'Server configuration error: Missing WA Token' });
  }

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: target, // Nomor HP atau Group ID
        message: message,
        countryCode: '62', // Default Indonesia
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('WhatsApp Error:', error);
    return res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
}
