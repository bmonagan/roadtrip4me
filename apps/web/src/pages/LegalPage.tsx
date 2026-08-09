import { Link } from 'react-router-dom';

export default function LegalPage({ kind }: { kind: 'terms' | 'privacy' }) {
  const isTerms = kind === 'terms';
  return (
    <div className="page legal">
      <h1>{isTerms ? 'Terms of Service' : 'Privacy Policy'}</h1>
      <p className="muted">
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>
      <div className="legal-body">
        {isTerms ? (
          <>
            <h2>1. The service</h2>
            <p>
              Roadtrip4me is a road-trip planning tool. It provides trip creation,
              route planning, community stop recommendations, AI-generated stop
              suggestions, and third-party links to accommodation providers.
            </p>
            <h2>2. Accounts</h2>
            <p>
              You are responsible for your account credentials and for activity
              under your account. You may delete your account and data at any
              time from the app.
            </p>
            <h2>3. User content</h2>
            <p>
              Content you submit (stops, votes, trips) is visible to the community
              as appropriate. You must not post unlawful, harmful, or infringing
              content. We may remove content that violates these terms.
            </p>
            <h2>4. AI-generated content</h2>
            <p>
              AI-generated stop suggestions are provided as-is and may be
              inaccurate. Do not rely on them for navigation or safety. Always
              verify locations and opening hours before travel.
            </p>
            <h2>5. Third-party links</h2>
            <p>
              We link to third-party services (e.g. accommodation booking sites).
              We are not responsible for their content or practices.
            </p>
            <h2>6. Limitation of liability</h2>
            <p>
              The service is provided “as is” without warranties. We are not
              liable for damages arising from use of the service, including
              travel decisions made using it.
            </p>
            <h2>7. Changes</h2>
            <p>
              We may update these terms. Continued use after changes constitutes
              acceptance. Contact us with questions via the app or repository.
            </p>
          </>
        ) : (
          <>
            <h2>1. Data we collect</h2>
            <p>
              When you create an account we store your email, display name, and
              the content you create (trips, stops, votes, waypoints, saved
              stops). We use Auth0 for authentication; your login credentials are
              handled by Auth0, not stored by us.
            </p>
            <h2>2. How we use data</h2>
            <p>
              Your data is used to operate the service (e.g. show your trips,
              route recommendations, votes) and to contact you about your
              account. We may use aggregated, non-identifying data for product
              improvement.
            </p>
            <h2>3. Third-party services</h2>
            <p>
              We call Google Maps (Routes and Places), DeepSeek, and Mapbox to
              provide routing, geocoding, map, and recommendation features.
              These providers process place and query data as described in their
              privacy policies. Our AI recommendation requests include your trip
              origin/destination and preferences.
            </p>
            <h2>4. Cookies and storage</h2>
            <p>
              We use browser local storage to remember your session and
              preferences. We do not set advertising cookies.
            </p>
            <h2>5. Your rights</h2>
            <p>
              You can export or delete your data at any time. Deleting your
              account (Data deletion) permanently removes your account and owned
              data; community stops you submitted are unlinked but remain part of
              the community.
            </p>
            <h2>6. Data retention</h2>
            <p>
              We retain your data while your account is active. Upon account
              deletion, owned data is removed.
            </p>
            <h2>7. Contact</h2>
            <p>
              Privacy questions can be directed to the project maintainers via
              the repository.
            </p>
          </>
        )}
      </div>
      <p className="muted">
        This is a template for review — have it checked by a legal professional
        before launch. See <Link to="/terms">Terms</Link> and{' '}
        <Link to="/privacy">Privacy</Link>.
      </p>
    </div>
  );
}
