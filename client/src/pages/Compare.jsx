import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Download, Plus, X, RefreshCw, GitCompareArrows } from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import { NIFTY50_STOCKS } from '../constants/nifty50';
import './Compare.css';

const STOCK_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

export default function Compare() {
  const [selectedSymbols, setSelectedSymbols] = useState(['RELIANCE.NS', 'TCS.NS']);
  const [inputVal, setInputVal]               = useState('');
  const [days, setDays]                       = useState(90);
  const [comparisonData, setComparisonData]   = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState(null);

  useEffect(() => {
    fetchComparisonData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbols, days]);

  const fetchComparisonData = async () => {
    if (selectedSymbols.length === 0) {
      setComparisonData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const promises = selectedSymbols.map((sym) =>
        mlApi.get(`/history/${sym}?days=${days}`)
      );
      const responses = await Promise.all(promises);

      // Process and normalize by percentage change from day 1
      const histories = responses.map((res, idx) => ({
        symbol: selectedSymbols[idx],
        data: res.data?.data || [],
      }));

      if (histories.some((h) => h.data.length === 0)) {
        throw new Error('Some stock historical data could not be fetched.');
      }

      // Map by dates
      const dateMap = {};
      histories.forEach(({ symbol, data }) => {
        if (!data || data.length === 0) return;
        const firstPrice = data[0].actual;

        data.forEach((item) => {
          if (!dateMap[item.date]) {
            dateMap[item.date] = { date: item.date };
          }
          const pctChange = firstPrice ? ((item.actual - firstPrice) / firstPrice) * 100 : 0;
          dateMap[item.date][`${symbol}_price`] = item.actual;
          dateMap[item.date][`${symbol}_pct`]   = Number(pctChange.toFixed(2));
        });
      });

      const merged = Object.values(dateMap).sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      setComparisonData(merged);
    } catch (err) {
      setError(err.message || 'Failed to compare stocks');
      toast.error('Could not fetch comparison data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSymbol = (symToAdd) => {
    const sym = (symToAdd || inputVal).trim().toUpperCase();
    if (!sym) return;
    const formatted = sym.endsWith('.NS') ? sym : `${sym}.NS`;

    if (selectedSymbols.length >= 3) {
      toast.error('Maximum 3 stocks can be compared at once');
      return;
    }
    if (selectedSymbols.includes(formatted)) {
      toast.error(`${formatted} is already in comparison list`);
      return;
    }

    setSelectedSymbols((prev) => [...prev, formatted]);
    setInputVal('');
    toast.success(`Added ${formatted} to compare`);
  };

  const handleRemoveSymbol = (symToRemove) => {
    if (selectedSymbols.length <= 1) {
      toast.error('Comparison requires at least 1 stock');
      return;
    }
    setSelectedSymbols((prev) => prev.filter((s) => s !== symToRemove));
  };

  const handleExportCSV = () => {
    if (comparisonData.length === 0) {
      toast.error('No data available to export');
      return;
    }

    const headers = ['Date', ...selectedSymbols.flatMap((s) => [`${s} Price (₹)`, `${s} % Change`])];
    const rows = comparisonData.map((row) => [
      row.date,
      ...selectedSymbols.flatMap((s) => [
        row[`${s}_price`] ?? '',
        row[`${s}_pct`] !== undefined ? `${row[`${s}_pct`]}%` : '',
      ]),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stock_comparison_${selectedSymbols.join('_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV export generated successfully');
  };

  const filteredSuggestions = NIFTY50_STOCKS.filter(
    (st) =>
      !selectedSymbols.includes(st.symbol) &&
      (st.symbol.toLowerCase().includes(inputVal.toLowerCase()) ||
        st.name.toLowerCase().includes(inputVal.toLowerCase()))
  ).slice(0, 5);

  return (
    <div className="compare-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <GitCompareArrows size={26} className="title-icon" /> Stock Comparison
          </h1>
          <p className="muted">
            Compare performance (% change from start date) of up to 3 NIFTY 50 stocks side by side.
          </p>
        </div>
        <button
          className="btn-outline"
          onClick={handleExportCSV}
          disabled={comparisonData.length === 0 || loading}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Control Bar */}
      <div className="compare-controls card">
        <div className="chips-container">
          <span className="chips-label">Selected Stocks ({selectedSymbols.length}/3):</span>
          {selectedSymbols.map((sym, idx) => (
            <div
              key={sym}
              className="stock-chip"
              style={{ borderLeft: `4px solid ${STOCK_COLORS[idx % STOCK_COLORS.length]}` }}
            >
              <span className="chip-symbol">{sym}</span>
              <button
                className="chip-remove"
                onClick={() => handleRemoveSymbol(sym)}
                title="Remove stock"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {selectedSymbols.length < 3 && (
          <div className="add-stock-wrapper">
            <div className="add-stock-input-group">
              <input
                type="text"
                placeholder="Add stock (e.g. INFY.NS)"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSymbol();
                  }
                }}
              />
              <button className="btn-primary btn-small" onClick={() => handleAddSymbol()}>
                <Plus size={14} /> Add
              </button>
            </div>

            {inputVal.trim() && filteredSuggestions.length > 0 && (
              <div className="suggestions-popover">
                {filteredSuggestions.map((st) => (
                  <button
                    key={st.symbol}
                    className="suggestion-item"
                    onClick={() => handleAddSymbol(st.symbol)}
                  >
                    <strong>{st.symbol}</strong> — <span className="muted">{st.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="timeframe-selector">
          <label htmlFor="days-select">Timeframe:</label>
          <select
            id="days-select"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
            <option value={120}>120 Days</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card skeleton-container" style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton-loading-text">
            <RefreshCw size={24} className="spin-icon" />
            <p>Fetching and normalizing data for comparison…</p>
          </div>
        </div>
      ) : error ? (
        <div className="card error-state">
          <h3>Failed to load comparison data</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={fetchComparisonData}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="compare-chart-card card">
          <div className="chart-header">
            <h3>Normalized Performance (% Change)</h3>
            <span className="muted text-small">Base 0% = Price at start of timeframe</span>
          </div>

          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={comparisonData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  unit="%"
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${value}%`,
                    name.replace('_pct', ''),
                  ]}
                  contentStyle={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Legend />
                {selectedSymbols.map((sym, idx) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={`${sym}_pct`}
                    name={sym}
                    stroke={STOCK_COLORS[idx % STOCK_COLORS.length]}
                    strokeWidth={2.5}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
