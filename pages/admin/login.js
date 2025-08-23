import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [envStatus, setEnvStatus] = useState('Checking...');
  const [supabaseConfig, setSupabaseConfig] = useState(null);
  const router = useRouter();

  // Fetch Supabase configuration from API endpoint
  useEffect(() => {
    const fetchSupabaseConfig = async () => {
      try {
        const response = await fetch('/api/supabase-config');
        const data = await response.json();
        
        if (response.ok && data.supabaseUrl && data.supabaseAnonKey) {
          setSupabaseConfig(data);
          setEnvStatus('✅ Supabase configuration available');
        } else {
          setEnvStatus('❌ Supabase configuration not available');
          console.error('Supabase config error:', data);
        }
      } catch (err) {
        setEnvStatus('❌ Failed to fetch Supabase configuration');
        console.error('Error fetching Supabase config:', err);
      }
    };
    
    fetchSupabaseConfig();
  }, []);

  // Create Supabase client with proper environment variable handling
  const getSupabaseClient = () => {
    // Use the fetched configuration from the API
    if (supabaseConfig && supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey) {
      try {
        return createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey);
      } catch (err) {
        console.error('Error creating Supabase client with API config:', err);
        return null;
      }
    }
    
    // Fallback to environment variables if API config is not available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase configuration not available from API or environment variables');
      return null;
    }
    
    try {
      return createClient(supabaseUrl, supabaseAnonKey);
    } catch (err) {
      console.error('Error creating Supabase client with environment variables:', err);
      return null;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase client not initialized. Please check environment variables.');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push('/admin/dashboard');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Login
          </h2>
          <p className="text-center text-sm text-gray-600">{envStatus}</p>
        </div>
        <form onSubmit={handleLogin} className="mt-8 space-y-6" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 rounded-t-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 rounded-b-md placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && <p className="text-red-500 text-xs italic">{error}</p>}
        </form>
      </div>
    </div>
  );
}
