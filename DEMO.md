# Demo Script & Interview Q&A

## 3-Minute Demo Script
1. **Introduction & Register (30s):** Open the live app, explain the 3-tier architecture. Register a new user to show full-stack auth working with MongoDB. Mention the "Waking up server" loading state if on free tier.
2. **Search a Stock (45s):** Search for `RELIANCE.NS`. Show the "Next-Day Predicted Price" summary card. Explain the Up/Down indicator and the Model Accuracy (MAE, RMSE, R²) metrics dynamically calculated on the latest 20% hold-out split.
3. **Chart & Watchlist (45s):** Hover over the chart to show Actual vs Predicted prices alongside SMA 20/50. Click "Add to Watchlist" and show it appearing on the left panel.
4. **Compare & Export (60s):** Switch to "Compare Stocks" mode. Add `TCS.NS` and `INFY.NS` to compare percentage changes. Finally, click "Export CSV" to demonstrate downloading the dataset.

## Interview Questions

**1. Why did you choose Linear Regression for stock prediction?**
It's simple, interpretable, and computationally inexpensive. It acts as a great baseline model. We can easily explain *how* it uses SMA/EMA to predict the next price, unlike a black-box deep learning model.

**2. What are the limitations of this model?**
Linear Regression assumes a linear relationship between past moving averages and future prices, which is rarely true for highly volatile stock markets. It doesn't capture non-linear patterns or external events (news, earnings).

**3. Why use an HTTP-only JWT cookie instead of `localStorage`?**
Storing JWTs in `localStorage` makes them vulnerable to Cross-Site Scripting (XSS) attacks. HTTP-only cookies cannot be read by JavaScript, significantly reducing this risk. `SameSite=none` and `Secure=true` allow it to work across domains (Vercel <-> Render) safely.

**4. How do the services communicate?**
The React client acts as the central hub. It calls the Node/Express server for user authentication and watchlist management. It calls the FastAPI ML service for stock data, indicators, and predictions. The backend services do not communicate directly with each other.

**5. How are you avoiding Yahoo Finance rate limits?**
I implemented an in-memory caching mechanism (`_cache` dictionary) with a Time-To-Live (TTL) of 10 minutes in the Python service. This ensures rapid identical requests serve from memory instead of hitting the external API.

**6. What does `app.set('trust proxy', 1)` do in Express?**
When deployed on Render, the Node app sits behind a reverse proxy (load balancer). `trust proxy` tells Express to trust the headers set by the proxy (like `X-Forwarded-Proto`), which is required for secure cookies to work properly behind HTTPS proxies.

**7. Why use an SPA rewrite in Vercel?**
React Router handles routing on the client side. If a user refreshes the page at `/login`, the Vercel server looks for a `/login` folder/file and returns a 404. The `vercel.json` rewrite rule catches all requests and serves `index.html`, letting React Router take over.

**8. What would you improve next?**
I would implement an LSTM or XGBoost model for better time-series prediction accuracy, add a Redis cache layer for horizontal scalability instead of in-memory dictionaries, and use WebSockets for live intraday price updates.
