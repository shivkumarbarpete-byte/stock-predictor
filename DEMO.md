# Demo Script & Interview Q&A

## 3-Minute Demo Script
1. **Introduction & Register (30s):** Open the live app, explain the 3-tier architecture. Register a new user to show full-stack auth working with MongoDB. Mention the "Waking up server" loading state if on free tier.
2. **Search a Stock (45s):** Search for `RELIANCE.NS`. Show the "Next Trading Day Forecast" card. Explain the Up/Down indicator, then open the Model Evaluation card: metrics are calculated on the last 120 trading days and compared with a naive baseline ("tomorrow's price = today's price"). Be upfront that the model is roughly equal to the baseline, because next-day stock returns are very noisy.
3. **Chart & Watchlist (45s):** Hover over the chart to show Actual vs Predicted prices alongside SMA 20/50. Click "Add to Watchlist" and show it appearing on the left panel.
4. **Compare & Export (60s):** Switch to "Compare Stocks" mode. Add `TCS.NS` and `INFY.NS` to compare percentage changes. Finally, click "Export CSV" to demonstrate downloading the dataset.

## Interview Questions

**1. Why did you choose Linear Regression for stock prediction?**
It's simple, interpretable, and a good baseline. The model predicts the next-day *return* (not the raw price) from scale-free features: SMA20/Close, SMA50/Close, EMA20/Close and RSI14. Using ratios instead of absolute prices lets one model work across different NIFTY stocks. I also compare it against a naive baseline ("tomorrow = today"), so I can tell whether the model actually learns anything.

**2. What are the limitations of this model?**
In my evaluation, the model did not beat the naive baseline: test MAE was about Rs 18.58 vs Rs 18.47 for the baseline, R² on returns was close to zero, and directional accuracy was below 50%. Next-day stock returns are very noisy, and moving averages and RSI are public information. Linear Regression also can't capture non-linear patterns or external events (news, earnings). So I treat the prediction as a demo of the ML pipeline, not as a trading signal.

**3. Why use an HTTP-only JWT cookie instead of `localStorage`?**
Storing JWTs in `localStorage` makes them vulnerable to Cross-Site Scripting (XSS) attacks. HTTP-only cookies cannot be read by JavaScript, significantly reducing this risk. `SameSite=none` and `Secure=true` allow it to work across domains (Vercel <-> Render) safely.

**4. How do the services communicate?**
The React client talks only to the Node/Express server. Express handles authentication and the watchlist itself, and for stock data and predictions it forwards the request to the FastAPI ML service through a proxy route (`/api/ml`, using the `ML_SERVICE_URL` environment variable). This way the browser never needs the ML service URL, CORS stays simple, and if the ML service is down Express returns a clean 502 "ML service unavailable" error.

**5. How are you avoiding Yahoo Finance rate limits?**
I implemented an in-memory caching mechanism (`_cache` dictionary) with a Time-To-Live (TTL) of 10 minutes in the Python service. This ensures rapid identical requests serve from memory instead of hitting the external API.

**6. What does `app.set('trust proxy', 1)` do in Express?**
When deployed on Render, the Node app sits behind a reverse proxy (load balancer). `trust proxy` tells Express to trust the headers set by the proxy (like `X-Forwarded-Proto`), which is required for secure cookies to work properly behind HTTPS proxies.

**7. Why use an SPA rewrite in Vercel?**
React Router handles routing on the client side. If a user refreshes the page at `/login`, the Vercel server looks for a `/login` folder/file and returns a 404. The `vercel.json` rewrite rule catches all requests and serves `index.html`, letting React Router take over.

**8. What would you improve next?**
I would implement an LSTM or XGBoost model for better time-series prediction accuracy, add a Redis cache layer for horizontal scalability instead of in-memory dictionaries, and use WebSockets for live intraday price updates.
