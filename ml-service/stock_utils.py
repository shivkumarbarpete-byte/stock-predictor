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


# -----------------------------------------------------------------------------
# 6. OHLC CANDLESTICKS + COMPREHENSIVE STOCK INFO (Groww/Zerodha style)
# -----------------------------------------------------------------------------

OHLC_RANGE_MAP = {
    "1d": ("1d", "5m"),
    "5d": ("5d", "15m"),
    "1mo": ("1mo", "1d"),
    "6mo": ("6mo", "1d"),
    "1y": ("1y", "1d"),
    "5y": ("5y", "1wk"),
}


def get_ohlc(symbol: str, range_key: str) -> list[dict]:
    """
    range_key: '1d', '5d', '1mo', '6mo', '1y', '5y'
    Returns list of {time, open, high, low, close, volume}.
    Intraday ranges ('1d', '5d') return unix timestamp in seconds (UTC).
    Daily/weekly ranges return 'YYYY-MM-DD'.
    """
    if range_key not in OHLC_RANGE_MAP:
        raise ValueError(
            f"Invalid range '{range_key}'. Allowed ranges: {list(OHLC_RANGE_MAP.keys())}"
        )

    is_intraday = range_key in ("1d", "5d")
    ttl = 60 if is_intraday else 600
    cache_key = f"ohlc_{symbol}_{range_key}"
    now = time.time()

    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if now - timestamp < ttl:
            return [dict(item) for item in cached_data]

    period, interval = OHLC_RANGE_MAP[range_key]

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
    except Exception as e:
        raise ValueError(f"Failed to fetch OHLC data for {symbol}: {e}")

    if df.empty:
        raise ValueError(f"No OHLC data found for symbol '{symbol}'. Symbol sahi hai? (NSE ke liye .NS lagao)")

    df = df.reset_index()

    # Determine datetime column
    dt_col = None
    for candidate in ("Datetime", "Date"):
        if candidate in df.columns:
            dt_col = candidate
            break

    if not dt_col:
        raise ValueError(f"Could not identify date column in history for {symbol}")

    # Ensure valid numbers and drop NaN rows
    df = df.dropna(subset=[dt_col, "Open", "High", "Low", "Close", "Volume"]).copy()
    if df.empty:
        raise ValueError(f"No valid OHLC points for '{symbol}'.")

    # Time formatting
    ts_series = pd.to_datetime(df[dt_col], utc=True)
    if is_intraday:
        df["time"] = ts_series.map(lambda x: int(x.timestamp()))
    else:
        df["time"] = ts_series.dt.strftime("%Y-%m-%d")

    # Drop duplicate times and sort ascending
    df = df.drop_duplicates(subset=["time"]).sort_values(by="time", ascending=True)

    result = []
    for _, row in df.iterrows():
        result.append({
            "time": row["time"],
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]),
        })

    _cache[cache_key] = ([dict(item) for item in result], now)
    return result


def get_stock_info(symbol: str) -> dict:
    """
    Returns comprehensive fundamentals and price statistics for stock detail page.
    Defensively extracts info & fast_info without raising when fields are missing.
    Cached with TTL = 600s (10 minutes).
    """
    cache_key = f"info_{symbol}"
    now = time.time()

    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if now - timestamp < 600:
            return dict(cached_data)

    try:
        ticker = yf.Ticker(symbol)
        fast = getattr(ticker, "fast_info", {})
        try:
            info = ticker.info or {}
        except Exception:
            info = {}
    except Exception as e:
        raise ValueError(f"Failed to fetch stock info for {symbol}: {e}")

    def _val(*keys, default=None):
        for k in keys:
            if hasattr(fast, k) and getattr(fast, k) is not None:
                val = getattr(fast, k)
                if not (isinstance(val, float) and np.isnan(val)):
                    return val
            if isinstance(fast, dict) and fast.get(k) is not None:
                val = fast[k]
                if not (isinstance(val, float) and np.isnan(val)):
                    return val
            if isinstance(info, dict) and info.get(k) is not None:
                val = info[k]
                if not (isinstance(val, float) and np.isnan(val)):
                    return val
        return default

    # If both fast_info and info are completely empty, check if symbol exists
    name_val = _val("shortName", "longName", "name", default=None)
    market_cap_val = _val("marketCap", "market_cap", default=None)
    prev_close_val = _val("previousClose", "previous_close", "regularMarketPreviousClose", default=None)
    open_val = _val("open", "regularMarketOpen", default=None)

    if not name_val and not market_cap_val and not prev_close_val:
        # Check if symbol has any history
        try:
            hist = ticker.history(period="5d")
            if hist.empty:
                raise ValueError(f"No stock data found for '{symbol}'.")
        except Exception:
            raise ValueError(f"No stock data found for '{symbol}'.")

    def _safe_float(val, decimals=2):
        if val is None:
            return None
        try:
            f = float(val)
            if np.isnan(f) or np.isinf(f):
                return None
            return round(f, decimals)
        except (ValueError, TypeError):
            return None

    def _safe_int(val):
        if val is None:
            return None
        try:
            f = float(val)
            if np.isnan(f) or np.isinf(f):
                return None
            return int(f)
        except (ValueError, TypeError):
            return None

    res = {
        "symbol": symbol.upper(),
        "name": name_val or symbol.upper().replace(".NS", ""),
        "sector": _val("sector", default=None),
        "industry": _val("industry", default=None),
        "market_cap": _safe_int(market_cap_val),
        "pe_ratio": _safe_float(_val("trailingPE", "forwardPE", "pe_ratio", default=None), 2),
        "week52_high": _safe_float(_val("yearHigh", "fiftyTwoWeekHigh", "week52_high", default=None), 2),
        "week52_low": _safe_float(_val("yearLow", "fiftyTwoWeekLow", "week52_low", default=None), 2),
        "day_high": _safe_float(_val("dayHigh", "regularMarketDayHigh", "day_high", default=None), 2),
        "day_low": _safe_float(_val("dayLow", "regularMarketDayLow", "day_low", default=None), 2),
        "prev_close": _safe_float(prev_close_val, 2),
        "open": _safe_float(open_val, 2),
        "volume": _safe_int(_val("lastVolume", "regularMarketVolume", "volume", default=None)),
        "avg_volume": _safe_int(_val("averageVolume", "averageVolume10days", "avg_volume", default=None)),
        "dividend_yield": _safe_float(_val("dividendYield", "trailingAnnualDividendYield", default=None), 4),
    }

    _cache[cache_key] = (dict(res), now)
    return res


# -----------------------------------------------------------------------------
# 7. MARKET INDICES & NIFTY 50 MOVERS (Live Market App feel)
# -----------------------------------------------------------------------------

INDEX_DEFINITIONS = [
    {"symbol": "^NSEI", "name": "NIFTY 50"},
    {"symbol": "^BSESN", "name": "SENSEX"},
    {"symbol": "^NSEBANK", "name": "BANK NIFTY"},
]


def get_indices() -> list[dict]:
    """
    Returns NIFTY 50, SENSEX, BANK NIFTY quotes [{symbol, name, price, change, change_percent}].
    Tolerates individual missing indices with nulls.
    Cached with TTL = 30s.
    """
    cache_key = "market_indices"
    now = time.time()

    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if now - timestamp < 30:
            return [dict(item) for item in cached_data]

    results = []
    symbols = [idx["symbol"] for idx in INDEX_DEFINITIONS]

    try:
        data = yf.download(symbols, period="5d", interval="1d", progress=False)
        close_df = data["Close"] if "Close" in data else pd.DataFrame()
    except Exception:
        close_df = pd.DataFrame()

    for idx in INDEX_DEFINITIONS:
        sym = idx["symbol"]
        price = None
        change = None
        change_pct = None

        try:
            if not close_df.empty and sym in close_df.columns:
                series = close_df[sym].dropna()
                if len(series) >= 1:
                    price = float(series.iloc[-1])
                    prev = float(series.iloc[-2]) if len(series) >= 2 else price
                    change = price - prev
                    change_pct = (change / prev) * 100 if prev > 0 else 0
        except Exception:
            pass

        # Fallback to Ticker if download failed for this symbol
        if price is None:
            try:
                t = yf.Ticker(sym)
                fast = getattr(t, "fast_info", {})
                last_p = getattr(fast, "lastPrice", None)
                prev_c = getattr(fast, "previousClose", None)
                if last_p is not None:
                    price = float(last_p)
                    if prev_c is not None:
                        change = price - float(prev_c)
                        change_pct = (change / float(prev_c)) * 100
            except Exception:
                pass

        results.append({
            "symbol": sym,
            "name": idx["name"],
            "price": round(price, 2) if price is not None else None,
            "change": round(change, 2) if change is not None else None,
            "change_percent": round(change_pct, 2) if change_pct is not None else None,
        })

    _cache[cache_key] = ([dict(item) for item in results], now)
    return results


def get_movers() -> dict:
    """
    Top 5 gainers and top 5 losers among NIFTY 50 stocks using ONE batched yf.download call.
    Also returns sector-level average performance for a sector heatmap.
    Cached with TTL = 60s.
    """
    cache_key = "nifty50_movers"
    now = time.time()

    if cache_key in _cache:
        cached_data, timestamp = _cache[cache_key]
        if now - timestamp < 60:
            return dict(cached_data)

    from nifty50_sectors import NIFTY50_SECTOR_MAP, NIFTY50_SYMBOLS

    try:
        df = yf.download(NIFTY50_SYMBOLS, period="5d", interval="1d", progress=False)
        close_df = df["Close"] if "Close" in df else pd.DataFrame()
    except Exception as e:
        raise ValueError(f"Failed to batch download NIFTY 50 quotes: {e}")

    stock_stats = []

    if not close_df.empty:
        for sym in NIFTY50_SYMBOLS:
            if sym not in close_df.columns:
                continue
            series = close_df[sym].dropna()
            if len(series) < 1:
                continue

            latest_close = float(series.iloc[-1])
            prev_close = float(series.iloc[-2]) if len(series) >= 2 else latest_close
            change = latest_close - prev_close
            pct_change = (change / prev_close) * 100 if prev_close > 0 else 0

            sector = NIFTY50_SECTOR_MAP.get(sym, "Other")

            stock_stats.append({
                "symbol": sym,
                "price": round(latest_close, 2),
                "change": round(change, 2),
                "change_percent": round(pct_change, 2),
                "sector": sector,
            })

    # Sort descending by change_percent
    stock_stats.sort(key=lambda s: s["change_percent"], reverse=True)

    gainers = stock_stats[:5]
    losers = sorted(stock_stats[-5:], key=lambda s: s["change_percent"]) if len(stock_stats) >= 5 else []

    # Sector heatmap aggregation
    sector_changes = {}
    for item in stock_stats:
        sec = item["sector"]
        if sec not in sector_changes:
            sector_changes[sec] = []
        sector_changes[sec].append(item["change_percent"])

    sector_heatmap = []
    for sec, pct_list in sector_changes.items():
        avg_pct = sum(pct_list) / len(pct_list) if pct_list else 0
        sector_heatmap.append({
            "sector": sec,
            "average_change_percent": round(avg_pct, 2),
            "stock_count": len(pct_list),
        })

    sector_heatmap.sort(key=lambda s: s["average_change_percent"], reverse=True)

    payload = {
        "count": len(stock_stats),
        "gainers": gainers,
        "losers": losers,
        "sectors": sector_heatmap,
    }

    _cache[cache_key] = (dict(payload), now)
    return payload