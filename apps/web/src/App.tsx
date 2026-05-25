import { Routes, Route } from 'react-router-dom';

function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🚗 Roadtrip4me</h1>
      <p>Plan your perfect road trip.</p>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}
