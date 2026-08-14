import Spinner from './Spinner';

interface LoadingBannerProps {
  message?: string;
}

export default function LoadingBanner({ message = 'Loading…' }: LoadingBannerProps) {
  return (
    <div className="loading-banner">
      <Spinner size={32} />
      <p className="muted">{message}</p>
    </div>
  );
}
