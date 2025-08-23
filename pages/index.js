import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/admin/login');
  }, []);

  return <div>Redirecting to admin login...</div>;
}
