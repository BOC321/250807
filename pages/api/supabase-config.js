export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ 
        error: 'Environment variables not configured',
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey
      });
    }
    
    return res.status(200).json({
      supabaseUrl,
      supabaseAnonKey
    });
  } catch (error) {
    console.error('Error in supabase-config API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
