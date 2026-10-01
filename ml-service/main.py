"""
main.py
-------
FastAPI service jo ML model ko REST API ki tarah expose karti hai.

Run karne ke liye (ml-service folder mein, venv active):
    uvicorn main:app --reload --port 8000

Phir browser mein kholo:
    http://127.0.0.1:8000/docs      <- auto-generated interactive API docs
"""

import os
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from stock_utils import (
    fetch_stock_data,
    get_history_with_predictions,
    load_model,
    predict_next_close,
)

app = FastAPI(
    title="Stock Prediction API",
    description="NIFTY 50 stocks ke liye next-day close price prediction (Linear Regression)",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — React alag port pe chalega, usse request allow karni padegi.
# Abhi development ke liye "*" (sab allow). Deploy ke time (Week 4) ise
# apne actual Vercel URL se replace karenge — security best practice.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# STARTUP — app boot hote hi model load kar lo (pehli request slow na ho)
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup_event():
    try:
        load_model()
        print("[OK] Model loaded successfully")
    except Exception as e:
        print(f"[WARN] Model load nahi hua: {e}")


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    """Health check — service zinda hai ya nahi."""
    return {
        "status": "running",
        "service": "Stock Prediction API",
        "endpoints": ["/predict/{symbol}", "/history/{symbol}", "/quote/{symbol}", "/docs", "/health"],
    }

@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}


@app.get("/predict/{symbol}")
def predict(symbol: str):
    """
    Next trading day ka predicted close price.

    Example: /predict/RELIANCE.NS
    """
    if not symbol.upper().endswith(".NS"):
        raise HTTPException(status_code=400, detail="Only NIFTY 50 symbols (.NS suffix) are supported")
    try:
        return predict_next_close(symbol)
    except ValueError as e:
        # Client ki galti (galat symbol) -> 404
        raise HTTPException(status_code=404, detail=str(e))
    except FileNotFoundError as e:
        # Server ki galti (model missing) -> 500
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/history/{symbol}")
def history(
    symbol: str,
    days: int = Query(120, ge=10, le=500, description="Kitne din ka data chahiye"),
):
    """
    Actual vs Predicted price ka historical data — React chart ke liye.

    Example: /history/TCS.NS?days=90

    Query(120, ge=10, le=500) ka matlab: default 120, minimum 10, maximum 500.
    FastAPI khud validate karega — agar koi days=9999 bhejega to 422 error
    automatically aa jayegi. Ye Express mein manually likhna padta hai.
    """
    try:
        data = get_history_with_predictions(symbol, days=days)
        return {"symbol": symbol.upper(), "count": len(data), "data": data}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/quote/{symbol}")
def quote(symbol: str):
    """
    Latest price snapshot (bina ML ke) — dashboard ke header ke liye kaam aayega.
    """
    try:
        df = fetch_stock_data(symbol, period="5d")
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest

        change = float(latest["Close"]) - float(prev["Close"])
        return {
            "symbol": symbol.upper(),
            "date": latest["Date"].strftime("%Y-%m-%d"),
            "open": round(float(latest["Open"]), 2),
            "high": round(float(latest["High"]), 2),
            "low": round(float(latest["Low"]), 2),
            "close": round(float(latest["Close"]), 2),
            "volume": int(latest["Volume"]),
            "change": round(change, 2),
            "change_percent": round((change / float(prev["Close"])) * 100, 2),
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")