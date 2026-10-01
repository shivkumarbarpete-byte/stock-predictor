"""
stock_utils.py
--------------
Day 1-3 ka saara logic yahan reusable functions ke form mein hai.
FastAPI (main.py) ise import karke use karega.

Isse ml-service folder mein rakho (wahi jahan train_model.py aur
linear_regression_model.pkl hai).
"""

import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------

# IMPORTANT: ye order EXACTLY wahi hona chahiye jo train_model.py mein tha.
# Apni train_model.py kholo, features wali line dekho, aur agar order alag hai
# to yahan bhi wahi order kar do. Warna prediction chup-chaap galat aayegi.
FEATURES = ["Close", "SMA20", "SMA50", "EMA20"]

# Model file isi folder mein hai — absolute path banate hain taki kahin se bhi
# script run karo, path na toote.
MODEL_PATH = Path(__file__).parent / "linear_regression_model.pkl"


# -----------------------------------------------------------------------------
# 1. DATA FETCHING
# -----------------------------------------------------------------------------

_cache = {}
CACHE_TTL = 600  # 10 minutes in seconds

def fetch_stock_data(symbol: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    """
    Yahoo Finance se historical data laata hai.
    Production-ready caching added to avoid rate limits.
    """
    cache_key = f"{symbol}_{period}_{interval}"
    now = time.time()
    
    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached_data.copy()

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
    except Exception as e:
        raise ValueError(f"Failed to fetch data for {symbol} due to external error. Try again later.")

    if df.empty:
        # Galat symbol ya Yahoo pe data nahi — caller ise handle karega
        raise ValueError(f"No data found for symbol '{symbol}'. Symbol sahi hai? (NSE ke liye .NS lagao)")

    df = df.reset_index()

    # yfinance timezone-aware dates deta hai (e.g. 2026-09-17 00:00:00+05:30).
    # JSON mein bhejne se pehle timezone hata dete hain — frontend ke liye clean.
    df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)
    
    final_df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]
    _cache[cache_key] = (final_df.copy(), now)
    
    return final_df


# -----------------------------------------------------------------------------
# 2. INDICATORS (Day 2 wala kaam)
# -----------------------------------------------------------------------------

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    SMA20, SMA50, EMA20 columns add karta hai.

    SMA = Simple Moving Average -> last N din ka simple average
    EMA = Exponential Moving Average -> recent din ko zyada weight
    """
    df = df.copy()  # original ko modify mat karo (side-effect avoid)

    df["SMA20"] = df["Close"].rolling(window=20).mean()
    df["SMA50"] = df["Close"].rolling(window=50).mean()
    df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()

    return df


# -----------------------------------------------------------------------------
# 3. MODEL LOADING (ek baar, cache karke)
# -----------------------------------------------------------------------------

_model = None  # underscore = "private", bahar se use mat karo


def load_model():
    """
    Model ko disk se load karta hai, lekin sirf PEHLI baar.
    Uske baad memory wali copy return kar deta hai (fast).
    """
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model file nahi mili: {MODEL_PATH}\n"
                "Pehle 'python train_model.py' chalao."
            )
        _model = joblib.load(MODEL_PATH)
    return _model


# -----------------------------------------------------------------------------
# 4. PREDICTION
# -----------------------------------------------------------------------------

def predict_next_close(symbol: str) -> dict:
    """
    Live data fetch -> indicators -> latest row se next-day Close predict.

    Return: ek dict jo seedha JSON response ban jayega.
    """
    df = fetch_stock_data(symbol, period="1y")   # 1 saal kaafi hai (SMA50 ke liye 50+ rows chahiye)
    df = add_indicators(df)
    df = df.dropna(subset=FEATURES)              # shuru ke 49 rows mein SMA50 NaN hoti hai

    if df.empty:
        raise ValueError(f"'{symbol}' ka itna data nahi hai ki indicators ban sakein.")

    latest = df.iloc[-1]                          # sabse recent trading day

    # Model ko 2D array chahiye: [[f1, f2, f3, f4]] — ek row, chaar features
    X_latest = latest[FEATURES].values.reshape(1, -1)

    model = load_model()
    predicted = float(model.predict(X_latest)[0])

    last_close = float(latest["Close"])
    change = predicted - last_close
    change_pct = (change / last_close) * 100

    # --- Dynamically evaluate metrics on recent data ---
    # We use a 20% hold-out test split from the fetched `df` for this symbol
    split_idx = int(len(df) * 0.8)
    test_df = df.iloc[split_idx:]
    test_df_copy = test_df.copy()
    test_df_copy["Target_Close"] = test_df_copy["Close"].shift(-1)
    test_df_copy = test_df_copy.dropna(subset=["Target_Close"])
    
    if not test_df_copy.empty:
        X_test = test_df_copy[FEATURES].values
        y_test = test_df_copy["Target_Close"].values
        preds = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, preds)
        rmse = np.sqrt(mean_squared_error(y_test, preds))
        r2 = r2_score(y_test, preds)
        
        metrics = {
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2, 4),
        }
    else:
        metrics = {"mae": 0, "rmse": 0, "r2": 0}

    return {
        "symbol": symbol.upper(),
        "last_date": latest["Date"].strftime("%Y-%m-%d"),
        "last_close": round(last_close, 2),
        "predicted_close": round(predicted, 2),
        "change": round(change, 2),
        "change_percent": round(change_pct, 2),
        "direction": "UP" if change > 0 else "DOWN",
        "indicators": {
            "SMA20": round(float(latest["SMA20"]), 2),
            "SMA50": round(float(latest["SMA50"]), 2),
            "EMA20": round(float(latest["EMA20"]), 2),
        },
        "metrics": metrics,
    }


# -----------------------------------------------------------------------------
# 5. HISTORY + PREDICTED LINE (React chart ke liye)
# -----------------------------------------------------------------------------

def get_history_with_predictions(symbol: str, days: int = 120) -> list[dict]:
    """
    Last N din ka actual price + model ki prediction — dono ek saath.
    React mein "Actual vs Predicted" chart isi se banega.

    Note: row i ke features se model row i+1 ka price predict karta hai.
    Isliye prediction ko ek din aage shift karte hain, warna chart
    galat align hoga.
    """
    df = fetch_stock_data(symbol, period="2y")
    df = add_indicators(df)
    df = df.dropna(subset=FEATURES).reset_index(drop=True)

    if df.empty:
        raise ValueError(f"'{symbol}' ka data nahi mila.")

    model = load_model()
    df["Predicted"] = model.predict(df[FEATURES].values)

    # shift(1) -> kal ki prediction aaj ki row ke saamne aa jayegi
    df["PredictedForToday"] = df["Predicted"].shift(1)

    recent = df.tail(days)

    out = []
    for _, row in recent.iterrows():
        pred = row["PredictedForToday"]
        out.append({
            "date": row["Date"].strftime("%Y-%m-%d"),
            "actual": round(float(row["Close"]), 2),
            "predicted": None if pd.isna(pred) else round(float(pred), 2),
            "sma20": round(float(row["SMA20"]), 2),
            "sma50": round(float(row["SMA50"]), 2),
        })
    return out


# -----------------------------------------------------------------------------
# Quick test: python stock_utils.py
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    result = predict_next_close("RELIANCE.NS")
    for key, value in result.items():
        print(f"{key}: {value}")

