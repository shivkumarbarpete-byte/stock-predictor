import { Moon, Sun, Search, User } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
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
        
        <div className="user-dropdown">
          <button className="user-btn">
            <User size={20} />
            <span className="user-name">{user?.name}</span>
          </button>
          <div className="dropdown-menu">
            <button onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
