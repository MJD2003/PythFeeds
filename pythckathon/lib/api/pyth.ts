import { HermesClient } from "@pythnetwork/hermes-client";

const HERMES_URL = process.env.NEXT_PUBLIC_PYTH_HERMES_URL || "https://hermes.pyth.network";
const PYTH_API_KEY = process.env.NEXT_PUBLIC_PYTH_API_KEY || "";

// Pyth price feed IDs (hex) for major crypto assets
export const PYTH_CRYPTO_FEEDS: Record<string, string> = {
  BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  XRP: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817c9f5b0367f10a244694",
  ADA: "0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d",
  DOGE: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
  DOT: "0xca3eed9b267293f6595901c734c7525ce8ef49adafe8284f97c3b326f31916aa",
  AVAX: "0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7",
  LINK: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
  MATIC: "0x5de33440f6c8ee339628d3c587b0c3d12aaec07ad13a8fa3d8e9c0d0f40e6b4d",
  UNI: "0x78d185a741d07edb3412b09008b7c5cfb9bbbd7d568bf00ba737b456ba171501",
  ATOM: "0xb00b60f88b03a6a625a8d1c048c3f66653edf217439cb7571f3f3e4c8e530e84",
  LTC: "0x6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54",
  FIL: "0x150ac9b959aee0051e4091f0ef5216d941f590e1c5e7f91cf7635b5c11628c0e",
  NEAR: "0xc415de8d2eba7db216527dff4b60e8f3a5311c740dadb233e13e12547e226750",
  APT: "0x03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",
  ARB: "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5",
  OP: "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf",
  SUI: "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
};

// Pyth price feed IDs for US equities
export const PYTH_EQUITY_FEEDS: Record<string, string> = {
  AAPL: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
  MSFT: "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
  GOOGL: "0xe65ff435be42630439c96a7b6b1f0c5d025c3f399c5b3dca86d9db45ce5e73c8",
  AMZN: "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
  META: "0x49e3ee79e0e74b47bded677b49e09b5fbda6cfbe66c1363b91d8a3dd89684548",
  NVDA: "0x2af4b0b8090e2cdb8527a79eeebab3a4b55c76e1d7ae38c7af0dc90e6db73a13",
  TSLA: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  JPM: "0x7f4f157e57bfb2cb18b3b0ce0fba9d4f3c4aed9e38a18b28e6e8f3f75c3f8c55",
  NFLX: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
};

export interface PythPrice {
  id: string;
  symbol: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
}

let hermesClient: HermesClient | null = null;

function getClient(): HermesClient {
  if (!hermesClient) {
    const opts: Record<string, unknown> = {};
    if (PYTH_API_KEY) opts.headers = { "x-api-key": PYTH_API_KEY };
    hermesClient = new HermesClient(HERMES_URL, opts);
  }
  return hermesClient;
}

/**
 * Fetch latest prices from Pyth for a list of feed IDs
 */
export async function fetchPythPrices(feedIds: string[]): Promise<Map<string, PythPrice>> {
  const client = getClient();
  const results = new Map<string, PythPrice>();

  try {
    const response = await client.getLatestPriceUpdates(feedIds);
    if (!response?.parsed) return results;

    for (const feed of response.parsed) {
      const parsed = feed.price;
      if (!parsed) continue;

      const expo = Number(parsed.expo);
      const price = Number(parsed.price) * Math.pow(10, expo);
      const confidence = Number(parsed.conf) * Math.pow(10, expo);

      const feedId = "0x" + feed.id;
      let symbol = "";
      for (const [sym, id] of Object.entries({ ...PYTH_CRYPTO_FEEDS, ...PYTH_EQUITY_FEEDS })) {
        if (id === feedId) { symbol = sym; break; }
      }

      results.set(feedId, {
        id: feedId,
        symbol,
        price,
        confidence,
        expo,
        publishTime: Number(parsed.publish_time),
      });
    }
  } catch (err) {
    console.error("[Pyth] Failed to fetch prices:", err);
  }

  return results;
}

/**
 * Fetch a single price from Pyth
 */
export async function fetchPythPrice(symbol: string): Promise<PythPrice | null> {
  const feedId = PYTH_CRYPTO_FEEDS[symbol.toUpperCase()] || PYTH_EQUITY_FEEDS[symbol.toUpperCase()];
  if (!feedId) return null;

  const results = await fetchPythPrices([feedId]);
  return results.get(feedId) || null;
}

/**
 * Get all supported crypto feed IDs
 */
export function getCryptoFeedIds(): string[] {
  return Object.values(PYTH_CRYPTO_FEEDS);
}

/**
 * Get all supported equity feed IDs
 */
export function getEquityFeedIds(): string[] {
  return Object.values(PYTH_EQUITY_FEEDS);
}
