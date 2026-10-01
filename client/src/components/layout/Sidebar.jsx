import { NavLink } from 'react-router-dom';
import { LayoutDashboard, LineChart, List, Settings } from 'lucide-react';

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <LineChart size={24} className="brand-icon" />
        <h2>StockPredictor</h2>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className="nav-item">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/compare" className="nav-item">
          <List size={20} />
          <span>Compare</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item text-muted">
          <Settings size={20} />
          <span>Settings</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
