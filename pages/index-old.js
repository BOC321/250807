// pages/index.js - Simple test page

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export default function Home() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSurveys();
  }, []);

  async function fetchSurveys() {
    if (!supabase) {
      setError('Database connection not available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('surveys')
        .select('*');
      
      if (error) {
        setError(error.message);
      } else {
        setSurveys(data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container"><h1>Loading...</h1></div>;
  if (error) return <div className="container"><h1>Error: {error}</h1></div>;

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Survey Application</h1>
      <p>Welcome to your survey application!</p>
      
      <h2>Available Surveys</h2>
      {surveys.length === 0 ? (
        <p>No surveys found. Create your first survey!</p>
      ) : (
        <ul>
          {surveys.map((survey) => (
            <li key={survey.id}>
              <h3>{survey.title}</h3>
              <p>{survey.description}</p>
              <p>Status: {survey.status}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
