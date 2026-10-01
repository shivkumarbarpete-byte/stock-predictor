"""
Day 1: Fetch NIFTY 50 stock data using yfinance
------------------------------------------------
Concept notes:
- NSE (National Stock Exchange India) tickers on yfinance need a ".NS" suffix.
  Example: Reliance -> "RELIANCE.NS", TCS -> "TCS.NS", Infosys -> "INFY.NS"
- yfinance.download() returns a pandas DataFrame with columns:
  Open, High, Low, Close, Volume (Adj Close in older versions)
- A DataFrame = an Excel-like table. Each row = one trading day.
"""

import yfinance as yf
import pandas as pd
from datetime import datetime

def fetch_stock_data(symbol: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """
    Fetch historical stock data.

    symbol   : NSE ticker with .NS suffix, e.g. "RELIANCE.NS"
    period   : how far back to fetch - "1y", "2y", "5y", "max", etc.
    interval : candle size - "1d" (daily), "1wk" (weekly), "1mo" (monthly)
    """
    print(f"Fetching data for {symbol} ...")

    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)

    if df.empty:
        raise ValueError(f"No data found for symbol: {symbol}. Check the ticker name.")

    # yfinance index is already a DatetimeIndex (the trading date) — reset it into a column
    df = df.reset_index()

    # Keep only the columns we actually need for now
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]

    return df


def save_to_csv(df: pd.DataFrame, symbol: str):
    filename = f"{symbol.replace('.NS', '')}_data.csv"
    df.to_csv(filename, index=False)
    print(f"Saved {len(df)} rows to {filename}")


if __name__ == "__main__":
    # NIFTY 50 index itself (for later, market-level trend)
    # Individual stock example: change this to any NSE stock you like
    SYMBOL = "RELIANCE.NS"

    data = fetch_stock_data(SYMBOL, period="2y", interval="1d")

    print("\n--- First 5 rows ---")
    print(data.head())

    print("\n--- Last 5 rows ---")
    print(data.tail())

    print(f"\nTotal rows fetched: {len(data)}")
    print(f"Date range: {data['Date'].min()} to {data['Date'].max()}")

    save_to_csv(data, SYMBOL)