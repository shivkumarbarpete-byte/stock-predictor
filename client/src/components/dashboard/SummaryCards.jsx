import { TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';

export default function SummaryCards({ symbol, quoteData, predictionData }) {
  if (!symbol) return null;

  return (
    <div className="summary-cards">
      <div className="card summary-card">
        <h3>{symbol} Price</h3>
        {quoteData ? (
          <div className="price-info">
            <span className="current-price">₹{quoteData.current_price || quoteData.price}</span>
            <span className={`change ${quoteData.day_change >= 0 ? 'text-success' : 'text-danger'}`}>
              {quoteData.day_change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {quoteData.day_change}%
            </span>
          </div>
        ) : (
          <p className="muted">Loading quote...</p>
        )}
      </div>

      <div className="card summary-card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3>Predicted Next Close</h3>
          <span title="Model: Linear Regression" style={{ cursor: 'help' }}>
            <HelpCircle size={16} className="text-muted" />
          </span>
        </div>
        {predictionData ? (
          <div className="price-info">
            <span className="current-price">₹{predictionData.predicted_close}</span>
            <span className={`badge ${predictionData.direction === 'UP' ? 'badge-bullish' : 'badge-bearish'}`}>
              {predictionData.direction === 'UP' ? 'Bullish' : 'Bearish'}
            </span>
          </div>
        ) : (
          <p className="muted">Loading prediction...</p>
        )}
      </div>
    </div>
  );
}
