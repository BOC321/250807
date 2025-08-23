// test-supabase.js - Simple test script to verify Supabase connection

const config = require('./config');
const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = config.supabaseUrl;
const supabaseAnonKey = config.supabaseAnonKey;

// Log the variables to make sure they're loaded
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey);

// Check if we have valid values
if (supabaseUrl === 'YOUR_SUPABASE_URL_HERE' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  console.log('⚠️  Please update the config.js file with your actual Supabase credentials');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Try a simple query to test the connection
    const { data, error } = await supabase
      .from('surveys')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('Connection test failed with error:', error);
      return false;
    }
    
    console.log('Connection test successful!');
    console.log('Survey table query result:', data);
    return true;
  } catch (err) {
    console.log('Connection test failed with exception:', err.message);
    return false;
  }
}

// Run the test
testConnection().then(success => {
  if (success) {
    console.log('✅ Supabase connection is working correctly!');
  } else {
    console.log('❌ Supabase connection failed. Please check your configuration.');
  }
});
