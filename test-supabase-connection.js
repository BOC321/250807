const { createClient } = require('@supabase/supabase-js');

// Test the Supabase connection with the new publishable key format
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl ? 'Present' : 'Missing');
console.log('Key:', supabaseAnonKey ? 'Present' : 'Missing');
console.log('Key format:', supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'N/A');

if (supabaseUrl && supabaseAnonKey) {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test a simple query to check if the connection works
    supabase.from('surveys').select('count', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) {
          console.error('Connection test failed:', error.message);
        } else {
          console.log('Connection successful! Found', count, 'surveys');
        }
      })
      .catch(err => {
        console.error('Connection test error:', err.message);
      });
  } catch (error) {
    console.error('Failed to create Supabase client:', error.message);
  }
} else {
  console.error('Environment variables are missing!');
}
