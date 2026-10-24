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
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from stock_utils import (
    fetch_stock_data,
    get_history_with_predictions,
    get_indices,
    get_movers,
    get_ohlc,
    get_stock_info,
    load_metrics,
    load_model,
    predict_next_close,
)

app = FastAPI(
    title="Stock Prediction API",
    description="NIFTY 50 stocks ke liye next-day close price prediction (Linear Regression / Random Forest)",
    version="1.1.0",
)

# ---------------------------------------------------------------------------
# CORS — React alag port pe chalega, usse request allow karni padegi.
# Deploy ke time CLIENT_URL env variable mein apna Vercel URL daalenge.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# STARTUP — app boot hote hi dono models load kar lo (pehli request slow na ho)
# ---------------------------------------------------------------------------

@app.on_event("startup")
def startup_event():
    for name in ("linear", "rf"):
        try:
            load_model(name)
            print(f"[OK] Model '{name}' loaded")
        except Exception as e:
            print(f"[WARN] Model '{name}' load nahi hua: {e}")


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    """Health check — service zinda hai ya nahi."""
    return {
        "status": "running",
        "service": "Stock Prediction API",
        "endpoints": ["/predict/{symbol}", "/history/{symbol}", "/quote/{symbol}", "/metrics", "/docs", "/health"],
    }


@app.get("/health")
def health():
    return {"status": "ok", "service": "ml-service"}


@app.get("/metrics")
def metrics():
    """Test-set par Linear vs Random Forest vs Naive ka comparison (metrics.json se)."""
    try:
        return load_metrics()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/predict/{symbol}")
def predict(symbol: str, model: Literal["linear", "rf"] = "linear"):
    """
    Next trading day ka predicted close price.

    Example: /predict/RELIANCE.NS?model=rf
    """
    if not symbol.upper().endswith(".NS"):
        raise HTTPException(status_code=400, detail="Only NIFTY 50 symbols (.NS suffix) are supported")
    try:
        return predict_next_close(symbol, model)
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
    model: Literal["linear", "rf"] = "linear",
):
    """
    Actual vs Predicted price ka historical data — React chart ke liye.

    Example: /history/TCS.NS?days=90&model=rf
    """
    try:
        data = get_history_with_predictions(symbol, days=days, model_name=model)
        return {"symbol": symbol.upper(), "model": model, "count": len(data), "data": data}
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


@app.get("/ohlc/{symbol}")
def ohlc(symbol: str, range: str = Query("1mo", description="Range: 1d, 5d, 1mo, 6mo, 1y, 5y")):
    """
    Candlestick OHLC + Volume data.
    Valid ranges: 1d, 5d, 1mo, 6mo, 1y, 5y
    """
    valid_ranges = {"1d", "5d", "1mo", "6mo", "1y", "5y"}
    if range not in valid_ranges:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid range '{range}'. Valid ranges: {sorted(list(valid_ranges))}",
        )
    try:
        data = get_ohlc(symbol, range)
        return {
            "symbol": symbol.upper(),
            "range": range,
            "count": len(data),
            "data": data,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/info/{symbol}")
def info(symbol: str):
    """
    Comprehensive stock fundamentals and stats (sector, market_cap, pe_ratio, 52w high/low, etc.).
    """
    try:
        return get_stock_info(symbol)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/indices")
def indices():
    """
    Returns NIFTY 50, SENSEX, BANK NIFTY indices with 30s cache.
    """
    try:
        return get_indices()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/movers")
def movers():
    """
    Returns top 5 gainers, top 5 losers, and per-sector average changes among NIFTY 50 with 60s cache.
    """
    try:
        return get_movers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")