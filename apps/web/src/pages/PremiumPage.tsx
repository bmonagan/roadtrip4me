import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../lib/api';

export default function PremiumPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: billing, isLoading, isError } = useQuery({
    queryKey: ['billing/status'],
    queryFn: () => api.billing.status(),
    enabled: !!isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.billing.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing/status'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  const checkout = useMutation({
    mutationFn: () => api.billing.checkout(),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
  });

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      try {
        await cancelMutation.mutateAsync();
      } catch (e) {
        const err = e as ApiError;
        alert(err.message);
      }
    }
  };

  return (
    <div className="page">
      <h1>Premium</h1>

      {!isAuthenticated ? (
        <div className="premium-page">
          <div className="premium-status premium-free">
            <p>Log in or create an account to go Premium and unlock unlimited trips, stops, AI recommendations, and collaborations.</p>
          </div>
          <div className="premium-actions">
            <Link to="/login" className="btn primary">Log in</Link>
            <Link to="/signup" className="btn">Create an account</Link>
          </div>
        </div>
      ) : isLoading ? (
        <p>Loading...</p>
      ) : isError ? (
        <p className="error">Unable to load subscription status. Please try again later.</p>
      ) : billing?.isPremium ? (
        <div className="premium-page">
          <div className="premium-status premium-active">
            <span className="badge premium">Active Subscription</span>
            <p>You have unlimited trips, stops, AI recommendations, and collaborations.</p>
          </div>
          <button
            type="button"
            className="btn danger"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
          </button>
        </div>
      ) : (
        <div className="premium-page">
          <div className="premium-status premium-free">
            <p>You are on the <strong>Free</strong> plan.</p>
            <ul className="premium-limits">
              <li>Up to 3 trips</li>
              <li>Up to 5 stops per trip</li>
              <li>No AI recommendations</li>
              <li>No trip collaborations</li>
            </ul>
          </div>
          <div className="premium-upgrade">
            <h2>Upgrade to Premium</h2>
            <ul className="premium-benefits">
              <li>Unlimited trips</li>
              <li>Unlimited stops per trip</li>
              <li>AI-powered stop recommendations</li>
              <li>Collaborative trip planning</li>
            </ul>
            <button
              type="button"
              className="btn primary"
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending}
            >
              {checkout.isPending ? 'Redirecting...' : 'Upgrade Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
