"""
train_model.py
--------------
Multi-stock training, scale-free features, target = next-day return.
Naive baseline (predicted return = 0) se comparison.

Run: python train_model.py
"""

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

from stock_utils import fetch_stock_data
from features import FEATURES, TARGET, build_features, add_target

SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "ITC.NS", "LT.NS", "SBIN.NS", "HINDUNILVR.NS", "BHARTIARTL.NS",
]
TEST_RATIO = 0.2
MODEL_PATH = "return_model.pkl"


def load_symbol(symbol: str) -> pd.DataFrame:
    df = fetch_stock_data(symbol, period="5y")
    df = build_features(df)
    df = add_target(df)
    df = df.dropna(subset=FEATURES + [TARGET]).reset_index(drop=True)
    df["Symbol"] = symbol
    return df


def split_by_time(df: pd.DataFrame):
    """Ek stock ke andar: pehle 80% train, aakhri 20% test."""
    split_idx = int(len(df) * (1 - TEST_RATIO))
    return df.iloc[:split_idx], df.iloc[split_idx:]


def main():
    train_parts, test_parts = [], []

    for symbol in SYMBOLS:
        try:
            df = load_symbol(symbol)
        except Exception as e:
            print(f"[SKIP] {symbol}: {e}")
            continue
        train_df, test_df = split_by_time(df)
        train_parts.append(train_df)
        test_parts.append(test_df)
        print(f"[OK] {symbol}: train={len(train_df)}, test={len(test_df)}")

    train = pd.concat(train_parts, ignore_index=True)
    test = pd.concat(test_parts, ignore_index=True)
    print(f"\nTotal train rows: {len(train)} | test rows: {len(test)}")

    # --- Train ---
    model = LinearRegression()
    model.fit(train[FEATURES], train[TARGET])

    # --- Evaluate on test ---
    y_true = test[TARGET].values
    pred_ret = model.predict(test[FEATURES])
    naive_ret = np.zeros_like(y_true)  # naive: kal = aaj, return = 0

    close = test["Close"].values
    actual_next = close * (1 + y_true)
    model_next = close * (1 + pred_ret)
    naive_next = close * (1 + naive_ret)

    mae_model = np.mean(np.abs(model_next - actual_next))
    mae_naive = np.mean(np.abs(naive_next - actual_next))

    print("\n=== TEST RESULTS (time-based split) ===")
    print(f"MAE (Rs)  model: {mae_model:.2f} | naive: {mae_naive:.2f}")
    print(f"R2 on return  model: {r2_score(y_true, pred_ret):.4f} | naive: {r2_score(y_true, naive_ret):.4f}")

    dir_acc = np.mean(np.sign(pred_ret) == np.sign(y_true)) * 100
    always_up = np.mean(y_true > 0) * 100
    print(f"Directional accuracy  model: {dir_acc:.1f}% | always-UP: {always_up:.1f}%")

    if mae_model < mae_naive:
        print("-> Model naive baseline se behtar hai.")
    else:
        print("-> Model naive baseline ko beat nahi kar paya (stock returns noisy hote hain).")

    # --- Save ---
    joblib.dump({"model": model, "features": FEATURES}, MODEL_PATH)
    print(f"\nModel saved as {MODEL_PATH}")


if __name__ == "__main__":
    main()