import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '65vh',
      gap: '1rem',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <FileQuestion size={64} className="muted" style={{ color: 'var(--primary)', opacity: 0.8 }} />
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800 }}>404 - Page Not Found</h1>
      <p className="muted" style={{ maxWidth: '450px' }}>
        Oops! The page you are looking for does not exist or has been moved.
      </p>
      <button className="btn-primary btn-large" onClick={() => navigate('/dashboard')} style={{ marginTop: '0.5rem' }}>
        <Home size={18} /> Back to Dashboard
      </button>
    </div>
  );
}
