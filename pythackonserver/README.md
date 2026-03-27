# PythAckon Server — Node.js MVC Backend

Real-time cryptocurrency & stock data API powered by **Pyth Network** and **CoinGecko**.

## Architecture

```
pythackonserver/
├── server.js              # Express entry point
├── config/
│   └── cache.js           # NodeCache with TTL config
├── controllers/
│   ├── coinController.js  # Coins: list, detail, ohlc, chart, global, trending
│   ├── stockController.js # Stocks: list, detail (Pyth equities)
│   ├── newsController.js  # News: crypto, stock
│   ├── searchController.js# Search: coins, exchanges
│   └── priceController.js # Direct Pyth price queries
├── services/
│   ├── pythService.js     # Pyth Hermes real-time price feeds
│   ├── coingeckoService.js# CoinGecko market data (fallback + enrichment)
│   └── newsService.js     # CryptoPanic + Google News RSS
├── routes/
│   ├── coinRoutes.js
│   ├── stockRoutes.js
│   ├── newsRoutes.js
│   ├── searchRoutes.js
│   └── priceRoutes.js
└── middleware/
    └── errorHandler.js
```

## Setup

```bash
npm install
npm run dev     # nodemon
npm start       # production
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/coins` | Top coins (Pyth + CoinGecko) |
| GET | `/api/coins/global` | Global market data |
| GET | `/api/coins/trending` | Trending coins |
| GET | `/api/coins/:id` | Coin detail with Pyth overlay |
| GET | `/api/coins/:id/ohlc` | OHLC chart data |
| GET | `/api/coins/:id/chart` | Price history chart |
| GET | `/api/stocks` | All Pyth equity prices |
| GET | `/api/stocks/:ticker` | Single stock price |
| GET | `/api/prices/pyth?symbols=BTC,ETH` | Direct Pyth prices |
| GET | `/api/prices/feeds` | Available Pyth feeds |
| GET | `/api/news/crypto?symbols=BTC` | Crypto news |
| GET | `/api/news/stock/:ticker` | Stock news |
| GET | `/api/search?q=bitcoin` | Search coins/exchanges |

## Data Sources

- **Primary**: Pyth Network Hermes (real-time, ~400ms latency)
- **Fallback/Enrichment**: CoinGecko API (market cap, volume, sparklines, etc.)
- **News**: CryptoPanic API + Google News RSS
