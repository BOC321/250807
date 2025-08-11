import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName } = req.query;
    
    if (!fileName) {
      return res.status(400).json({ error: 'Missing fileName parameter' });
    }

    console.log('Serving report file:', fileName);

    // Download the file from Supabase storage
    const { data, error } = await supabase.storage
      .from('survey-reports')
      .download(fileName);
    
    if (error) {
      console.error('Error downloading file:', error);
      return res.status(404).json({ error: 'File not found' });
    }

    console.log('File downloaded successfully, size:', data.size);

    // Convert the blob to a buffer
    const buffer = Buffer.from(await data.arrayBuffer());

    // Log the first few characters of the PDF to verify it's a PDF
    console.log('PDF header:', buffer.subarray(0, 10).toString());

    // Extract metadata from the PDF if possible
    try {
      const pdfText = buffer.toString('latin1');
      const reportIdMatch = pdfText.match(/Report ID: ([^\s\n]+)/);
      if (reportIdMatch) {
        console.log('Report ID from PDF:', reportIdMatch[1]);
      }
      
      const generatedOnMatch = pdfText.match(/Generated on: ([^\n]+)/);
      if (generatedOnMatch) {
        console.log('Generated on from PDF:', generatedOnMatch[1]);
      }
    } catch (extractError) {
      console.error('Error extracting metadata from PDF:', extractError);
    }

    // Set cache-control headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    
    // Send the file
    return res.send(buffer);
  } catch (error) {
    console.error('Error serving report:', error);
    return res.status(500).json({ error: error.message });
  }
}