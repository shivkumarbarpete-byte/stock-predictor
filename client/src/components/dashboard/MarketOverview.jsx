import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import mlApi from '../../services/mlApi';

/* Index tickers available through the existing ML /quote endpoint */
const INDEX_SYMBOLS = [
  { key: '^NSEI',  label: 'NIFTY 50'  },
  { key: '^BSESN', label: 'SENSEX'    },
  { key: '^NSEBANK', label: 'Bank NIFTY' },
];

/* Top NIFTY-50 stocks for quick gainers/losers poll */
const QUICK_STOCKS = [
  'RELIANCE.NS','TCS.NS','HDFCBANK.NS','INFY.NS','ICICIBANK.NS',
  'HINDUNILVR.NS','ITC.NS','SBIN.NS','BAJFINANCE.NS','AXISBANK.NS',
];

function ChangeChip({ value }) {
  if (value == null) return <span className="muted">—</span>;
  const up = value >= 0;
  return (
    <span className={`market-change ${up ? 'up' : 'down'}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

function IndexCard({ label, quote, loading }) {
  return (
    <div className="market-index-card card">
      <p className="index-label">{label}</p>
      {loading ? (
        <div className="skeleton" style={{ height: 28, width: 120, marginTop: 4 }} />
      ) : quote ? (
        <>
          <p className="index-value">
            {Number(quote.current_price ?? quote.price ?? 0).toLocaleString('en-IN', {
              maximumFractionDigits: 2,
            })}
          </p>
          <ChangeChip value={quote.day_change} />
        </>
      ) : (
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>Unavailable</p>
      )}
    </div>
  );
}

export default function MarketOverview() {
  const [indices,  setIndices]  = useState({});
  const [movers,   setMovers]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchAll = async () => {
    setLoading(true);

    /* Indices */
    const idxResults = {};
    await Promise.all(
      INDEX_SYMBOLS.map(async ({ key, label }) => {
        try {
          const res = await mlApi.get(`/quote/${encodeURIComponent(key)}`);
          idxResults[label] = res.data ?? null;
        } catch {
          idxResults[label] = null;
        }
      })
    );
    setIndices(idxResults);

    /* Top movers from quick stock list */
    const stockResults = [];
    await Promise.all(
      QUICK_STOCKS.map(async (sym) => {
        try {
          const res = await mlApi.get(`/quote/${sym}`);
          if (res.data) {
            stockResults.push({ sym, ...res.data });
          }
        } catch {
          /* skip unavailable */
        }
      })
    );

    /* Sort by absolute day_change */
    stockResults.sort((a, b) =>
      Math.abs(b.day_change ?? 0) - Math.abs(a.day_change ?? 0)
    );
    setMovers(stockResults);
    setLastFetch(new Date());
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const gainers = movers.filter((s) => (s.day_change ?? 0) >= 0).slice(0, 3);
  const losers  = movers.filter((s) => (s.day_change ?? 0)  < 0).slice(0, 3);

  return (
    <section className="market-overview">
      {/* Row 1: Index cards */}
      <div className="market-indices-row">
        {INDEX_SYMBOLS.map(({ label }) => (
          <IndexCard
            key={label}
            label={label}
            quote={indices[label]}
            loading={loading}
          />
        ))}

        {/* Refresh */}
        <button
          className="icon-btn refresh-btn"
          onClick={fetchAll}
          title="Refresh market data"
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Row 2: Gainers & Losers */}
      {(gainers.length > 0 || losers.length > 0) && (
        <div className="movers-row">
          {gainers.length > 0 && (
            <div className="movers-group card">
              <p className="movers-title text-success">▲ Top Gainers</p>
              {gainers.map((s) => (
                <div key={s.sym} className="mover-item">
                  <span className="mover-sym">{s.sym.replace('.NS', '')}</span>
                  <span className="mover-price">
                    ₹{Number(s.current_price ?? s.price ?? 0).toFixed(2)}
                  </span>
                  <ChangeChip value={s.day_change} />
                </div>
              ))}
            </div>
          )}

          {losers.length > 0 && (
            <div className="movers-group card">
              <p className="movers-title text-danger">▼ Top Losers</p>
              {losers.map((s) => (
                <div key={s.sym} className="mover-item">
                  <span className="mover-sym">{s.sym.replace('.NS', '')}</span>
                  <span className="mover-price">
                    ₹{Number(s.current_price ?? s.price ?? 0).toFixed(2)}
                  </span>
                  <ChangeChip value={s.day_change} />
                </div>
              ))}
            </div>
          )}

          {lastFetch && (
            <p className="overview-timestamp muted">
              Updated {lastFetch.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
            </p>
          )}
        </div>
      )}

      {/* If API completely unavailable */}
      {!loading && movers.length === 0 && (
        <p className="muted" style={{ fontSize: '0.8rem', padding: '0.5rem 0' }}>
          Market data temporarily unavailable. Stock analysis is still fully functional below.
        </p>
      )}
    </section>
  );
}
