import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';
import './Layout.css';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="app-main">
        <Topbar onMenuToggle={() => setSidebarOpen((p) => !p)} />

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
