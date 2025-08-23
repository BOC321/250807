import { useRouter } from 'next/router';
import { useEffect } from 'react';

export default function ThankYouPage() {
  const router = useRouter();

  useEffect(() => {
    // Get the survey ID from the query parameters
    const { surveyId } = router.query;
    
    // If we have a survey ID, redirect to the results page after a short delay
    if (surveyId) {
      const timer = setTimeout(() => {
        router.push(`/surveys/results/${surveyId}`);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [router]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1>Thank You!</h1>
      <p style={{ marginBottom: '2rem', fontSize: '1.2rem' }}>
        Your response has been submitted successfully.
      </p>
      <p>You will be redirected to the survey results page in a few seconds...</p>
      <button
        onClick={() => router.push('/surveys')}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '1rem'
        }}
      >
        Return to Surveys
      </button>
    </div>
  );
}
