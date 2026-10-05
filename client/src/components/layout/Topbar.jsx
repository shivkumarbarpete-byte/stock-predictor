import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Moon, Sun, Bell, Menu,
  LogOut, User, ChevronDown,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth }  from '../../context/AuthContext';

/* Derive initials from a name string */
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

/* Simple Indian-market open/closed detector (IST, Mon–Fri 09:15–15:30) */
function getMarketStatus() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay(); // 0=Sun, 6=Sat
  const h = ist.getHours();
  const m = ist.getMinutes();
  const mins = h * 60 + m;
  if (day === 0 || day === 6) return false;
  return mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;
}

export default function Topbar({ onMenuToggle }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout }       = useAuth();
  const navigate               = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchVal,    setSearchVal]    = useState('');
  const dropdownRef = useRef(null);
  const isOpen      = getMarketStatus();

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  /* Navigate to dashboard with search query via URL state */
  const handleSearch = (e) => {
    e.preventDefault();
    const sym = searchVal.trim().toUpperCase();
    if (!sym) return;
    navigate('/dashboard', { state: { searchSymbol: sym } });
    setSearchVal('');
  };

  return (
    <header className="topbar">
      {/* Left — hamburger (mobile) + search + market status */}
      <div className="topbar-left">
        <button
          className="icon-btn menu-toggle"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <form className="topbar-search" onSubmit={handleSearch}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search stocks… e.g. RELIANCE.NS"
            aria-label="Search stocks"
          />
        </form>

        <div className={`market-status ${isOpen ? '' : 'closed'}`}>
          <span className="market-status-dot" />
          {isOpen ? 'Market Open' : 'Market Closed'}
        </div>
      </div>

      {/* Right — actions */}
      <div className="topbar-actions">
        {/* Dark / Light toggle */}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        {/* Notification icon (placeholder — Phase 2) */}
        <button className="icon-btn" aria-label="Notifications" title="Notifications (coming soon)">
          <Bell size={19} />
        </button>

        {/* User profile dropdown */}
        <div className="user-dropdown" ref={dropdownRef}>
          <button
            className="user-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
            aria-label="User menu"
          >
            <div className="user-avatar" aria-hidden="true">
              {getInitials(user?.name)}
            </div>
            <span className="user-name">{user?.name}</span>
            <ChevronDown
              size={13}
              style={{ opacity: 0.55, flexShrink: 0 }}
            />
          </button>

          {dropdownOpen && (
            <div className="dropdown-menu" role="menu">
              {/* User info header */}
              <div className="dropdown-header">
                <div className="dh-name">{user?.name}</div>
                <div className="dh-email">{user?.email}</div>
              </div>

              <button
                onClick={() => { setDropdownOpen(false); navigate('/dashboard'); }}
                role="menuitem"
              >
                <User size={15} />
                Profile
              </button>

              <button
                className="btn-danger-text"
                onClick={handleLogout}
                role="menuitem"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
