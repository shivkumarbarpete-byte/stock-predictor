export default function QuickPicks({ onSelect }) {
  const TOP_NIFTY = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS'];
  
  return (
    <div className="quick-picks">
      <h4 className="text-muted">Top NIFTY 50</h4>
      <div className="chips">
        {TOP_NIFTY.map(sym => (
          <button key={sym} className="chip btn-outline" onClick={() => onSelect(sym)}>
            {sym}
          </button>
        ))}
      </div>
    </div>
  );
}
