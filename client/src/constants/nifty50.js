export const NIFTY50_STOCKS = [
  { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd', sector: 'Energy' },
  { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd', sector: 'IT Services' },
  { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd', sector: 'Banking' },
  { symbol: 'INFY.NS', name: 'Infosys Ltd', sector: 'IT Services' },
  { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd', sector: 'Banking' },
  { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever Ltd', sector: 'FMCG' },
  { symbol: 'ITC.NS', name: 'ITC Ltd', sector: 'FMCG' },
  { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Ltd', sector: 'Telecom' },
  { symbol: 'LTIM.NS', name: 'LTIMindtree Ltd', sector: 'IT Services' },
  { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank Ltd', sector: 'Banking' },
  { symbol: 'LT.NS', name: 'Larsen & Toubro Ltd', sector: 'Construction' },
  { symbol: 'AXISBANK.NS', name: 'Axis Bank Ltd', sector: 'Banking' },
  { symbol: 'HCLTECH.NS', name: 'HCL Technologies Ltd', sector: 'IT Services' },
  { symbol: 'ASIANPAINT.NS', name: 'Asian Paints Ltd', sector: 'Consumer Durables' },
  { symbol: 'MARUTI.NS', name: 'Maruti Suzuki India Ltd', sector: 'Automobile' },
  { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Pharma' },
  { symbol: 'TITAN.NS', name: 'Titan Company Ltd', sector: 'Consumer Durables' },
  { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance Ltd', sector: 'Financial Services' },
  { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement Ltd', sector: 'Materials' },
  { symbol: 'TATASTEEL.NS', name: 'Tata Steel Ltd', sector: 'Metals' },
  { symbol: 'NTPC.NS', name: 'NTPC Ltd', sector: 'Power' },
  { symbol: 'POWERGRID.NS', name: 'Power Grid Corporation of India Ltd', sector: 'Power' },
  { symbol: 'M&M.NS', name: 'Mahindra & Mahindra Ltd', sector: 'Automobile' },
  { symbol: 'TATAMOTORS.NS', name: 'Tata Motors Ltd', sector: 'Automobile' },
  { symbol: 'ADANIENT.NS', name: 'Adani Enterprises Ltd', sector: 'Metals & Mining' },
  { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ Ltd', sector: 'Infrastructure' },
  { symbol: 'COALINDIA.NS', name: 'Coal India Ltd', sector: 'Energy' },
  { symbol: 'ONGC.NS', name: 'Oil & Natural Gas Corporation Ltd', sector: 'Energy' },
  { symbol: 'JSWSTEEL.NS', name: 'JSW Steel Ltd', sector: 'Metals' },
  { symbol: 'GRASIM.NS', name: 'Grasim Industries Ltd', sector: 'Materials' },
  { symbol: 'NESTLEIND.NS', name: 'Nestle India Ltd', sector: 'FMCG' },
  { symbol: 'TECHM.NS', name: 'Tech Mahindra Ltd', sector: 'IT Services' },
  { symbol: 'WIPRO.NS', name: 'Wipro Ltd', sector: 'IT Services' },
  { symbol: 'HDFCLIFE.NS', name: 'HDFC Life Insurance Co Ltd', sector: 'Financial Services' },
  { symbol: 'SBILIFE.NS', name: 'SBI Life Insurance Co Ltd', sector: 'Financial Services' },
  { symbol: 'DRREDDY.NS', name: 'Dr. Reddys Laboratories Ltd', sector: 'Pharma' },
  { symbol: 'DIVISLAB.NS', name: 'Divis Laboratories Ltd', sector: 'Pharma' },
  { symbol: 'CIPLA.NS', name: 'Cipla Ltd', sector: 'Pharma' },
  { symbol: 'EICHERMOT.NS', name: 'Eicher Motors Ltd', sector: 'Automobile' },
  { symbol: 'HEROMOTOCO.NS', name: 'Hero MotoCorp Ltd', sector: 'Automobile' },
  { symbol: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto Ltd', sector: 'Automobile' },
  { symbol: 'TATACONSUM.NS', name: 'Tata Consumer Products Ltd', sector: 'FMCG' },
  { symbol: 'BRITANNIA.NS', name: 'Britannia Industries Ltd', sector: 'FMCG' },
  { symbol: 'BPCL.NS', name: 'Bharat Petroleum Corporation Ltd', sector: 'Energy' },
  { symbol: 'APOLLOHOSP.NS', name: 'Apollo Hospitals Enterprise Ltd', sector: 'Healthcare' },
  { symbol: 'HINDALCO.NS', name: 'Hindalco Industries Ltd', sector: 'Metals' },
  { symbol: 'INDUSINDBK.NS', name: 'IndusInd Bank Ltd', sector: 'Banking' },
  { symbol: 'BAJAJFINSV.NS', name: 'Bajaj Finserv Ltd', sector: 'Financial Services' },
  { symbol: 'SHRIRAMFIN.NS', name: 'Shriram Finance Ltd', sector: 'Financial Services' }
];

export const NIFTY50_SYMBOLS = NIFTY50_STOCKS.map((s) => s.symbol);

export function searchNifty50(query) {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  return NIFTY50_STOCKS.filter(
    (stock) =>
      stock.symbol.toLowerCase().includes(q) ||
      stock.name.toLowerCase().includes(q) ||
      stock.symbol.replace('.NS', '').toLowerCase().includes(q)
  );
}
