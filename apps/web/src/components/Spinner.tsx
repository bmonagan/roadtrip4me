import type { ReactNode } from 'react';

interface SpinnerProps {
  size?: number;
  children?: ReactNode;
}

export default function Spinner({ size = 24, children }: SpinnerProps) {
  return (
    <div className="spinner-wrapper">
      <span className="spinner" style={{ width: size, height: size }} />
      {children}
    </div>
  );
}
