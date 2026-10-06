import { Routes, Route } from 'react-router-dom';
import Landing        from './pages/Landing';
import Login          from './pages/Login';
import Register       from './pages/Register';
import Dashboard      from './pages/Dashboard';
import Compare        from './pages/Compare';
import Watchlist      from './pages/Watchlist';
import Prediction     from './pages/Prediction';
import Market          from './pages/Market';
import Screener       from './pages/Screener';
import Portfolio      from './pages/Portfolio';
import Stocks         from './pages/Stocks';
import NotFound       from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout      from './components/layout/AppLayout';

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/"         element={<Landing />}  />
      <Route path="/login"    element={<Login />}    />
      <Route path="/register" element={<Register />} />

      {/* Protected application shell */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/markets"     element={<Market />} />
        <Route path="/stocks"      element={<Stocks />} />
        <Route path="/screener"    element={<Screener />} />
        <Route path="/watchlist"   element={<Watchlist />} />
        <Route path="/portfolio"   element={<Portfolio />} />
        <Route path="/compare"     element={<Compare />} />
        <Route path="/prediction"  element={<Prediction />} />
        <Route path="/predictions" element={<Prediction />} />
        <Route path="*"            element={<NotFound />} />
      </Route>
    </Routes>
  );
}