import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function SignupPage() {
  const { authMode, signup } = useAuth();

  if (authMode === 'auth0') {
    return (
      <div className="page">
        <h1>Create an account</h1>
        <p className="muted">
          Sign up to save trips, add stops, and vote on the road trip community.
        </p>
        <button type="button" className="btn primary" onClick={signup}>
          Continue to sign up
        </button>
        <p className="muted">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Create an account</h1>
      <p className="muted">
        Authentication is running in development mode. Sign up is not available —
        pick an identity on the login page instead.
      </p>
    </div>
  );
}
