import { useState } from 'react';

const CONSENT_KEY = 'roadtrip4me.cookie_consent';

export default function CookieConsent() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(CONSENT_KEY) === '1'
  );

  if (dismissed) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <p>
        We use local storage for your session and preferences, and third-party
        services (Mapbox, Google, DeepSeek) to power maps, routing, and AI
        recommendations. See our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>
      <button type="button" className="btn small primary" onClick={accept}>
        Got it
      </button>
    </div>
  );
}
