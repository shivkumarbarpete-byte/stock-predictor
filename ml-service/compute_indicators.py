"""
Day 2: Clean data + compute Moving Average indicators (SMA, EMA)
------------------------------------------------------------------
Concept notes:
- rolling(window=N).mean() -> SMA: simple average of last N rows
- ewm(span=N).mean()       -> EMA: exponentially weighted average,
  gives more importance to recent prices
- We compute both a "fast" (short window) and "slow" (long window) MA.
  The crossover between them is a classic trend signal used later
  as a feature for the ML model.
"""

import pandas as pd


def load_data(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, parse_dates=["Date"])
    return df


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Basic cleaning:
    - Drop rows where Volume == 0 (holidays / no real trading happened)
    - Drop any rows with missing values
    - Sort by date ascending (oldest -> newest), just to be safe
    """
    before = len(df)

    df = df[df["Volume"] > 0]
    df = df.dropna()
    df = df.sort_values("Date").reset_index(drop=True)

    after = len(df)
    print(f"Cleaning: removed {before - after} rows (holidays / missing data)")

    return df


def add_moving_averages(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds SMA20, SMA50 (simple) and EMA20 (exponential) columns
    based on the Close price.
    """
    df["SMA20"] = df["Close"].rolling(window=20).mean()
    df["SMA50"] = df["Close"].rolling(window=50).mean()
    df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()

    # Simple trend signal: 1 if fast MA above slow MA (bullish), else 0
    # NaN rows (first 49 rows, before SMA50 has enough data) are kept for now,
    # we'll drop them before training the model in a later step.
    df["Trend_Signal"] = (df["SMA20"] > df["SMA50"]).astype(int)

    return df


if __name__ == "__main__":
    INPUT_CSV = "RELIANCE_data.csv"
    OUTPUT_CSV = "RELIANCE_data_with_indicators.csv"

    data = load_data(INPUT_CSV)
    print(f"Loaded {len(data)} rows from {INPUT_CSV}")

    data = clean_data(data)
    data = add_moving_averages(data)

    print("\n--- Last 10 rows (with indicators) ---")
    print(data[["Date", "Close", "SMA20", "SMA50", "EMA20", "Trend_Signal"]].tail(10))

    data.to_csv(OUTPUT_CSV, index=False)
    print(f"\nSaved {len(data)} rows with indicators to {OUTPUT_CSV}")