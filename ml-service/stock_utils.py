"""
stock_utils.py
--------------
Data fetch + return-based prediction (v3, scale-free features).
FastAPI (main.py) ise import karta hai.
"""

import json
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from features import FEATURES, TARGET, build_features, add_target

BASE_DIR = Path(__file__).parent
MODEL_PATHS = {
    "linear": BASE_DIR / "return_model.pkl",
    "rf": BASE_DIR / "random_forest_model.pkl",
}
METRICS_PATH = BASE_DIR / "metrics.json"
EVAL_DAYS = 120  # metrics kitne recent trading days par nikalne hain

# -----------------------------------------------------------------------------
# 1. DATA FETCHING (cache ke saath)
# -----------------------------------------------------------------------------

_cache = {}
CACHE_TTL = 600  # 10 minutes


def fetch_stock_data(symbol: str, period: str = "2y", interval: str = "1d") -> pd.DataFrame:
    cache_key = f"{symbol}_{period}_{interval}"
    now = time.time()

    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if now - timestamp < CACHE_TTL:
            return cached_data.copy()

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
    except Exception:
        raise ValueError(f"Failed to fetch data for {symbol} due to external error. Try again later.")

    if df.empty:
        raise ValueError(f"No data found for symbol '{symbol}'. Symbol sahi hai? (NSE ke liye .NS lagao)")

    df = df.reset_index()
    df["Date"] = pd.to_datetime(df["Date"]).dt.tz_localize(None)

    final_df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]
    _cache[cache_key] = (final_df.copy(), now)
    return final_df


# -----------------------------------------------------------------------------
# 2. INDICATORS (features.py ko call karta hai)
# -----------------------------------------------------------------------------

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    return build_features(df)


def _prepare(symbol: str, period: str = "2y") -> pd.DataFrame:
    df = fetch_stock_data(symbol, period=period)
    df = build_features(df)
    df = df.dropna(subset=FEATURES).reset_index(drop=True)
    if df.empty:
        raise ValueError(f"'{symbol}' ka itna data nahi hai ki indicators ban sakein.")
    return df


# -----------------------------------------------------------------------------
# 3. MODEL LOADING
# -----------------------------------------------------------------------------

_models = {}


def load_model(name: str = "linear"):
    """name: 'linear' ya 'rf'. Ek baar load hone ke baad memory mein cache rehta hai."""
    if name not in MODEL_PATHS:
        raise ValueError(f"Unknown model '{name}'. Options: {list(MODEL_PATHS)}")
    if name not in _models:
        path = MODEL_PATHS[name]
        if not path.exists():
            raise FileNotFoundError(
                f"Model file nahi mili: {path}\nPehle 'python train_model.py' chalao."
            )
        _models[name] = joblib.load(path)["model"]
    return _models[name]


def load_metrics() -> dict:
    """train_model.py ne jo metrics.json banayi thi (test set ke results)."""
    if not METRICS_PATH.exists():
        raise FileNotFoundError("metrics.json nahi mili. Pehle 'python train_model.py' chalao.")
    with open(METRICS_PATH) as f:
        return json.load(f)


# -----------------------------------------------------------------------------
# 4. PREDICTION
# -----------------------------------------------------------------------------

def _compute_metrics(df: pd.DataFrame, model) -> dict:
    """Recent EVAL_DAYS par model vs naive baseline (kal = aaj)."""
    eval_df = add_target(df).dropna(subset=[TARGET]).tail(EVAL_DAYS)
    if len(eval_df) < 20:
        return {"mae": 0, "rmse": 0, "r2": 0, "naive_mae": 0, "directional_accuracy": 0}

    y = eval_df[TARGET].values
    pred = model.predict(eval_df[FEATURES])
    close = eval_df["Close"].values

    actual_next = close * (1 + y)
    model_next = close * (1 + pred)

    return {
        "mae": round(float(mean_absolute_error(actual_next, model_next)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(actual_next, model_next))), 2),
        "r2": round(float(r2_score(y, pred)), 4),  # return par R2
        "naive_mae": round(float(mean_absolute_error(actual_next, close)), 2),
        "directional_accuracy": round(float(np.mean(np.sign(pred) == np.sign(y)) * 100), 1),
    }


def predict_next_close(symbol: str, model_name: str = "linear") -> dict:
    df = _prepare(symbol)
    latest = df.iloc[-1]
    model = load_model(model_name)

    pred_return = float(model.predict(df[FEATURES].iloc[[-1]])[0])
    last_close = float(latest["Close"])
    predicted = last_close * (1 + pred_return)
    change = predicted - last_close

    return {
        "symbol": symbol.upper(),
        "model": model_name,
        "last_date": latest["Date"].strftime("%Y-%m-%d"),
        "last_close": round(last_close, 2),
        "predicted_close": round(predicted, 2),
        "change": round(change, 2),
        "change_percent": round(pred_return * 100, 2),
        "direction": "UP" if change > 0 else "DOWN",
        "indicators": {
            "SMA20": round(float(latest["SMA20"]), 2),
            "SMA50": round(float(latest["SMA50"]), 2),
            "EMA20": round(float(latest["EMA20"]), 2),
        },
        "metrics": _compute_metrics(df, model),
    }


# -----------------------------------------------------------------------------
# 5. HISTORY + PREDICTED LINE (React chart ke liye)
# -----------------------------------------------------------------------------

def get_history_with_predictions(symbol: str, days: int = 120, model_name: str = "linear") -> list[dict]:
    df = _prepare(symbol)
    model = load_model(model_name)

    pred_return = model.predict(df[FEATURES])
    df["PredictedNext"] = df["Close"] * (1 + pred_return)
    # row i ki prediction row i+1 ke liye hai -> ek din aage shift
    df["PredictedForToday"] = df["PredictedNext"].shift(1)

    out = []
    for _, row in df.tail(days).iterrows():
        pred = row["PredictedForToday"]
        out.append({
            "date": row["Date"].strftime("%Y-%m-%d"),
            "actual": round(float(row["Close"]), 2),
            "predicted": None if pd.isna(pred) else round(float(pred), 2),
            "sma20": round(float(row["SMA20"]), 2),
            "sma50": round(float(row["SMA50"]), 2),
        })
    return out