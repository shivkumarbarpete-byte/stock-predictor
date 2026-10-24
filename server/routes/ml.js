import express from "express";

const router = express.Router();
const ML_BASE = process.env.ML_SERVICE_URL || "http://localhost:8000";

// FastAPI ko request forward karta hai — query string (?days=120&model=rf) ke saath
async function forward(path, req, res) {
  try {
    const url = new URL(path, ML_BASE);
    url.search = new URLSearchParams(req.query).toString();
    const r = await fetch(url);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ message: "ML service unavailable" });
  }
}

router.get("/history/:symbol", (req, res) =>
  forward(`history/${encodeURIComponent(req.params.symbol)}`, req, res)
);
router.get("/predict/:symbol", (req, res) =>
  forward(`predict/${encodeURIComponent(req.params.symbol)}`, req, res)
);
router.get("/quote/:symbol", (req, res) =>
  forward(`quote/${encodeURIComponent(req.params.symbol)}`, req, res)
);
router.get("/metrics", (req, res) => forward("metrics", req, res));
router.get("/ohlc/:symbol", (req, res) =>
  forward(`ohlc/${encodeURIComponent(req.params.symbol)}`, req, res)
);
router.get("/info/:symbol", (req, res) =>
  forward(`info/${encodeURIComponent(req.params.symbol)}`, req, res)
);
router.get("/indices", (req, res) => forward("indices", req, res));
router.get("/movers", (req, res) => forward("movers", req, res));

export default router;