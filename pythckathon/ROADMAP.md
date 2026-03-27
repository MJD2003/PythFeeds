# PythFeeds — Roadmap, Suggestions & AI Integration Plan

## ✅ Already Built
- Real-time Pyth prices across all pages (SSE + 10s polling)
- Coin/Stock detail pages with live price, confidence intervals, news tab
- Heatmap, Bubbles, Gainers & Losers, Correlation Matrix
- Portfolio, Watchlist, Alerts with Solana wallet gating
- Multi-Chart (4-panel TradingView), Swap with oracle deviation
- Multi-source news (CryptoPanic + CoinDesk, Cointelegraph, Decrypt, The Block, CryptoSlate, BeInCrypto)
- Categories page with real CoinGecko data + live stats header
- Assets pages: Stocks, Metals, Forex, Commodities with card layouts

---

## 🔧 High-Priority Suggestions

### 1. Search Bar (Global)
- Unified search across coins, stocks, categories, news
- Keyboard shortcut `Cmd/Ctrl + K` opens a command palette
- Show live Pyth price next to results

### 2. On-Chain Transaction History
- Fetch wallet's Solana tx history via Helius API
- Show token swaps, transfers, NFT mints in a `/transactions` page
- Already in nav menu — just needs the page built

### 3. Token Converter
- `/converter` page already in nav — build it
- Input amount + source token → target token using live Pyth prices
- Support crypto ↔ fiat ↔ crypto conversions

### 4. Fear & Greed Index Page
- `/fear-greed` already in nav — build a full page
- Show index gauge, historical chart (30d/90d), market cap correlation

### 5. DeFi Yields Page
- `/yields` in nav — build it using DeFi Llama yields API (free, no key)
- Show protocol, chain, APY, TVL, risk level
- Filter by chain (Solana, ETH, BSC) and APY range

### 6. Mobile-First Improvements
- MobileMenu needs Cryptocurrency / Assets sub-categories like desktop
- Bottom navigation bar for mobile (Home, Markets, News, Portfolio, Alerts)

### 7. Coin Comparison Tool
- `/compare` in nav — build it
- Side-by-side price charts, stats cards for 2-4 selected coins
- Use Pyth live prices + CoinGecko historical

### 8. Token Unlocks Calendar
- `/unlocks` in nav — build using public unlock APIs (e.g. token.unlocks.app)
- Show upcoming vesting/unlock events with countdown timers

### 9. Price History Alerts
- Extend current alerts to support % change triggers (e.g. "+5% in 1h")
- Add email/Telegram webhook delivery option

### 11. Cross-chain Yield Aggregator
- Connect multiple wallet addresses (EVM, Solana)
- Aggregate and scan DeFi yield opportunities for the user's specific assets
- Alert users to better yield farm opportunities automatically using Pyth prices to calculate APY

### 12. Smart Money Tracker
- Follow notable wallets and their recent swaps and token entries
- Use AI to label wallets (e.g. "Whale", "Early Adopter", "NFT Flipper")
- Correlate with Pyth live prices to show execution accuracy of tracked wallets

---

## 🤖 AI Integration Plan

### Phase 1 — AI News Summarizer (Quick Win)
**Endpoint**: Add `GET /api/news/summary` to backend  
**How**: Feed latest 10 headlines into an LLM prompt → return a 3-sentence market brief  
**Model options** (all have free tiers):
- **Groq API** (`llama-3-8b`) — fastest, ~0ms cold start, generous free tier
- **OpenRouter** (`mistral-7b-free`) — multi-model fallback
- **Ollama** (local, no cost) — if self-hosted is preferred  

**UI**: Add a "Market Brief" card to homepage and `/news` page header. Auto-refreshes every 30 min.

```
// backend: services/aiService.js
const { Groq } = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function generateMarketBrief(headlines) {
  const prompt = `Based on these crypto headlines, write a 3-sentence neutral market brief:\n${headlines.join("\n")}`;
  const resp = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3-8b-8192",
  });
  return resp.choices[0].message.content;
}
```

---

### Phase 2 — AI Coin/Stock Analyst
**Trigger**: "AI Analysis" tab on CoinDetail and StockDetail pages  
**Input**: current price, 24h change, 7d chart, confidence interval, recent news headlines  
**Output**: Short analysis paragraph + sentiment score + key levels to watch  
**Implementation**:
- Backend: `POST /api/ai/analyze` with `{ symbol, price, change24h, newsHeadlines }`
- Cache response 30 min per symbol to avoid repeated API calls
- UI: Tab after "About" tab, shows a card with AI-generated text + loading skeleton

---

### Phase 3 — AI-Powered News Sentiment (Enhanced)
**Replace** keyword-based `sentimentStyle()` with real NLP  
**Options**:
- Use **Hugging Face Inference API** (free tier): `finbert` model for finance sentiment
- Or use Groq to classify each headline as bullish/bearish/neutral in batch

```
// POST to HuggingFace inference API
const resp = await fetch(
  "https://api-inference.huggingface.co/models/ProsusAI/finbert",
  { method: "POST", body: JSON.stringify({ inputs: title }),
    headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } }
);
const [{ label, score }] = await resp.json();
// label: "positive" | "negative" | "neutral"
```

Cache per headline hash for efficiency.

---

### Phase 4 — AI Price Prediction Widget
**Not financial advice disclaimer required**  
**Input**: Last 30 days of OHLC data + on-chain metrics  
**Output**: Probability distribution (bullish/neutral/bearish) for next 24h  
**Model**: Use a simple LSTM trained on public crypto data, or call a free prediction API  
**UI**: Small widget on CoinDetail page below the price chart — shows a confidence bar

---

### Phase 5 — AI Chatbot Assistant
**Trigger**: Floating "Ask AI" button on all pages  
**Context**: Inject current page data (active coin/stock, prices, portfolio if available)  
**LLM**: Groq `llama-3-8b` with streaming response  
**UI**: Slide-up panel with chat history, typing indicator, clear button  
**System prompt example**:
```
You are a helpful crypto market assistant for PythFeeds. 
Current context: User is viewing ${symbol} at $${price} (${change24h}% 24h).
Answer concisely. Never give financial advice.
```

---

### Phase 6 — AI Portfolio Insights
**Trigger**: "AI Insights" button on `/portfolio` page  
**Input**: User's current holdings, cost basis, live P&L, and latest market news  
**Output**: Personalized portfolio summary — concentration risk, diversification score, top movers impact  
**Implementation**:
- Send holdings + live prices to Gemini with a structured analysis prompt
- Show as a dismissable card at the top of the portfolio page
- Auto-refresh daily or on-demand

---

### Phase 7 — AI Watchlist Alerts
**Trigger**: Automated background check every 30 min  
**Input**: User's watchlist coins + latest news headlines for each  
**Output**: Push notification or in-app toast when AI detects significant news affecting a watched asset  
**Implementation**:
- Backend cron job iterates watchlist items, fetches news, runs quick Gemini classification
- Frontend: Add a notification bell with AI-generated alerts feed

---

### Phase 8 — AI-Powered Correlation Insights
**Trigger**: "Why are these correlated?" button on `/correlation` page  
**Input**: Correlation matrix data between selected assets  
**Output**: 2-3 sentence explanation of why certain pairs are highly correlated or diverging  
**Implementation**:
- Use Gemini to analyze the correlation data + recent shared news events
- Show as a tooltip or expandable card next to the correlation heatmap

---

### Phase 9 — AI Market Mood Ring
**Trigger**: Always visible widget on homepage  
**Input**: Fear & Greed index, trending coins, top gainers/losers, global market cap change  
**Output**: One-sentence "market mood" with an emoji sentiment indicator  
**Implementation**:
- Lightweight Gemini call cached for 1 hour
- Display as a compact pill/badge in the hero section: "🔥 Market is euphoric — BTC leading rally"

---

### Phase 10 — AI Trade Recap (Daily Digest)
**Trigger**: Daily at market close (or user-defined time)  
**Input**: Top 10 movers, notable news, whale transactions, new token listings  
**Output**: 5-bullet daily market recap  
**Implementation**:
- Backend scheduled job generates recap, stores in DB
- Frontend: `/digest` page showing daily AI recaps with date picker
- Optional: email delivery via SendGrid free tier

---

---

## � UX & Design Enhancements

### Micro-Interactions & Polish
- **Skeleton loading screens**: Replace plain spinners with content-shaped skeleton placeholders on all pages
- **Page transitions**: Add Framer Motion `AnimatePresence` for smooth route transitions
- **Toast notifications**: Replace browser alerts with custom styled toasts (e.g. sonner) for wallet connect, alert triggers, copy actions
- **Confetti on milestones**: Trigger confetti animation when portfolio hits ATH or a set target
- **Haptic feedback on mobile**: Use Vibration API for button presses on supported devices

### Data Visualization Upgrades
- **Interactive sparklines on hover**: Expand mini sparklines into a tooltip chart with crosshair on hover
- **Portfolio pie chart**: Donut chart showing asset allocation by weight (use Recharts or Nivo)
- **Correlation heatmap AI insights**: "Why are these correlated?" button → Gemini analysis of correlation pairs
- **Animated number transitions**: Use `framer-motion` `useMotionValue` for smooth price tick animations

### Accessibility & i18n
- **Keyboard navigation**: Full keyboard support for all interactive elements, focus rings
- **Screen reader labels**: Proper ARIA labels on charts, price changes, icons
- **Multi-language support**: Add `next-intl` for EN/FR/AR/ES with language picker in navbar

---

## 🧩 New Feature Ideas

### Social & Community
- **Share analysis cards**: Generate shareable OG image cards from AI analyses (use `@vercel/og`)
- **Embedded widgets**: `/embed/price/:symbol` route for external site embeds with live Pyth prices
- **Community polls**: Quick sentiment polls on each coin page ("Are you bullish or bearish on BTC?")
- **Leaderboard**: Weekly prediction accuracy leaderboard if price prediction feature is added

### Advanced Trading Tools
- **RSI / MACD / Bollinger Bands overlays**: Add toggle buttons on TradingView charts to layer technical indicators. TradingView widget supports `studies` param — just pass indicator IDs
- **Liquidation heatmap**: `/liquidations` page. Use Coinglass free API or scrape aggregated data. Show heatmap of leverage liquidation zones by price level
- **Whale alerts feed**: Real-time large transaction notifications via Whale Alert API (free tier, 10 req/min). Show as a live feed widget on homepage or `/whales` page
- **Order book visualization**: Depth chart for BTC/ETH/SOL using Binance or Kraken public WebSocket APIs. Render with D3.js or Recharts area chart
- **Gas tracker widget**: Show Ethereum gas (via Etherscan API) and Solana priority fees in the Infobar. Update every 30s
- **Funding rate tracker**: Show perpetual futures funding rates across exchanges — useful for sentiment analysis
- **Open interest chart**: Plot aggregate open interest alongside price to detect leverage build-ups
- **Volume profile**: Show volume-by-price histograms on coin detail pages

### Portfolio & Finance
- **Tax report export**: Generate CSV/PDF of portfolio transactions for tax reporting (FIFO, LIFO, HIFO methods)
- **Cost basis tracking**: Automatic cost basis calculator with realized/unrealized P&L breakdown
- **Portfolio benchmarking**: Compare your portfolio performance vs BTC, ETH, S&P 500 over time using interactive line chart
- **DCA calculator**: Dollar-cost averaging simulator with historical backtest — input amount, frequency, date range → show results vs lump sum
- **Profit calendar**: Heatmap calendar showing daily portfolio P&L (green/red squares like GitHub contributions)
- **Portfolio sharing**: Generate a read-only shareable link to your portfolio (anonymized wallet)

### AI-Powered Features (Using Existing Gemini)
- **AI coin comparisons**: `/compare` page with side-by-side AI analysis. Input two coins → Gemini generates structured comparison (tech, tokenomics, community, risk)
- **ELI5 mode**: Toggle on any AI analysis to simplify language for beginners. Add a "Simplify" button below every AI response
- **AI trade journal**: Users describe trades in natural language → AI extracts entry/exit/reasoning/emotion and logs them in a structured table
- **Weekly AI newsletter**: Backend cron job generates market recap every Sunday. Store in DB, show at `/digest`. Optional email via SendGrid/Resend
- **AI anomaly detection**: Background job checks for unusual volume/price spikes every 15 min. Push notification with AI-generated explanation
- **Voice input**: Add Web Speech API microphone button in chatbot input. Transcribe → send as message. Works in Chrome/Edge natively
- **AI price context**: On every coin page, show a small AI pill: "BTC is trading 12% below its 30-day average" — lightweight Gemini call, cached 1h
- **AI-powered search**: When user searches, AI interprets intent — "cheap DeFi coins" → filter by category + market cap + AI ranking
- **Explain this chart**: Button on TradingView charts that screenshots the visible chart and asks Gemini to explain the pattern (using image input)
- **AI risk score**: For each coin in portfolio, show an AI-generated risk score (1-10) based on volatility, news sentiment, market cap tier

### Data & Integrations
- **On-chain analytics (DefiLlama)**: `/analytics` page. Fetch TVL, protocol revenue, DEX volume, active addresses per chain. DefiLlama API is free, no key needed. Show with bar/line charts
- **NFT floor prices**: Show top Solana NFT collections with live floor prices via Magic Eden API or Tensor API (free tiers available)
- **Solana validator stats**: `/validators` page. Show top validators, staking APY, uptime, commission. Use Solana RPC `getVoteAccounts` + StakeView API
- **Cross-chain bridge tracker**: Monitor bridge TVLs and flow direction (Wormhole, Portal, deBridge). Use DefiLlama bridges endpoint
- **Economic calendar**: `/calendar` page. Macro events (CPI, FOMC, NFP, ECB) with countdown timers. Fetch from TradingEconomics free API or scrape ForexFactory. AI generates impact preview before each event
- **Stablecoin dominance tracker**: Chart USDT/USDC/DAI market cap share over time — useful macro indicator
- **Exchange reserves**: Track BTC/ETH reserves on major exchanges (CryptoQuant free tier) — outflows = bullish signal
- **Token unlock schedule**: `/unlocks` page with upcoming token unlocks, vesting cliffs, and % of circulating supply being released. Use TokenUnlocks API

### Developer & Power User Tools
- **API playground**: `/api-docs` page where users can test PythFeeds API endpoints with live responses
- **Custom dashboards**: Let users drag-and-drop widgets (price tiles, charts, news feed, portfolio) into a personalized dashboard layout
- **Keyboard shortcuts**: `Ctrl+K` search, `Ctrl+/` open AI chat, arrow keys to navigate coin list, `Esc` to close modals
- **Export data**: CSV export button on every table (coins, stocks, correlation matrix, portfolio)
- **Webhook alerts**: Allow users to set up webhook URLs that receive POST notifications when price alerts trigger

---

## ��️ Infrastructure Suggestions

| Item | Suggestion |
|------|-----------|
| **Caching** | Add Redis to backend for shared cache across restarts |
| **Rate limiting** | Add `express-rate-limit` to `/api/news` and `/api/ai` routes |
| **WebSockets** | Upgrade SSE to WebSocket for lower overhead with many clients |
| **Error monitoring** | Add Sentry (free tier) for both frontend and backend |
| **Analytics** | Plausible or Umami (self-hosted, privacy-first) for page analytics |
| **PWA** | Add `next-pwa` so users can install PythFeeds as a mobile app |
| **Price alerts push** | Use Web Push API + Service Worker for native push notifications |
| **AI cost control** | Track Gemini token usage per endpoint, add per-user rate limits |
| **Streaming responses** | Use Gemini streaming API for chat to show tokens as they arrive |
| **Edge caching** | Use Vercel Edge Config or Cloudflare KV for sub-ms global cache reads |
| **Health endpoint** | Add `/api/health` with uptime, cache hit rate, and Gemini quota remaining |
| **DB persistence** | Add SQLite or Supabase for storing chat history, user preferences, alert logs |
| **CI/CD** | GitHub Actions for lint + build check on every push |
