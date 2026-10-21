"""
features.py
-----------
Scale-free features: har stock ke liye same meaning (price level par depend nahi).
"""

import pandas as pd

# Order important hai: training aur prediction dono mein yahi order use hoga.
FEATURES = ["SMA20_ratio", "SMA50_ratio", "EMA20_ratio", "RSI14"]
TARGET = "Target_Return"


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """RSI (Wilder smoothing). Value 0-100 ke beech aati hai."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False, min_periods=period).mean()

    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input df mein 'Close' column hona chahiye.
    Output: wahi df + SMA20, SMA50, EMA20 (price wale, chart ke liye)
            + 4 scale-free feature columns.
    """
    df = df.copy()

    df["SMA20"] = df["Close"].rolling(window=20).mean()
    df["SMA50"] = df["Close"].rolling(window=50).mean()
    df["EMA20"] = df["Close"].ewm(span=20, adjust=False).mean()

    df["SMA20_ratio"] = df["SMA20"] / df["Close"]
    df["SMA50_ratio"] = df["SMA50"] / df["Close"]
    df["EMA20_ratio"] = df["EMA20"] / df["Close"]
    df["RSI14"] = compute_rsi(df["Close"], 14)

    return df


def add_target(df: pd.DataFrame) -> pd.DataFrame:
    """Next-day return: (kal ka Close / aaj ka Close) - 1. Sirf training ke liye."""
    df = df.copy()
    df[TARGET] = df["Close"].shift(-1) / df["Close"] - 1
    return df