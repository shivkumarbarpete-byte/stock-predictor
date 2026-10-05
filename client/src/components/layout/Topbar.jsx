import { useState, useRef, useEffect } from 'react';
import { Moon, Sun, Search, User, ChevronDown, LogOut } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} className="search-icon" />
        <input type="text" placeholder="Search NIFTY 50 (Ctrl+K)..." />
      </div>

      <div className="topbar-actions">
        <button onClick={toggleTheme} className="icon-btn" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        
        <div className="user-dropdown" ref={dropdownRef}>
          <button
            className="user-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <User size={20} />
            <span className="user-name">{user?.name}</span>
            <ChevronDown size={14} style={{ marginLeft: '2px', opacity: 0.6 }} />
          </button>
          {dropdownOpen && (
            <div className="dropdown-menu">
              <button onClick={handleLogout}>
                <LogOut size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
