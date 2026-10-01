import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line
} from 'recharts';

export default function MainChart({ data, symbol }) {
  const [showSMA20, setShowSMA20] = useState(true);
  const [showSMA50, setShowSMA50] = useState(true);
  const [range, setRange] = useState('ALL');

  if (!data || data.length === 0) return null;

  // Filter data client-side
  let filteredData = data;
  if (range !== 'ALL') {
    const daysMap = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const days = daysMap[range];
    filteredData = data.slice(-days);
  }

  return (
    <section className="card chart-card">
      <div className="chart-header">
        <h2>{symbol} Chart</h2>
        <div className="chart-controls">
          <div className="toggle-chips">
            <button 
              className={`chip ${showSMA20 ? 'active' : ''}`}
              onClick={() => setShowSMA20(!showSMA20)}
            >
              SMA 20
            </button>
            <button 
              className={`chip ${showSMA50 ? 'active' : ''}`}
              onClick={() => setShowSMA50(!showSMA50)}
            >
              SMA 50
            </button>
          </div>
          <div className="range-buttons">
            {['1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
              <button 
                key={r} 
                className={`btn-small ${range === r ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={filteredData}>
          <defs>
            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="date" minTickGap={40} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
          <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
          <Legend />
          <Area type="monotone" dataKey="actual" stroke="#2563eb" fillOpacity={1} fill="url(#colorActual)" name="Actual Price" />
          <Line type="monotone" dataKey="predicted" stroke="#dc2626" dot={false} name="Predicted Price" />
          {showSMA20 && <Line type="monotone" dataKey="sma20" stroke="#16a34a" dot={false} name="SMA 20" strokeDasharray="5 5" />}
          {showSMA50 && <Line type="monotone" dataKey="sma50" stroke="#9333ea" dot={false} name="SMA 50" strokeDasharray="5 5" />}
        </AreaChart>
      </ResponsiveContainer>
    </section>
  );
}
