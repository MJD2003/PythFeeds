export interface CoinData {
  market_cap_rank: number;
  id: string;
  name: string;
  circulating_supply: number;
  symbol: string;
  image: string;
  market_cap: number;
  price_change_percentage_1h_in_currency: number;
  price_change_percentage_24h_in_currency: number;
  price_change_percentage_7d_in_currency: number;
  current_price: number;
  total_volume: number;
  sparkline_in_7d: {
    price: number[];
  };
}

export interface CoinLinks {
  homepage: string[];
  repos_url: {
    github: string[];
  };
  blockchain_site: string[];
  official_forum_url: string[];
  subreddit_url: string;
}

export interface MarketData {
  current_price: {
    usd: number;
    btc: number;
    eth: number;
  };
  price_change_percentage_24h_in_currency: {
    btc: number;
    eth: number;
  };
  price_change_percentage_24h: number;
  low_24h: { usd: number };
  high_24h: { usd: number };
  market_cap: { usd: number };
  fully_diluted_valuation: { usd: number };
  total_volume: { usd: number };
  circulating_supply: number;
}

export interface CoinInfo {
  id: string;
  links: CoinLinks;
  name: string;
  image: { small: string };
  symbol: string;
  market_cap_rank: number;
  market_data: MarketData;
  genesis_date?: string;
}

export interface Exchange {
  index: number;
  name: string;
  image: string;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_btc_normalized: number;
  year_established: number;
  country: string;
  id: string;
}

export interface CategoryTopGainer {
  name: string;
  symbol: string;
  image: string;
  change: number;
  top3Images: string[];
}

export interface Category {
  id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h: number;
  top_3_coins: string[];
  volume_24h: number;
  volume_btc: number;
  dominance: number;
  index: number;
  topGainer: CategoryTopGainer;
  gainers: number;
  losers: number;
}

export interface NFTData {
  id: string;
  name: string;
  symbol: string;
  index: number;
}

export interface GlobalStats {
  active_cryptocurrencies: number;
  markets: number;
  total_market_cap: number;
  total_volume: number;
  btc_dominance: number;
  eth_dominance: number;
  market_cap_change_24h: number;
}

export interface TrendingCoin {
  coin_id: number;
  id: string;
  name: string;
  price_btc: number;
  score: number;
  slug: string;
  symbol: string;
  market_cap_rank: number;
}

export interface MenuItem {
  icon: string;
  lucideIcon?: string;
  text: string;
  link: string;
  degenOnly?: boolean;
}

export interface MenuCategory {
  category?: string;
  items: MenuItem[];
}

export interface MenuSection {
  multiSubmenu: boolean;
  list: MenuCategory[];
}

export type MenuData = Record<string, MenuSection>;

export interface FooterLink {
  text: string;
  url: string;
}

export type FooterData = Record<string, FooterLink[]>;
