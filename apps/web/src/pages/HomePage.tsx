import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="landing-hero">
      <div className="landing-hero-inner">
        <div>
          <span className="landing-badge">✨ New: AI Planner</span>
          <h1 className="landing-title">
            The Open Road,
            <br />
            <span className="accent">Reimagined by AI.</span>
          </h1>
          <p className="landing-sub">
            Skip the spreadsheets. Tell us where you want to go, and let our AI plan the perfect
            adventure — finding the best scenic detours along the way.
          </p>
          <div className="landing-cta">
            <Link to="/trips" className="btn primary">
              Start Your Journey →
            </Link>
            <Link to="/stops" className="btn">
              Browse community stops
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <img
            src="/hero.jpg"
            alt="A vibrant camper van driving along a sun-drenched coastal road"
          />
          <div className="hero-glass">
            <div>
              <h3>Pacific Coast Highway</h3>
              <p>
                <span>⏱ 5 Days</span>
                <span>|</span>
                <span>🛣 450 miles</span>
              </p>
            </div>
            <button className="hero-play" type="button" aria-label="Play">
              ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
