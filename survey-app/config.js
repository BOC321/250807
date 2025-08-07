// config.js - Configuration file with environment variables

module.exports = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://maouzhwsyjsqexhzdzth.supabase.co',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hb3V6aHdzeWpzcWV4aHpkenRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDc0NjAsImV4cCI6MjA2OTY4MzQ2MH0.I_AdXS4fLTaU6UOl8NTSK7UeyI_JwSTHraDsNP6X_Ck',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hb3V6aHdzeWpzcWV4aHpkenRoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDEwNzQ2MCwiZXhwIjoyMDY5NjgzNDYwfQ.aAjlhjytziRL1ABfeQRjIn1jzm2U6fJE9GMZ6_LR_wE',
  mailerooApiKey: process.env.MAILEROO_API_KEY || 'b651cb51e03497b3942e72bb395027fb2ed1677cf644bd407997227055be1fb2',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
};
