/**
 * Pyth Hermes price client.
 * - Hardcoded feed IDs for known crypto, equities, metals, commodities
 * - Dynamic discovery fallback via /v2/price_feeds?query=X (crypto + equity)
 * - Fetches batch prices via /v2/updates/price/latest
 */

const HERMES = "https://hermes.pyth.network";

// ── Cache: symbol → feedId (persists for session) ──
const feedIdCache = new Map<string, string>();

// ── Symbols that Pyth definitely does NOT have (avoid repeated lookups) ──
const negativeLookupCache = new Set<string>();

// ── Hardcoded feed IDs for known assets (mirrors backend pythService.js) ──
const KNOWN_FEEDS: Record<string, string> = {
  // Crypto
  BTC:    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH:    "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL:    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BNB:    "2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  XRP:    "ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  ADA:    "2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  DOGE:   "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  LINK:   "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  LTC:    "6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
  JUP:    "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
  WIF:    "4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
  BONK:   "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
  PYTH:   "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
  ORCA:   "fd1b87f3d0fa7d5c9db3cb54bdaff4f3d1ff99a6a2f3b9f12caf9082ee7e94e",
  RAY:    "91568baa8beb53db23eb3fb7f22c6e8bd303d103919e19733f2bb642d3e7987a",
  JTO:    "b43660a5f790c69354b0729a5ef9d50d68f1df92107540210b9cccba1f947cc2",
  RENDER: "ab7347771135fc733f8f38db462ba085ed3309acfe6f52139b93c9bdb7f92530",
  HNT:    "649fdd7ec08e8e2a20f425729854e90293dcbe2376abc47197a14da6ff339756",
  SUI:    "23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  APT:    "03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",
  TIA:    "09f7c1d7dfbb7df2b8fe3d3d87ee94a2259d212da4f30c1f0540d066dfa44723",
  // US Equities
  AAPL:   "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  MSFT:   "d0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  GOOGL:  "5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
  AMZN:   "b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  TSLA:   "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  NVDA:   "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
  META:   "78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe",
  JPM:    "5f451bbe32545c6a157f547182878c4f3e00abd6a785db921761309180606f5a",
  JNJ:    "12848738d5db3aef52f51d78d98fc8b8b8450ffb19fb3aeeb67d38f8c147ff63",
  V:      "c719eb7bab9b2bc060167f1d1680eb34a29c490919072513b545b9785b73ee90",
  WMT:    "327ae981719058e6fb44e132fb4adbf1bd5978b43db0661bfdaefd9bea0c82dc",
  NFLX:   "8376cfd7ca8bcdf372ced05307b24dced1f15b1afafdeff715664598f15a3dd2",
  INTC:   "c1751e085ee292b8b3b9dd122a135614485a201c35dfc653553f0e28c1baf3ff",
  AMD:    "3622e381dbca2efd1859253763b1adc63f7f9abb8e76da1aa8e638a57ccde93e",
  // Metals
  XAU:    "765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  XAG:    "f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  XPT:    "398e4bbc7cbf89d6648c21e08019d878967677753b3096799595c78f805a34e5",
  // Commodities
  USOILSPOT: "925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6",
  UKOILSPOT: "27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a",
};

export interface PythPrice {
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

/**
 * Discover the Pyth feed ID for a given symbol (e.g. "SOL", "PYTH", "JUP").
 * Uses the Hermes /v2/price_feeds search endpoint.
 * Returns the feed ID hex string (without 0x prefix) or null if not found.
 */
async function discoverFeedId(symbol: string): Promise<string | null> {
  const upper = symbol.toUpperCase();

  if (feedIdCache.has(upper)) return feedIdCache.get(upper)!;
  if (negativeLookupCache.has(upper)) return null;

  // Check hardcoded map first — instant, no network call
  if (KNOWN_FEEDS[upper]) {
    feedIdCache.set(upper, KNOWN_FEEDS[upper]);
    return KNOWN_FEEDS[upper];
  }

  // Try dynamic discovery: crypto first, then equity
  const assetTypes = ["crypto", "equity"];
  for (const assetType of assetTypes) {
    try {
      const res = await fetch(
        `${HERMES}/v2/price_feeds?query=${encodeURIComponent(upper)}&asset_type=${assetType}`
      );
      if (!res.ok) continue;
      const feeds: { id: string; attributes: { base: string; quote_currency: string; symbol: string } }[] = await res.json();

      // Find exact match: base === symbol AND quote_currency === USD
      const match = feeds.find(
        (f) =>
          f.attributes.base.toUpperCase() === upper &&
          f.attributes.quote_currency === "USD" &&
          !f.attributes.symbol.includes("DEPRECATED")
      );

      if (match) {
        // Normalize: strip 0x prefix, ensure 64 hex chars
        let id = match.id.replace(/^0x/i, "");
        if (id.length % 2 !== 0) id = "0" + id; // pad odd-length
        if (id.length !== 64) continue;
        feedIdCache.set(upper, id);
        return id;
      }
    } catch {
      continue;
    }
  }

  negativeLookupCache.add(upper);
  return null;
}

/**
 * Fetch a single token price from Pyth Hermes.
 */
export async function fetchPythPrice(symbol: string): Promise<PythPrice | null> {
  const feedId = await discoverFeedId(symbol);
  if (!feedId) return null;

  try {
    const res = await fetch(`${HERMES}/v2/updates/price/latest?ids[]=0x${feedId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = data?.parsed?.[0]?.price;
    if (!parsed) return null;

    const expo = Number(parsed.expo);
    return {
      price: Number(parsed.price) * Math.pow(10, expo),
      confidence: Number(parsed.conf) * Math.pow(10, expo),
      expo,
      publishTime: Number(parsed.publish_time),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch prices for multiple symbols in one batch.
 * Discovers unknown feed IDs first, then batches into a single Hermes call.
 * Returns a map of symbol → price (USD).
 * Pass includeConfidence=true to get full PythPrice objects instead.
 */
export async function fetchPythPricesBatch(
  symbols: string[],
  includeConfidence?: false
): Promise<Record<string, number>>;
export async function fetchPythPricesBatch(
  symbols: string[],
  includeConfidence: true
): Promise<Record<string, PythPrice>>;
export async function fetchPythPricesBatch(
  symbols: string[],
  includeConfidence = false
): Promise<Record<string, number | PythPrice>> {
  const result: Record<string, number | PythPrice> = {};
  if (symbols.length === 0) return result;

  // 1. Discover all feed IDs (parallel)
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const feedIds: { symbol: string; feedId: string }[] = [];

  // Discover unknown ones in parallel (max 6 concurrent)
  const toDiscover = unique.filter((s) => !feedIdCache.has(s) && !negativeLookupCache.has(s));
  if (toDiscover.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < toDiscover.length; i += 6) {
      chunks.push(toDiscover.slice(i, i + 6));
    }
    for (const chunk of chunks) {
      await Promise.all(chunk.map((s) => discoverFeedId(s)));
    }
  }

  // Collect all known feed IDs
  for (const sym of unique) {
    const fid = feedIdCache.get(sym);
    if (fid) feedIds.push({ symbol: sym, feedId: fid });
  }

  if (feedIds.length === 0) return result;

  // 2. Batch fetch prices (Hermes supports many IDs in one call)
  // Split into chunks of 40 to stay safe
  const idChunks: typeof feedIds[] = [];
  for (let i = 0; i < feedIds.length; i += 40) {
    idChunks.push(feedIds.slice(i, i + 40));
  }

  for (const chunk of idChunks) {
    try {
      // Validate all feed IDs before sending
      const validChunk = chunk.filter((f) => /^[0-9a-fA-F]{64}$/.test(f.feedId));
      if (validChunk.length === 0) continue;
      const idsParam = validChunk.map((f) => `ids[]=0x${f.feedId}`).join("&");
      const res = await fetch(`${HERMES}/v2/updates/price/latest?${idsParam}`);
      if (!res.ok) {
        console.warn(`[PythService] Batch failed (${validChunk.length} ids): ${res.status}`);
        continue;
      }
      const data = await res.json();

      if (!data?.parsed) continue;
      for (const feed of data.parsed) {
        const parsed = feed.price;
        if (!parsed) continue;

        const feedId = feed.id as string;
        const expo = Number(parsed.expo);
        const price = Number(parsed.price) * Math.pow(10, expo);
        const confidence = Number(parsed.conf) * Math.pow(10, expo);

        // Find which symbol this feedId belongs to
        const entry = validChunk.find((f) => f.feedId === feedId);
        if (entry && price > 0) {
          result[entry.symbol] = includeConfidence 
            ? { price, confidence, expo, publishTime: Number(parsed.publish_time) }
            : price;
        }
      }
    } catch {
      // continue with next chunk
    }
  }

  return result;
}

/**
 * Pre-warm the feed ID cache for common tokens.
 * Call once at startup so subsequent price lookups are instant.
 */
export async function prewarmPythFeeds(): Promise<void> {
  const common = [
    "SOL", "BTC", "ETH", "USDC", "USDT", "JUP", "PYTH", "BONK",
    "WIF", "JTO", "RAY", "ORCA", "RENDER", "HNT", "W",
  ];
  await fetchPythPricesBatch(common);
}

/**
 * Subscribe to real-time Pyth Hermes SSE price streaming.
 * Returns a cleanup function. Calls `onPrice(symbol, price, confidence)` on each update.
 * Falls back gracefully — if SSE fails, caller should keep HTTP polling.
 */
export async function subscribePythStream(
  symbols: string[],
  onPrice: (symbol: string, price: number, confidence: number) => void
): Promise<() => void> {
  // Discover feed IDs first
  await fetchPythPricesBatch(symbols);

  const feedEntries: { symbol: string; feedId: string }[] = [];
  for (const sym of symbols) {
    const fid = feedIdCache.get(sym.toUpperCase());
    if (fid) feedEntries.push({ symbol: sym.toUpperCase(), feedId: fid });
  }
  if (feedEntries.length === 0) return () => {};

  const idsParam = feedEntries.map((f) => `ids[]=0x${f.feedId}`).join("&");
  const url = `${HERMES}/v2/updates/price/stream?${idsParam}&encoding=json&parsed=true`;

  let es: EventSource | null = null;
  try {
    es = new EventSource(url);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data?.parsed) return;
        for (const feed of data.parsed) {
          const parsed = feed.price;
          if (!parsed) continue;
          const feedId = feed.id as string;
          const expo = Number(parsed.expo);
          const price = Number(parsed.price) * Math.pow(10, expo);
          const confidence = Number(parsed.conf) * Math.pow(10, expo);

          // Find which symbol this feedId belongs to
          const entry = feedEntries.find((f) => f.feedId === feedId);
          if (price > 0 && entry) {
            onPrice(entry.symbol, price, confidence);
          }
        }
      } catch {}
    };
    es.onerror = () => {
      // SSE failed — caller should keep polling as fallback
      es?.close();
    };
  } catch {
    // EventSource not supported or URL failed
  }

  return () => { es?.close(); };
}
