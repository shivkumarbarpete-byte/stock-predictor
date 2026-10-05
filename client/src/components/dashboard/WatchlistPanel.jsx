import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, BookMarked } from 'lucide-react';
import mlApi from '../../services/mlApi';

export default function WatchlistPanel({ watchlist, onSelect, onRemove }) {
  const [quotes, setQuotes] = useState({});

  useEffect(() => {
    if (!Array.isArray(watchlist) || watchlist.length === 0) return;

    const fetchQuotes = async () => {
      const next = {};
      await Promise.all(
        watchlist.map(async (sym) => {
          try {
            const res = await mlApi.get(`/quote/${sym}`);
            next[sym] = res.data ?? null;
          } catch {
            next[sym] = null;
          }
        })
      );
      setQuotes(next);
    };

    fetchQuotes();
  }, [watchlist]);

  return (
    <section className="card watchlist-panel">
      {/* Panel header */}
      <div className="watchlist-panel-header">
        <h2>
          <BookMarked size={15} style={{ marginRight: 6, verticalAlign: 'middle', color: 'var(--primary)' }} />
          My Watchlist
        </h2>
        {watchlist.length > 0 && (
          <span className="badge badge-neutral">{watchlist.length}</span>
        )}
      </div>

      {watchlist.length === 0 ? (
        <div className="watchlist-empty">
          <BookMarked size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
          <p style={{ margin: 0 }}>Your watchlist is empty.</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>
            Search for a stock and click&nbsp;<strong>+ Watchlist</strong>.
          </p>
        </div>
      ) : (
        <ul className="watchlist-list">
          {watchlist.map((sym) => {
            const q = quotes[sym];
            const change = q?.day_change ?? null;
            return (
              <li
                key={sym}
                className="watchlist-item"
                onClick={() => onSelect(sym)}
                title={`Analyze ${sym}`}
              >
                <span className="symbol">{sym.replace('.NS', '')}</span>

                {q ? (
                  <div className="quote-mini">
                    <span className="price">
                      ₹{Number(q.current_price ?? q.price ?? 0).toFixed(2)}
                    </span>
                    <span className={`change ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                      {change >= 0
                        ? <TrendingUp size={11} />
                        : <TrendingDown size={11} />}
                      {Math.abs(change).toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <span className="muted" style={{ fontSize: '0.75rem', marginRight: '0.75rem' }}>
                    …
                  </span>
                )}

                <button
                  className="btn-danger-hover"
                  onClick={(e) => { e.stopPropagation(); onRemove(sym); }}
                  aria-label={`Remove ${sym} from watchlist`}
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
