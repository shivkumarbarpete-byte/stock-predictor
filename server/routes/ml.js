import express from "express";

const router = express.Router();
const ML_BASE = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function forward(path, res) {
  try {
    const r = await fetch(new URL(path, ML_BASE));
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ message: "ML service unavailable" });
  }
}

router.get("/history/:symbol", (req, res) =>
  forward(`history/${encodeURIComponent(req.params.symbol)}`, res)
);
router.get("/predict/:symbol", (req, res) =>
  forward(`predict/${encodeURIComponent(req.params.symbol)}`, res)
);
router.get("/quote/:symbol", (req, res) =>
  forward(`quote/${encodeURIComponent(req.params.symbol)}`, res)
);

export default router;