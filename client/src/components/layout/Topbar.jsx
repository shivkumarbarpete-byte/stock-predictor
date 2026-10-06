import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Moon, Sun, Bell, Menu,
  LogOut, User, ChevronDown, TrendingUp,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth }  from '../../context/AuthContext';
import { searchNifty50 } from '../../constants/nifty50';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getMarketStatus() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = ist.getDay();
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

  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [searchVal,    setSearchVal]      = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults,  setShowResults]    = useState(false);

  const dropdownRef  = useRef(null);
  const searchBoxRef = useRef(null);
  const isOpen       = getMarketStatus();

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Handle typing in search input */
  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchVal(val);
    if (val.trim()) {
      const results = searchNifty50(val);
      setSearchResults(results.slice(0, 8)); // Top 8 matches
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleSelectSymbol = (symbol) => {
    setShowResults(false);
    setSearchVal('');
    navigate(`/prediction?symbol=${symbol}`);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const sym = searchVal.trim().toUpperCase();
    if (!sym) return;
    const finalSym = sym.endsWith('.NS') ? sym : `${sym}.NS`;
    setShowResults(false);
    setSearchVal('');
    navigate(`/prediction?symbol=${finalSym}`);
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      {/* Left — hamburger + search + market status */}
      <div className="topbar-left">
        <button
          className="icon-btn menu-toggle"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <div className="topbar-search-container" ref={searchBoxRef}>
          <form className="topbar-search" onSubmit={handleSearchSubmit}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={searchVal}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchVal.trim()) setShowResults(true);
              }}
              placeholder="Search NIFTY 50 stocks…"
              aria-label="Search stocks"
            />
          </form>

          {/* Autocomplete Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="search-autocomplete-dropdown">
              {searchResults.map((item) => (
                <button
                  key={item.symbol}
                  className="autocomplete-item"
                  onClick={() => handleSelectSymbol(item.symbol)}
                  type="button"
                >
                  <TrendingUp size={14} className="ac-icon" />
                  <div className="ac-details">
                    <span className="ac-symbol">{item.symbol}</span>
                    <span className="ac-name">{item.name}</span>
                  </div>
                  <span className="ac-badge">{item.sector}</span>
                </button>
              ))}
            </div>
          )}

          {showResults && searchVal.trim() && searchResults.length === 0 && (
            <div className="search-autocomplete-dropdown empty">
              <span className="ac-no-results">No matching stock found</span>
            </div>
          )}
        </div>

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

        {/* Notifications button */}
        <button className="icon-btn" aria-label="Notifications" title="Notifications">
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
