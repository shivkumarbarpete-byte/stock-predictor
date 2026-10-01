import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import mlApi from '../services/mlApi'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import './Dashboard.css'

const COMPARE_COLORS = ['#2563eb', '#dc2626', '#16a34a']

function Dashboard() {
  const { user, loading } = useAuth()

  const [symbol, setSymbol] = useState('')
  const [chartData, setChartData] = useState([])
  const [fetchError, setFetchError] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [predictionData, setPredictionData] = useState(null)

  const [watchlist, setWatchlist] = useState([])
  const [watchlistError, setWatchlistError] = useState('')

  // ---- Compare mode state ----
  const [compareMode, setCompareMode] = useState(false)
  const [compareSymbols, setCompareSymbols] = useState([])
  const [compareInput, setCompareInput] = useState('')
  const [compareData, setCompareData] = useState([])
  const [compareError, setCompareError] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)

    const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0])
    const rows = data.map((row) =>
      headers.map((h) => row[h] ?? '').join(',')
    )
    const csvContent = [headers.join(','), ...rows].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await api.get('/watchlist')
        setWatchlist(res.data.watchlist)
      } catch (err) {
        setWatchlistError('Could not load watchlist.')
      }
    }

    if (user) {
      fetchWatchlist()
    }
  }, [user])

  const loadChart = async (sym) => {
    setFetchError('')
    setChartData([])
    setFetchLoading(true)

    try {
      const [histRes, predRes] = await Promise.all([
        mlApi.get(`/history/${sym.toUpperCase()}`),
        mlApi.get(`/predict/${sym.toUpperCase()}`)
      ])
      setChartData(histRes.data.data)
      setPredictionData(predRes.data)
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        setFetchError(err.response?.data?.detail || 'Invalid symbol. Only NIFTY 50 (.NS) supported.')
      } else {
        setFetchError('Could not fetch data. ML service might be down.')
      }
      setPredictionData(null)
    } finally {
      setFetchLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    loadChart(symbol)
  }

  const handleSelectFromWatchlist = (sym) => {
    setSymbol(sym)
    loadChart(sym)
  }

  const handleAddToWatchlist = async () => {
    setWatchlistError('')
    try {
      const res = await api.post('/watchlist', { symbol: symbol.toUpperCase() })
      setWatchlist(res.data.watchlist)
    } catch (err) {
      setWatchlistError(err.response?.data?.message || 'Could not add to watchlist.')
    }
  }

  const handleRemoveFromWatchlist = async (sym) => {
    setWatchlistError('')
    try {
      const res = await api.delete(`/watchlist/${sym}`)
      setWatchlist(res.data.watchlist)
    } catch (err) {
      setWatchlistError('Could not remove from watchlist.')
    }
  }

  // ---- Compare mode handlers ----
  const addCompareSymbol = () => {
    const sym = compareInput.trim().toUpperCase()
    if (!sym) return
    if (compareSymbols.includes(sym)) {
      setCompareError('That symbol is already added.')
      return
    }
    if (compareSymbols.length >= 3) {
      setCompareError('You can compare up to 3 stocks at a time.')
      return
    }
    setCompareError('')
    setCompareSymbols([...compareSymbols, sym])
    setCompareInput('')
  }

  const removeCompareSymbol = (sym) => {
    setCompareSymbols(compareSymbols.filter((s) => s !== sym))
  }

  useEffect(() => {
    const fetchCompareData = async () => {
      if (compareSymbols.length === 0) {
        setCompareData([])
        return
      }
      setCompareError('')
      setCompareLoading(true)

      try {
        const results = await Promise.all(
          compareSymbols.map((sym) => mlApi.get(`/history/${sym}`))
        )

        // Normalize each stock's price to % change from its first day
        const seriesPerSymbol = compareSymbols.map((sym, i) => {
          const data = results[i].data.data
          const base = data[0]?.actual
          return data.map((point) => ({
            date: point.date,
            [sym]: base ? ((point.actual - base) / base) * 100 : 0,
          }))
        })

        // Merge all symbols' data into one array, keyed by date
        const dateMap = {}
        seriesPerSymbol.forEach((series) => {
          series.forEach((point) => {
            if (!dateMap[point.date]) dateMap[point.date] = { date: point.date }
            Object.assign(dateMap[point.date], point)
          })
        })

        const merged = Object.values(dateMap).sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        )

        setCompareData(merged)
      } catch (err) {
        setCompareError('Could not fetch comparison data. Check symbols and try again.')
      } finally {
        setCompareLoading(false)
      }
    }

    fetchCompareData()
  }, [compareSymbols])


  return (
    <div className="dashboard">
      <h1>Welcome, {user.name}</h1>

      <button
        onClick={() => setCompareMode(!compareMode)}
        style={{ marginBottom: 16 }}
      >
        {compareMode ? 'Back to Single Stock View' : 'Compare Stocks'}
      </button>

      {!compareMode && (
        <>
          <div className="dashboard-grid">
            {/* Watchlist card */}
            <section className="card">
              <h2>My Watchlist</h2>
              {watchlistError && <p className="error-text">{watchlistError}</p>}
              {watchlist.length === 0 ? (
                <p className="muted">No stocks in watchlist yet.</p>
              ) : (
                <ul className="watchlist">
                  {watchlist.map((sym) => (
                    <li
                      key={sym}
                      className="watchlist-item clickable"
                      onClick={() => handleSelectFromWatchlist(sym)}
                    >
                      <span className="watchlist-symbol">{sym}</span>
                      <button
                        className="btn-small btn-danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFromWatchlist(sym)
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Search card */}
            <section className="card">
              <h2>Search Stock</h2>
              <form className="search-form" onSubmit={handleSearch}>
                <input
                  type="text"
                    placeholder="Enter symbol e.g. RELIANCE.NS"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  required
                />
                <button type="submit">Search</button>
              </form>

              {fetchLoading && (
                <div className="loading-spinner-container">
                  <div className="spinner"></div>
                  <p className="muted" style={{ marginTop: 12 }}>Loading chart...</p>
                </div>
              )}
              {fetchError && <p className="error-text">{fetchError}</p>}
            </section>
          </div>

          {predictionData && (
            <section className="card prediction-card" style={{ marginTop: 20 }}>
              <h2>Next-Day Predicted Price: {predictionData.symbol}</h2>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  ₹{predictionData.predicted_close}
                </div>
                <div>
                  Last Close: ₹{predictionData.last_close}
                </div>
                <div style={{ color: predictionData.direction === 'UP' ? 'green' : 'red', fontWeight: 'bold' }}>
                  {predictionData.direction === 'UP' ? '▲' : '▼'} {predictionData.change} ({predictionData.change_percent}%)
                </div>
              </div>
              <div style={{ marginTop: 16, borderTop: '1px solid #ccc', paddingTop: 10 }}>
                <h4>Model Accuracy (Last 20% Data)</h4>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <span><strong>MAE:</strong> {predictionData.metrics.mae}</span>
                  <span><strong>RMSE:</strong> {predictionData.metrics.rmse}</span>
                  <span><strong>R²:</strong> {predictionData.metrics.r2}</span>
                </div>
              </div>
            </section>
          )}

          {chartData.length > 0 && (
            <section className="card chart-card">
                        <div className="chart-header">
            <h2>Price History &amp; Prediction</h2>
            <button onClick={handleAddToWatchlist}>Add to Watchlist</button>
            <button onClick={() => downloadCSV(chartData, `${symbol.toUpperCase()}_data.csv`)}>
              Export CSV
            </button>
          </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" minTickGap={40} tick={{ fontSize: 12 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="#2563eb" dot={false} name="Actual Price" />
                  <Line type="monotone" dataKey="predicted" stroke="#dc2626" dot={false} name="Predicted Price" />
                  <Line type="monotone" dataKey="sma20" stroke="#16a34a" dot={false} name="SMA 20" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="sma50" stroke="#9333ea" dot={false} name="SMA 50" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </section>
          )}
        </>
      )}

      {compareMode && (
        <section className="card chart-card">
          <h2>Compare Stocks (% Change)</h2>
   
          <button
            onClick={() => downloadCSV(compareData, `comparison_${compareSymbols.join('_')}.csv`)}
            style={{ marginBottom: 12 }}
          >
            Export CSV
          </button>
          <div className="search-form" style={{ marginBottom: 12 }}>
            <input
              type="text"
         placeholder="Enter symbol e.g. TCS.NS"
              value={compareInput}
              onChange={(e) => setCompareInput(e.target.value)}
            />
            <button onClick={addCompareSymbol}>Add</button>
          </div>

          {compareSymbols.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {compareSymbols.map((sym) => (
                <span key={sym} className="watchlist-symbol" style={{ marginRight: 8 }}>
                  {sym}{' '}
                  <button
                    className="btn-small btn-danger"
                    onClick={() => removeCompareSymbol(sym)}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}

          {compareLoading && <p className="muted">Loading comparison...</p>}
          {compareError && <p className="error-text">{compareError}</p>}

          {compareData.length > 0 && (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={compareData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={40} tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: '% Change', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                <Legend />
                {compareSymbols.map((sym, i) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                    dot={false}
                    name={sym}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

      <footer style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
        Educational project, not financial advice.
      </footer>
    </div>
  )
}

export default Dashboard