import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  SlidersHorizontal,
  BookMarked,
  BriefcaseBusiness,
  GitCompareArrows,
  BrainCircuit,
  LineChart,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Markets',
    items: [
      { to: '/markets',   icon: TrendingUp,         label: 'Markets',    comingSoon: false },
      { to: '/stocks',    icon: BarChart2,           label: 'Stocks',     comingSoon: false },
      { to: '/screener',  icon: SlidersHorizontal,   label: 'Screener',   comingSoon: true  },
    ],
  },
  {
    label: 'My Portfolio',
    items: [
      { to: '/watchlist',  icon: BookMarked,           label: 'Watchlist'  },
      { to: '/portfolio',  icon: BriefcaseBusiness,    label: 'Portfolio',  comingSoon: true },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { to: '/compare',     icon: GitCompareArrows, label: 'Compare'    },
      { to: '/predictions', icon: BrainCircuit,     label: 'Predictions' },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <LineChart size={22} className="brand-icon" />
          <h2>StockPredictor</h2>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="sidebar-section-label">{section.label}</p>
              {section.items.map(({ to, icon: Icon, label, comingSoon }) =>
                comingSoon ? (
                  <div key={to} className="nav-item disabled" title="Coming soon">
                    <Icon size={17} />
                    <span>{label}</span>
                    <span className="nav-badge">Soon</span>
                  </div>
                ) : (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                  </NavLink>
                )
              )}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <p style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Data for educational purposes only. Not financial advice.
          </p>
        </div>
      </aside>
    </>
  );
}
