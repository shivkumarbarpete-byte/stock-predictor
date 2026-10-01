import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown } from 'lucide-react';
import mlApi from '../../services/mlApi';
import { toast } from 'sonner';

export default function WatchlistPanel({ watchlist, onSelect, onRemove }) {
  const [quotes, setQuotes] = useState({});

  useEffect(() => {
    const fetchQuotes = async () => {
      const newQuotes = {};
      await Promise.all(
        watchlist.map(async (sym) => {
          try {
            const res = await mlApi.get(`/quote/${sym}`);
            newQuotes[sym] = res.data;
          } catch (e) {
            console.error('Failed to quote', sym);
          }
        })
      );
      setQuotes(newQuotes);
    };
    if (watchlist.length > 0) fetchQuotes();
  }, [watchlist]);

  return (
    <section className="card watchlist-panel">
      <h2>My Watchlist</h2>
      {watchlist.length === 0 ? (
        <p className="muted">No stocks in watchlist.</p>
      ) : (
        <ul className="watchlist-list">
          {watchlist.map(sym => {
            const q = quotes[sym];
            return (
              <li key={sym} className="watchlist-item clickable" onClick={() => onSelect(sym)}>
                <span className="symbol">{sym}</span>
                {q ? (
                  <div className="quote-mini">
                    <span className="price">₹{q.current_price || q.price}</span>
                    <span className={q.day_change >= 0 ? 'text-success' : 'text-danger'}>
                      {q.day_change >= 0 ? <TrendingUp size={14}/> : <TrendingDown size={14}/>} {Math.abs(q.day_change)}%
                    </span>
                  </div>
                ) : <span className="muted">...</span>}
                <button 
                  className="icon-btn btn-danger-hover" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onRemove(sym); 
                  }}
                >
                  <X size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
