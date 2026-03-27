/**
 * Dynamic Pyth Hermes feed catalog + price fetching.
 * Discovers ALL available feeds at runtime via /v2/price_feeds.
 * Prices fetched/streamed directly by feed ID — no hardcoded IDs needed.
 */

const HERMES = "https://hermes.pyth.network";

/* ── Types ── */

export interface PythFeedMeta {
  id: string;            // 64-char hex (no 0x prefix)
  base: string;          // e.g. "BTC"
  symbol: string;        // e.g. "Crypto.BTC/USD"
  displaySymbol: string; // e.g. "BTC/USD"
  description: string;   // e.g. "BITCOIN / US DOLLAR"
  assetType: string;     // Crypto | Equity | FX | Metal | Rates | …
  quoteCurrency: string; // USD | BTC | ETH | …
}

export interface PythPriceData {
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

/* ── Feed catalog (cached) ── */

let _cachedFeeds: PythFeedMeta[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

/** Fetch ALL non-deprecated price feeds from Hermes (cached 5 min) */
export async function fetchAllPythFeeds(): Promise<PythFeedMeta[]> {
  if (_cachedFeeds && Date.now() - _cacheTime < CACHE_TTL) return _cachedFeeds;

  const res = await fetch(`${HERMES}/v2/price_feeds`);
  if (!res.ok) throw new Error(`Hermes catalog fetch failed: ${res.status}`);
  const raw: Array<{
    id: string;
    attributes: {
      asset_type: string;
      base: string;
      description: string;
      display_symbol: string;
      quote_currency: string;
      symbol: string;
    };
  }> = await res.json();

  const feeds = raw
    .filter((f) => !f.attributes.description?.includes("DEPRECATED"))
    .map((f) => ({
      id: f.id.replace(/^0x/, ""),
      base: f.attributes.base,
      symbol: f.attributes.symbol,
      displaySymbol: f.attributes.display_symbol,
      description: f.attributes.description,
      assetType: f.attributes.asset_type,
      quoteCurrency: f.attributes.quote_currency,
    }));

  _cachedFeeds = feeds;
  _cacheTime = Date.now();
  return feeds;
}

/** Fetch feeds filtered by asset type (e.g. "Crypto", "Equity", "FX", "Metal") */
export async function fetchPythFeedsByType(
  assetType: string
): Promise<PythFeedMeta[]> {
  const all = await fetchAllPythFeeds();
  return all.filter((f) => f.assetType === assetType);
}

/* ── Price fetching ── */

/** Batch-fetch latest prices by feed IDs (parallel chunks of 100) */
export async function fetchPricesByIds(
  feedIds: string[]
): Promise<Record<string, PythPriceData>> {
  const result: Record<string, PythPriceData> = {};
  if (feedIds.length === 0) return result;

  const CHUNK = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < feedIds.length; i += CHUNK)
    chunks.push(feedIds.slice(i, i + CHUNK));

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const idsParam = chunk.map((id) => `ids[]=0x${id}`).join("&");
        const res = await fetch(
          `${HERMES}/v2/updates/price/latest?${idsParam}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.parsed) return;
        for (const feed of data.parsed) {
          const p = feed.price;
          if (!p) continue;
          const expo = Number(p.expo);
          const price = Number(p.price) * Math.pow(10, expo);
          const confidence = Number(p.conf) * Math.pow(10, expo);
          result[feed.id] = {
            price,
            confidence,
            expo,
            publishTime: Number(p.publish_time),
          };
        }
      } catch {
        /* continue with next chunk */
      }
    })
  );

  return result;
}

/* ── SSE streaming ── */

/** Subscribe to real-time Hermes SSE price stream by feed IDs */
export function subscribePriceStream(
  feedIds: string[],
  onUpdate: (
    feedId: string,
    price: number,
    confidence: number,
    publishTime: number
  ) => void
): () => void {
  if (feedIds.length === 0) return () => {};

  const idsParam = feedIds.map((id) => `ids[]=0x${id}`).join("&");
  const url = `${HERMES}/v2/updates/price/stream?${idsParam}&encoding=json&parsed=true`;

  let es: EventSource | null = null;
  try {
    es = new EventSource(url);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data?.parsed) return;
        for (const feed of data.parsed) {
          const p = feed.price;
          if (!p) continue;
          const expo = Number(p.expo);
          const price = Number(p.price) * Math.pow(10, expo);
          const confidence = Number(p.conf) * Math.pow(10, expo);
          onUpdate(feed.id, price, confidence, Number(p.publish_time));
        }
      } catch {
        /* ignore parse errors */
      }
    };
    es.onerror = () => {
      es?.close();
    };
  } catch {
    /* EventSource not supported */
  }

  return () => {
    es?.close();
  };
}
