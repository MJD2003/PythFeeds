const { HermesClient } = require("@pythnetwork/hermes-client");
const { cache, staleCache, CACHE_TTL } = require("../config/cache");

const HERMES_URL = process.env.PYTH_HERMES_URL || "https://hermes.pyth.network";

let client = null;
function getClient() {
  if (!client) client = new HermesClient(HERMES_URL, { timeout: 15000 });
  return client;
}

// Pyth price feed IDs — crypto
const CRYPTO_FEEDS = {
  BTC:    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH:    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL:    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BNB:    "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  XRP:    "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  ADA:    "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  DOGE:   "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  LINK:   "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  LTC:    "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
  JUP:    "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  WIF:    "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  BONK:   "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  PYTH:   "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
  ORCA:   "0x37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c",
  RAY:    "0x91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a",
  JTO:    "0xb43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2",
  RENDER: "0x3d4a2bd9535be6ce8059d75eadeba507b043257321aa544717c56fa19b49e35d",
  HNT:    "0x649fdd7ec08e8e2a20f425729854e90293dcbe2376abc47197a14da6ff339756",
  SUI:    "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  APT:    "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",
  TIA:    "0x09f7c1d7dfbb7df2b8fe3d3d87ee94a2259d212da4f30c1f0540d066dfa44723",
};

// Pyth price feed IDs — equities (verified from Hermes API)
const EQUITY_FEEDS = {
  AAPL:  "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  MSFT:  "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  GOOGL: "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
  AMZN:  "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  TSLA:  "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  NVDA:  "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
  META:  "0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe",
  JPM:   "0x5f451bbe32545c6a157f547182878c4f3e00abd6a785db921761309180606f5a",
  JNJ:   "0x12848738d5db3aef52f51d78d98fc8b8b8450ffb19fb3aeeb67d38f8c147ff63",
  V:     "0xc719eb7bab9b2bc060167f1d1680eb34a29c490919072513b545b9785b73ee90",
  WMT:   "0x327ae981719058e6fb44e132fb4adbf1bd5978b43db0661bfdaefd9bea0c82dc",
  NFLX:  "0x8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2",
  INTC:  "0xc1751e085ee292b8b3b9dd122a135614485a201c35dfc653553f0e28c1baf3ff",
  AMD:   "0x3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e",
  SPY:   "0x19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5",
};

// Pyth price feed IDs — metals
const METAL_FEEDS = {
  XAU:  "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",  // Gold
  XAG:  "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",  // Silver
  XPT:  "0x398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5",  // Platinum
  XPD:  "0x80367e9664197f37d89a07a804dffd2101c479c7c4e8490501bc9d9e1e7f9021",  // Palladium
  XCU:  "0x636bedafa14a37912993f265eda22431a2be363ad41a10276424bbe1b7f508c4",  // Copper
  XAL:  "0x2818d3a9c8e0a80bd02bb500d62e5bb1323fa3df287f081d82b27d1e22c71afa",  // Aluminium
};

// Pyth price feed IDs — commodities
const COMMODITY_FEEDS = {
  USOILSPOT: "0x925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6", // WTI Crude Oil
  UKOILSPOT: "0x27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a", // Brent Crude Oil
};

// Pyth price feed IDs — FX
const FX_FEEDS = {
  "EUR/USD": "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  "GBP/USD": "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
  "USD/JPY": "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
};

const ALL_FEEDS = { ...CRYPTO_FEEDS, ...EQUITY_FEEDS, ...METAL_FEEDS, ...COMMODITY_FEEDS, ...FX_FEEDS };

/**
 * Fetch real-time prices from Pyth Hermes for given symbols
 * @param {string[]} symbols - e.g. ["BTC", "ETH", "SOL"]
 * @returns {Object} { BTC: { price, confidence, publishTime }, ... }
 */
async function getPythPrices(symbols) {
  const cacheKey = `pyth_${symbols.sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const feedIds = [];
  const feedToSymbol = {};

  for (const sym of symbols) {
    const upper = sym.toUpperCase();
    const feedId = ALL_FEEDS[upper];
    if (feedId) {
      feedIds.push(feedId);
      feedToSymbol[feedId] = upper;
    }
  }

  if (feedIds.length === 0) return {};

  const hermes = getClient();
  const results = {};

  // Batch into chunks of 5 to avoid single bad ID killing the request
  const chunkSize = 5;
  for (let i = 0; i < feedIds.length; i += chunkSize) {
    const chunk = feedIds.slice(i, i + chunkSize);
    try {
      const response = await hermes.getLatestPriceUpdates(chunk);
      if (!response?.parsed) continue;

      for (const feed of response.parsed) {
        const parsed = feed.price;
        if (!parsed) continue;

        const expo = Number(parsed.expo);
        const price = Number(parsed.price) * Math.pow(10, expo);
        const confidence = Number(parsed.conf) * Math.pow(10, expo);
        const feedId = "0x" + feed.id;
        const symbol = feedToSymbol[feedId] || "";

        results[symbol] = {
          symbol,
          price,
          confidence,
          expo,
          publishTime: Number(parsed.publish_time),
          source: "pyth",
        };
      }
    } catch (err) {
      console.warn(`[PythService] Chunk failed (${chunk.length} ids):`, err.message?.slice(0, 100));
    }
  }

  if (Object.keys(results).length > 0) {
    cache.set(cacheKey, results, CACHE_TTL.PYTH_PRICES);
    staleCache.set(cacheKey, results);
  } else {
    // Fallback to stale cache when all chunks fail
    const stale = staleCache.get(cacheKey);
    if (stale) {
      console.warn(`[PythService] Serving stale cache for ${symbols.join(",")}`);
      return stale;
    }
  }
  return results;
}

/**
 * Get all available Pyth feed symbols
 */
function getAvailableFeeds() {
  return {
    crypto: Object.keys(CRYPTO_FEEDS),
    equities: Object.keys(EQUITY_FEEDS),
    metals: Object.keys(METAL_FEEDS),
    commodities: Object.keys(COMMODITY_FEEDS),
    fx: Object.keys(FX_FEEDS),
  };
}

module.exports = { getPythPrices, getAvailableFeeds, CRYPTO_FEEDS, EQUITY_FEEDS, METAL_FEEDS, COMMODITY_FEEDS, FX_FEEDS, ALL_FEEDS };
