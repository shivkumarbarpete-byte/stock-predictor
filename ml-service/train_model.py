"""
train_model.py
--------------
Multi-stock training, scale-free features, target = next-day return.
Do models train hote hain (Linear Regression + Random Forest) aur
SAME test set par compare hote hain. Naive baseline (return = 0) bhi.
Walk-forward CV, Direction Classifier, aur Feature Importance bhi evaluate hote hain.

Outputs:
  return_model.pkl         -> Linear Regression (app abhi yahi use karta hai)
  random_forest_model.pkl  -> Random Forest Regressor
  direction_model.pkl      -> Random Forest Classifier (UP/DOWN)
  metrics.json             -> dono models + naive + CV + classifier + feature importance

Run: python train_model.py
"""

import json

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, precision_score, r2_score, recall_score
from sklearn.model_selection import TimeSeriesSplit

from stock_utils import fetch_stock_data
from features import FEATURES, TARGET, build_features, add_target

SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "ITC.NS", "LT.NS", "SBIN.NS", "HINDUNILVR.NS", "BHARTIARTL.NS",
]
TEST_RATIO = 0.2
LINEAR_PATH = "return_model.pkl"
RF_PATH = "random_forest_model.pkl"
DIRECTION_PATH = "direction_model.pkl"
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


def print_single_split_table(results: list[dict]):
    print("\n=================== Single 80/20 Split Evaluation ===================")
    print(f"{'Model':<18}{'MAE (Rs)':>10}{'RMSE (Rs)':>11}{'R2':>9}{'Dir. Acc %':>12}")
    print("-" * 60)
    for r in results:
        da = "-" if r["directional_accuracy"] is None else r["directional_accuracy"]
        print(f"{r['model']:<18}{r['mae']:>10}{r['rmse']:>11}{r['r2']:>9}{da:>12}")


def run_walk_forward_cv(stock_dfs: list[pd.DataFrame], n_splits: int = 5) -> dict:
    """
    Walk-forward cross-validation using TimeSeriesSplit(n_splits=5).
    Har stock ke 5 folds nikaal kar fold k ke train & test sets ko across stocks pool karte hain.
    No future leakage, strictly past data used for training in each fold.
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    
    # Har stock ke split indices nikaalo
    stock_splits = []
    for df in stock_dfs:
        stock_splits.append(list(tscv.split(df)))

    # Models jinko CV mein evaluate karna hai
    model_names = ["Linear Regression", "Random Forest", "Naive (kal=aaj)"]
    fold_metrics = {name: {"mae": [], "rmse": [], "r2": [], "da": []} for name in model_names}

    for fold_idx in range(n_splits):
        train_dfs = []
        test_dfs = []

        for s_idx, df in enumerate(stock_dfs):
            train_idx, test_idx = stock_splits[s_idx][fold_idx]
            train_dfs.append(df.iloc[train_idx])
            test_dfs.append(df.iloc[test_idx])

        fold_train = pd.concat(train_dfs, ignore_index=True)
        fold_test = pd.concat(test_dfs, ignore_index=True)

        # Train models for this fold
        lr = LinearRegression()
        rf = RandomForestRegressor(
            n_estimators=200,
            max_depth=6,
            min_samples_leaf=50,
            n_jobs=-1,
            random_state=42,
        )

        lr.fit(fold_train[FEATURES], fold_train[TARGET])
        rf.fit(fold_train[FEATURES], fold_train[TARGET])

        y_true = fold_test[TARGET].values
        close = fold_test["Close"].values

        pred_lr = lr.predict(fold_test[FEATURES])
        pred_rf = rf.predict(fold_test[FEATURES])
        pred_naive = np.zeros_like(y_true)

        # Linear metrics
        eval_lr = evaluate("Linear Regression", y_true, pred_lr, close)
        fold_metrics["Linear Regression"]["mae"].append(eval_lr["mae"])
        fold_metrics["Linear Regression"]["rmse"].append(eval_lr["rmse"])
        fold_metrics["Linear Regression"]["r2"].append(eval_lr["r2"])
        fold_metrics["Linear Regression"]["da"].append(eval_lr["directional_accuracy"])

        # RF metrics
        eval_rf = evaluate("Random Forest", y_true, pred_rf, close)
        fold_metrics["Random Forest"]["mae"].append(eval_rf["mae"])
        fold_metrics["Random Forest"]["rmse"].append(eval_rf["rmse"])
        fold_metrics["Random Forest"]["r2"].append(eval_rf["r2"])
        fold_metrics["Random Forest"]["da"].append(eval_rf["directional_accuracy"])

        # Naive metrics
        eval_naive = evaluate("Naive (kal=aaj)", y_true, pred_naive, close)
        fold_metrics["Naive (kal=aaj)"]["mae"].append(eval_naive["mae"])
        fold_metrics["Naive (kal=aaj)"]["rmse"].append(eval_naive["rmse"])
        fold_metrics["Naive (kal=aaj)"]["r2"].append(eval_naive["r2"])

    # Aggregate across folds: mean and std
    cv_models = []
    for name in model_names:
        mae_m = float(np.mean(fold_metrics[name]["mae"]))
        mae_s = float(np.std(fold_metrics[name]["mae"]))
        rmse_m = float(np.mean(fold_metrics[name]["rmse"]))
        rmse_s = float(np.std(fold_metrics[name]["rmse"]))
        r2_m = float(np.mean(fold_metrics[name]["r2"]))
        r2_s = float(np.std(fold_metrics[name]["r2"]))

        if fold_metrics[name]["da"]:
            da_m = round(float(np.mean(fold_metrics[name]["da"])), 2)
            da_s = round(float(np.std(fold_metrics[name]["da"])), 2)
        else:
            da_m = None
            da_s = None

        cv_models.append({
            "model": name,
            "mae_mean": round(mae_m, 2),
            "mae_std": round(mae_s, 2),
            "rmse_mean": round(rmse_m, 2),
            "rmse_std": round(rmse_s, 2),
            "r2_mean": round(r2_m, 4),
            "r2_std": round(r2_s, 4),
            "directional_accuracy_mean": da_m,
            "directional_accuracy_std": da_s,
        })

    return {"n_splits": n_splits, "models": cv_models}


def print_cv_table(cv_data: dict):
    print(f"\n=================== Walk-Forward CV ({cv_data['n_splits']} Folds) ===================")
    print(f"{'Model':<18}{'MAE (mean±std)':>18}{'RMSE (mean±std)':>18}{'R2 (mean±std)':>20}{'Dir. Acc %':>18}")
    print("-" * 92)
    for m in cv_data["models"]:
        mae_str = f"{m['mae_mean']} ± {m['mae_std']}"
        rmse_str = f"{m['rmse_mean']} ± {m['rmse_std']}"
        r2_str = f"{m['r2_mean']} ± {m['r2_std']}"
        da_str = "-" if m["directional_accuracy_mean"] is None else f"{m['directional_accuracy_mean']}% ± {m['directional_accuracy_std']}%"
        print(f"{m['model']:<18}{mae_str:>18}{rmse_str:>18}{r2_str:>20}{da_str:>18}")


def train_direction_classifier(train: pd.DataFrame, test: pd.DataFrame) -> tuple[RandomForestClassifier, dict]:
    """Direction classifier: 1 if next-day return > 0 else 0."""
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=6,
        min_samples_leaf=50,
        n_jobs=-1,
        random_state=42,
    )

    y_train_dir = (train[TARGET] > 0).astype(int).values
    y_test_dir = (test[TARGET] > 0).astype(int).values

    clf.fit(train[FEATURES], y_train_dir)
    y_pred_dir = clf.predict(test[FEATURES])

    acc = round(float(accuracy_score(y_test_dir, y_pred_dir) * 100), 2)
    prec = round(float(precision_score(y_test_dir, y_pred_dir, zero_division=0) * 100), 2)
    rec = round(float(recall_score(y_test_dir, y_pred_dir, zero_division=0) * 100), 2)
    always_up_acc = round(float(np.mean(y_test_dir == 1) * 100), 2)

    metrics = {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "always_up_accuracy": always_up_acc,
    }
    return clf, metrics


def print_classifier_table(clf_metrics: dict):
    print("\n=================== Direction Classifier (Random Forest) ===================")
    print(f"{'Accuracy %':<16}{'Precision %':<16}{'Recall %':<16}{'Always-UP Baseline %':<22}")
    print("-" * 70)
    print(
        f"{clf_metrics['accuracy']:<16}"
        f"{clf_metrics['precision']:<16}"
        f"{clf_metrics['recall']:<16}"
        f"{clf_metrics['always_up_accuracy']:<22}"
    )


def compute_feature_importance(forest: RandomForestRegressor) -> list[dict]:
    """Random Forest regressor se feature importances nikaal kar sort karo."""
    importances = forest.feature_importances_
    items = []
    for name, imp in zip(FEATURES, importances):
        items.append({"feature": name, "importance": round(float(imp), 4)})
    items.sort(key=lambda x: x["importance"], reverse=True)
    return items


def print_feature_importance_table(feat_imp: list[dict]):
    print("\n=================== Feature Importance (Random Forest) ===================")
    print(f"{'Rank':<6}{'Feature':<20}{'Importance':>12}")
    print("-" * 38)
    for i, item in enumerate(feat_imp, 1):
        print(f"{i:<6}{item['feature']:<20}{item['importance']:>12.4f}")


def main():
    stock_dfs = []
    train_parts, test_parts = [], []

    for symbol in SYMBOLS:
        try:
            df = load_symbol(symbol)
        except Exception as e:
            print(f"[SKIP] {symbol}: {e}")
            continue
        stock_dfs.append(df)
        train_df, test_df = split_by_time(df)
        train_parts.append(train_df)
        test_parts.append(test_df)
        print(f"[OK] {symbol}: train={len(train_df)}, test={len(test_df)}")

    train = pd.concat(train_parts, ignore_index=True)
    test = pd.concat(test_parts, ignore_index=True)
    print(f"\nTotal train rows: {len(train)} | test rows: {len(test)}")

    # --- 1. Regressors (Single Split) ---
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

    single_split_results = [
        evaluate("Linear Regression", y_true, linear.predict(test[FEATURES]), close),
        evaluate("Random Forest", y_true, forest.predict(test[FEATURES]), close),
        evaluate("Naive (kal=aaj)", y_true, np.zeros_like(y_true), close),
    ]
    print_single_split_table(single_split_results)

    always_up = float(np.mean(y_true > 0) * 100)
    print(f"\nAlways-UP baseline directional accuracy: {always_up:.1f}%")

    # --- 2. Walk-Forward Cross Validation (5 folds) ---
    cv_data = run_walk_forward_cv(stock_dfs, n_splits=5)
    print_cv_table(cv_data)

    # --- 3. Direction Classifier ---
    direction_clf, clf_metrics = train_direction_classifier(train, test)
    print_classifier_table(clf_metrics)

    # --- 4. Feature Importance ---
    feat_imp = compute_feature_importance(forest)
    print_feature_importance_table(feat_imp)

    # --- 5. Save Models and Metrics ---
    joblib.dump({"model": linear, "features": FEATURES}, LINEAR_PATH)
    joblib.dump({"model": forest, "features": FEATURES}, RF_PATH)
    joblib.dump({"model": direction_clf, "features": FEATURES}, DIRECTION_PATH)

    metrics_payload = {
        "test_rows": int(len(test)),
        "always_up_directional_accuracy": round(always_up, 1),
        "models": single_split_results,
        "cv": cv_data,
        "direction_classifier": clf_metrics,
        "feature_importance": feat_imp,
    }

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics_payload, f, indent=2)

    print(f"\nSaved: {LINEAR_PATH}, {RF_PATH}, {DIRECTION_PATH}, {METRICS_PATH}")


if __name__ == "__main__":
    main()