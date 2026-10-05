import { Routes, Route } from 'react-router-dom'
import Landing        from './pages/Landing'
import Login          from './pages/Login'
import Register       from './pages/Register'
import Dashboard      from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout      from './components/layout/AppLayout'

/* Lightweight placeholder for Phase-2 pages */
function ComingSoon({ title }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: '0.75rem',
      color: 'var(--text-secondary)',
    }}>
      <span style={{ fontSize: '2.5rem' }}>🚧</span>
      <h2 style={{ color: 'var(--text-primary)' }}>{title}</h2>
      <p>This section is under construction. Check back soon!</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"         element={<Landing />}  />
      <Route path="/login"    element={<Login />}    />
      <Route path="/register" element={<Register />} />

      {/* Protected shell */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/markets"     element={<ComingSoon title="Markets" />} />
        <Route path="/stocks"      element={<ComingSoon title="Stocks" />} />
        <Route path="/watchlist"   element={<ComingSoon title="Watchlist" />} />
        <Route path="/compare"     element={<ComingSoon title="Compare" />} />
        <Route path="/predictions" element={<ComingSoon title="Predictions" />} />
      </Route>
    </Routes>
  )
}