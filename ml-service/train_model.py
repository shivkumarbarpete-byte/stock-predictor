"""
train_model.py
--------------
Multi-stock training, scale-free features, target = next-day return.
Do models train hote hain (Linear Regression + Random Forest) aur
SAME test set par compare hote hain. Naive baseline (return = 0) bhi.

Outputs:
  return_model.pkl         -> Linear Regression (app abhi yahi use karta hai)
  random_forest_model.pkl  -> Random Forest
  metrics.json             -> dono models + naive ke test metrics

Run: python train_model.py
"""

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from stock_utils import fetch_stock_data
from features import FEATURES, TARGET, build_features, add_target

SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "ITC.NS", "LT.NS", "SBIN.NS", "HINDUNILVR.NS", "BHARTIARTL.NS",
]
TEST_RATIO = 0.2
LINEAR_PATH = "return_model.pkl"
RF_PATH = "random_forest_model.pkl"
METRICS_PATH = "metrics.json"


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


def evaluate(name: str, y_true: np.ndarray, pred_ret: np.ndarray, close: np.ndarray) -> dict:
    """Ek model ke saare metrics. Price metrics Rs mein, R2 return par."""
    actual_next = close * (1 + y_true)
    model_next = close * (1 + pred_ret)
    return {
        "model": name,
        "mae": round(float(mean_absolute_error(actual_next, model_next)), 2),
        "rmse": round(float(np.sqrt(mean_squared_error(actual_next, model_next))), 2),
        "r2": round(float(r2_score(y_true, pred_ret)), 4),
        # naive ka koi direction nahi hota (return=0), isliye uska accuracy N/A
        "directional_accuracy": None
        if not np.any(pred_ret)
        else round(float(np.mean(np.sign(pred_ret) == np.sign(y_true)) * 100), 1),
    }


def print_table(results: list[dict]):
    print(f"\n{'Model':<18}{'MAE (Rs)':>10}{'RMSE (Rs)':>11}{'R2':>9}{'Dir. Acc %':>12}")
    print("-" * 60)
    for r in results:
        da = "-" if r["directional_accuracy"] is None else r["directional_accuracy"]
        print(f"{r['model']:<18}{r['mae']:>10}{r['rmse']:>11}{r['r2']:>9}{da:>12}")


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

    # --- Models ---
    linear = LinearRegression()
    forest = RandomForestRegressor(
        n_estimators=200,
        max_depth=6,            # gehre trees noise yaad kar lete hain (overfit)
        min_samples_leaf=50,    # har leaf mein kam se kam 50 rows
        n_jobs=-1,
        random_state=42,
    )

    linear.fit(train[FEATURES], train[TARGET])
    forest.fit(train[FEATURES], train[TARGET])

    # --- Evaluate: dono ko SAME test set par ---
    y_true = test[TARGET].values
    close = test["Close"].values

    results = [
        evaluate("Linear Regression", y_true, linear.predict(test[FEATURES]), close),
        evaluate("Random Forest", y_true, forest.predict(test[FEATURES]), close),
        evaluate("Naive (kal=aaj)", y_true, np.zeros_like(y_true), close),
    ]
    print_table(results)

    always_up = float(np.mean(y_true > 0) * 100)
    print(f"\nAlways-UP baseline directional accuracy: {always_up:.1f}%")

    # --- Save ---
    joblib.dump({"model": linear, "features": FEATURES}, LINEAR_PATH)
    joblib.dump({"model": forest, "features": FEATURES}, RF_PATH)

    with open(METRICS_PATH, "w") as f:
        json.dump(
            {
                "test_rows": int(len(test)),
                "always_up_directional_accuracy": round(always_up, 1),
                "models": results,
            },
            f,
            indent=2,
        )
    print(f"\nSaved: {LINEAR_PATH}, {RF_PATH}, {METRICS_PATH}")


if __name__ == "__main__":
    main()