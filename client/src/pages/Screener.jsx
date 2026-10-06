import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Search, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, BookmarkPlus } from 'lucide-react';
import { toast } from 'sonner';
import mlApi from '../services/mlApi';
import api from '../services/api';
import { NIFTY50_STOCKS } from '../constants/nifty50';
import './Screener.css';

const ALL_SECTORS = ['All Sectors', ...new Set(NIFTY50_STOCKS.map((s) => s.sector))];

export default function Screener() {
  const navigate = useNavigate();
  const [stocksData, setStocksData]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // Filters
  const [search, setSearch]               = useState('');
  const [minPrice, setMinPrice]           = useState('');
  const [maxPrice, setMaxPrice]           = useState('');
  const [pctFilter, setPctFilter]         = useState('all'); // all, gainers, losers, movers
  const [selectedSector, setSelectedSector] = useState('All Sectors');

  // Sorting
  const [sortField, setSortField]         = useState('change_percent');
  const [sortDirection, setSortDirection] = useState('desc');

  useEffect(() => {
    fetchScreenerData();
  }, []);

  const fetchScreenerData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch quotes for top 25 NIFTY 50 symbols for speed & efficiency
      const targetSymbols = NIFTY50_STOCKS.slice(0, 25).map((s) => s.symbol);
      const results = await Promise.allSettled(
        targetSymbols.map((sym) => mlApi.get(`/quote/${sym}`))
      );

      const items = [];
      results.forEach((res, idx) => {
        const meta = NIFTY50_STOCKS.find((s) => s.symbol === targetSymbols[idx]);
        if (res.status === 'fulfilled' && res.value.data) {
          items.push({
            ...res.value.data,
            name: meta?.name || targetSymbols[idx],
            sector: meta?.sector || 'Other',
          });
        }
      });

      if (items.length === 0) {
        throw new Error('Failed to load screener stock quotes.');
      }

      setStocksData(items);
    } catch (err) {
      setError(err.message || 'Error fetching stock quotes');
      toast.error('Could not fetch screener data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleAddToWatchlist = async (symbol, e) => {
    e.stopPropagation();
    try {
      await api.post('/watchlist', { symbol });
      toast.success(`Added ${symbol} to watchlist`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add to watchlist');
    }
  };

  // Filter logic
  const filteredData = stocksData.filter((item) => {
    // Search query
    if (
      search.trim() &&
      !item.symbol.toLowerCase().includes(search.toLowerCase()) &&
      !item.name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }

    // Min / Max Price
    if (minPrice !== '' && item.close < Number(minPrice)) return false;
    if (maxPrice !== '' && item.close > Number(maxPrice)) return false;

    // Sector
    if (selectedSector !== 'All Sectors' && item.sector !== selectedSector) return false;

    // % Change filter
    if (pctFilter === 'gainers' && item.change_percent < 0) return false;
    if (pctFilter === 'losers' && item.change_percent >= 0) return false;
    if (pctFilter === 'movers' && Math.abs(item.change_percent) < 1.5) return false;

    return true;
  });

  // Sort logic
  const sortedData = [...filteredData].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={13} className="sort-icon-idle" />;
    return sortDirection === 'asc' ? <ArrowUp size={13} className="sort-icon-active" /> : <ArrowDown size={13} className="sort-icon-active" />;
  };

  return (
    <div className="screener-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <SlidersHorizontal size={26} className="title-icon" /> NIFTY 50 Stock Screener
          </h1>
          <p className="muted">
            Filter and sort NIFTY 50 stocks by price range, % change movement, sector, and volume.
          </p>
        </div>
        <button className="btn-outline" onClick={fetchScreenerData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin-icon' : ''} /> Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card screener-filters-card">
        <div className="filter-row">
          {/* Search Box */}
          <div className="filter-item search-item">
            <label>Search Stock</label>
            <div className="input-with-icon">
              <Search size={15} className="input-icon" />
              <input
                type="text"
                placeholder="Symbol or company name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Min Price */}
          <div className="filter-item price-item">
            <label>Min Price (₹)</label>
            <input
              type="number"
              placeholder="e.g. 500"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </div>

          {/* Max Price */}
          <div className="filter-item price-item">
            <label>Max Price (₹)</label>
            <input
              type="number"
              placeholder="e.g. 3000"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>

          {/* Sector Selector */}
          <div className="filter-item sector-item">
            <label>Sector</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
            >
              {ALL_SECTORS.map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Movement Pills */}
          <div className="filter-item movement-item">
            <label>Movement</label>
            <div className="movement-pills">
              <button
                className={`pill ${pctFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPctFilter('all')}
              >
                All
              </button>
              <button
                className={`pill ${pctFilter === 'gainers' ? 'active' : ''}`}
                onClick={() => setPctFilter('gainers')}
              >
                Up
              </button>
              <button
                className={`pill ${pctFilter === 'losers' ? 'active' : ''}`}
                onClick={() => setPctFilter('losers')}
              >
                Down
              </button>
              <button
                className={`pill ${pctFilter === 'movers' ? 'active' : ''}`}
                onClick={() => setPctFilter('movers')}
              >
                Big Movers (&gt;1.5%)
              </button>
            </div>
          </div>
        </div>

        <div className="filter-summary">
          <span className="muted">
            Showing <strong>{sortedData.length}</strong> of <strong>{stocksData.length}</strong> stocks
          </span>
          {(search || minPrice || maxPrice || selectedSector !== 'All Sectors' || pctFilter !== 'all') && (
            <button
              className="btn-ghost btn-small text-danger"
              onClick={() => {
                setSearch('');
                setMinPrice('');
                setMaxPrice('');
                setSelectedSector('All Sectors');
                setPctFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="card skeleton-container" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem' }} />
          <h3>Filtering NIFTY 50 Stocks…</h3>
          <p className="muted">Fetching price metrics</p>
        </div>
      ) : error ? (
        <div className="card error-state">
          <h3>Screener Failed</h3>
          <p className="muted">{error}</p>
          <button className="btn-primary" onClick={fetchScreenerData}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      ) : (
        <div className="card screener-table-card">
          <div className="table-wrapper">
            <table className="screener-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('symbol')} className="sortable">
                    Symbol {getSortIcon('symbol')}
                  </th>
                  <th onClick={() => handleSort('name')} className="sortable">
                    Company {getSortIcon('name')}
                  </th>
                  <th onClick={() => handleSort('sector')} className="sortable">
                    Sector {getSortIcon('sector')}
                  </th>
                  <th onClick={() => handleSort('close')} className="sortable text-right">
                    Price (₹) {getSortIcon('close')}
                  </th>
                  <th onClick={() => handleSort('change')} className="sortable text-right">
                    Change (₹) {getSortIcon('change')}
                  </th>
                  <th onClick={() => handleSort('change_percent')} className="sortable text-right">
                    % Change {getSortIcon('change_percent')}
                  </th>
                  <th onClick={() => handleSort('high')} className="sortable text-right">
                    High (₹) {getSortIcon('high')}
                  </th>
                  <th onClick={() => handleSort('low')} className="sortable text-right">
                    Low (₹) {getSortIcon('low')}
                  </th>
                  <th onClick={() => handleSort('volume')} className="sortable text-right">
                    Volume {getSortIcon('volume')}
                  </th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-table-cell">
                      No stocks match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  sortedData.map((item) => {
                    const isPos = item.change >= 0;
                    return (
                      <tr
                        key={item.symbol}
                        className="clickable-row"
                        onClick={() => navigate(`/prediction?symbol=${item.symbol}`)}
                      >
                        <td className="font-bold">{item.symbol}</td>
                        <td className="muted">{item.name}</td>
                        <td>
                          <span className="badge badge-neutral">{item.sector}</span>
                        </td>
                        <td className="font-bold text-right">₹{item.close}</td>
                        <td className={`text-right ${isPos ? 'text-success' : 'text-danger'}`}>
                          {isPos ? '+' : ''}{item.change}
                        </td>
                        <td className="text-right">
                          <span className={`badge ${isPos ? 'badge-bullish' : 'badge-bearish'}`}>
                            {isPos ? '+' : ''}{item.change_percent}%
                          </span>
                        </td>
                        <td className="text-right">₹{item.high}</td>
                        <td className="text-right">₹{item.low}</td>
                        <td className="text-right muted">{item.volume.toLocaleString()}</td>
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-outline btn-small"
                            onClick={(e) => handleAddToWatchlist(item.symbol, e)}
                            title="Add to Watchlist"
                          >
                            <BookmarkPlus size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
