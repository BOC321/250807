// pages/api/reports/serve.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fail fast if misconfigured
if (!supabaseUrl || !serviceRoleKey) {
  // Note: Next.js will evaluate this once on load
  console.error('Missing Supabase configuration for /api/reports/serve');
}

const supabase = createClient(supabaseUrl || '', serviceRoleKey || '');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { fileName } = req.query;

    // Normalise query value to a string
    if (Array.isArray(fileName)) fileName = fileName[0];

    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid fileName parameter' });
    }

    // Basic validation to avoid malformed keys
    if (fileName.startsWith('/') || fileName.includes('..') || fileName.trim() === '') {
      return res.status(400).json({ error: 'Invalid fileName parameter' });
    }

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server misconfiguration (Supabase env vars missing)' });
    }

    console.log('Serving report file:', fileName);

    // Download the PDF from the private bucket
    const { data, error } = await supabase.storage
      .from('survey-reports')
      .download(fileName);

    if (error || !data) {
      console.error('Error downloading file:', error);
      return res.status(404).json({ error: 'File not found' });
    }

    // Convert Blob -> Buffer for Node response
    const buffer = Buffer.from(await data.arrayBuffer());

    // Security + no-cache for dynamic content
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);

    return res.status(200).send(buffer);
  } catch (err) {
    console.error('Error serving report:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
