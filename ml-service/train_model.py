"""
Day 3: Train a Linear Regression model to predict next-day Close price
-------------------------------------------------------------------------
Concept notes:
- Target = tomorrow's Close price -> we create this by "shifting" the
  Close column up by 1 row (shift(-1)).
- Features = today's Close, SMA20, SMA50, EMA20
- We do a TIME-ORDERED train/test split (NOT random shuffle) because
  shuffling would let the model "see the future" during training,
  which is a classic mistake called data leakage.
- Metrics used:
    - RMSE (Root Mean Squared Error): average prediction error, in Rupees.
      Lower = better. Easy to explain to anyone: "on average we're off
      by ~X rupees".
    - R^2 score: how much of the price variation the model explains
      (1.0 = perfect, 0 = no better than guessing the average).
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import matplotlib.pyplot as plt


FEATURES = ["Close", "SMA20", "SMA50", "EMA20"]
TARGET = "Target_Close"


def prepare_data(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, parse_dates=["Date"])

    # Drop rows where SMA50/EMA20 are NaN (first ~49 rows, not enough history)
    df = df.dropna(subset=FEATURES)

    # Target = next day's Close price
    df[TARGET] = df["Close"].shift(-1)

    # Last row now has no "next day" -> drop it
    df = df.dropna(subset=[TARGET])

    df = df.reset_index(drop=True)
    return df


def train_test_split_by_time(df: pd.DataFrame, test_ratio: float = 0.2):
    split_idx = int(len(df) * (1 - test_ratio))

    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    print(f"Train rows: {len(train_df)} (up to {train_df['Date'].max().date()})")
    print(f"Test rows : {len(test_df)} (from {test_df['Date'].min().date()} to {test_df['Date'].max().date()})")

    return train_df, test_df


def train_model(train_df: pd.DataFrame) -> LinearRegression:
    X_train = train_df[FEATURES]
    y_train = train_df[TARGET]

    model = LinearRegression()
    model.fit(X_train, y_train)

    return model


def evaluate_model(model: LinearRegression, test_df: pd.DataFrame):
    X_test = test_df[FEATURES]
    y_test = test_df[TARGET]

    predictions = model.predict(X_test)

    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    r2 = r2_score(y_test, predictions)

    print(f"\nRMSE: Rs. {rmse:.2f}  (average prediction error)")
    print(f"R^2 score: {r2:.4f}  (1.0 = perfect fit)")

    return predictions, y_test


def plot_actual_vs_predicted(test_df: pd.DataFrame, y_test, predictions):
    plt.figure(figsize=(10, 5))
    plt.plot(test_df["Date"], y_test.values, label="Actual", linewidth=2)
    plt.plot(test_df["Date"], predictions, label="Predicted", linewidth=2, linestyle="--")
    plt.title("Actual vs Predicted Close Price (Test set)")
    plt.xlabel("Date")
    plt.ylabel("Price (Rs.)")
    plt.legend()
    plt.tight_layout()
    plt.savefig("actual_vs_predicted.png")
    print("\nChart saved as actual_vs_predicted.png")


if __name__ == "__main__":
    INPUT_CSV = "RELIANCE_data_with_indicators.csv"

    data = prepare_data(INPUT_CSV)
    print(f"Usable rows after cleaning: {len(data)}")

    train_df, test_df = train_test_split_by_time(data)

    model = train_model(train_df)
    predictions, y_test = evaluate_model(model, test_df)

    plot_actual_vs_predicted(test_df, y_test, predictions)

    # Save the trained model so FastAPI can load it later
    joblib.dump(model, "linear_regression_model.pkl")
    print("Model saved as linear_regression_model.pkl")