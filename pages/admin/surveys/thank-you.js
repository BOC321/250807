import { useRouter } from 'next/router';

export default function ThankYouPage() {
  const router = useRouter();

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1>Thank You!</h1>
      <p style={{ marginBottom: '2rem', fontSize: '1.2rem' }}>
        Your response has been submitted successfully.
      </p>
      <button
        onClick={() => router.push('/')}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Return to Home
      </button>
    </div>
  );
}
