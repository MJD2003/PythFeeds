"use client";

import { useState } from "react";

/* ── Icon URL resolution for Pyth feed assets ── */

const CRYPTO_CDN = "https://assets.coincap.io/assets/icons";
const FLAG_CDN = "https://flagcdn.com/24x18";

const FX_MAP: Record<string, string> = {
  EUR: "eu", GBP: "gb", USD: "us", JPY: "jp", AUD: "au", CAD: "ca",
  CHF: "ch", NZD: "nz", CNY: "cn", HKD: "hk", SGD: "sg", KRW: "kr",
  SEK: "se", NOK: "no", DKK: "dk", ZAR: "za", TRY: "tr", MXN: "mx",
  BRL: "br", INR: "in", IDR: "id", MYR: "my", THB: "th", PHP: "ph",
  PLN: "pl", CZK: "cz", HUF: "hu", RUB: "ru", ILS: "il", CLP: "cl",
  COP: "co", PEN: "pe", ARS: "ar", TWD: "tw", SAR: "sa", AED: "ae",
  NGN: "ng", KES: "ke", GHS: "gh", EGP: "eg", MAD: "ma", PKR: "pk",
  BDT: "bd", LKR: "lk", VND: "vn", RON: "ro", BGN: "bg", HRK: "hr",
};

const METAL_GRAD: Record<string, [string, string]> = {
  XAU: ["#FFD700", "#B8860B"], XAG: ["#C0C0C0", "#808080"],
  XPT: ["#E5E4E2", "#A9A9A9"], XPD: ["#CED0CE", "#708090"],
  XCU: ["#B87333", "#8B4513"], XAL: ["#848789", "#5F6368"],
};

const COMMODITY_GRAD: Record<string, [string, string]> = {
  USOILSPOT: ["#1a1a1a", "#333"], UKOILSPOT: ["#1a1a1a", "#333"],
  NGAS: ["#4A90D9", "#2E5FA1"], COAL: ["#383838", "#1A1A1A"],
  WHEAT: ["#DAA520", "#B8860B"], CORN: ["#F0E68C", "#DAA520"],
  SOYBEAN: ["#8FBC8F", "#2E8B57"], SUGAR: ["#FFFFFF", "#D3D3D3"],
  COFFEE: ["#6F4E37", "#3B2F2F"], COCOA: ["#7B3F00", "#5C2D00"],
  COTTON: ["#FFFDD0", "#F5DEB3"], LUMBER: ["#DEB887", "#8B7355"],
};

const EQUITY_LOGO: Record<string, string> = {
  AAPL: "apple.com", MSFT: "microsoft.com", GOOGL: "google.com",
  AMZN: "amazon.com", TSLA: "tesla.com", NVDA: "nvidia.com",
  META: "meta.com", NFLX: "netflix.com", JPM: "jpmorganchase.com",
  AMD: "amd.com", INTC: "intel.com", V: "visa.com", WMT: "walmart.com",
  JNJ: "jnj.com", DIS: "thewaltdisneycompany.com", BA: "boeing.com",
  IBM: "ibm.com", CSCO: "cisco.com", ORCL: "oracle.com", CRM: "salesforce.com",
  ADBE: "adobe.com", PYPL: "paypal.com", UBER: "uber.com", ABNB: "airbnb.com",
  COIN: "coinbase.com", SQ: "squareup.com", SHOP: "shopify.com",
  SNOW: "snowflake.com", PLTR: "palantir.com", SPOT: "spotify.com",
  ZM: "zoom.us", SNAP: "snap.com", PINS: "pinterest.com",
  ROKU: "roku.com", RBLX: "roblox.com", HOOD: "robinhood.com",
  MSTR: "microstrategy.com", GS: "goldmansachs.com", MS: "morganstanley.com",
  C: "citigroup.com", BAC: "bankofamerica.com", WFC: "wellsfargo.com",
  UNH: "unitedhealthgroup.com", PFE: "pfizer.com", MRK: "merck.com",
  ABBV: "abbvie.com", LLY: "lilly.com", TMO: "thermofisher.com",
  ABT: "abbott.com", DHR: "danaher.com", AVGO: "broadcom.com",
  QCOM: "qualcomm.com", TXN: "ti.com", MU: "micron.com",
  AMAT: "appliedmaterials.com", LRCX: "lamresearch.com",
  KLAC: "kla.com", MRVL: "marvell.com",
  XOM: "exxonmobil.com", CVX: "chevron.com", COP: "conocophillips.com",
  SLB: "slb.com", PG: "pg.com", KO: "coca-colacompany.com",
  PEP: "pepsico.com", COST: "costco.com", NKE: "nike.com",
  MCD: "mcdonalds.com", SBUX: "starbucks.com", TGT: "target.com",
  HD: "homedepot.com", LOW: "lowes.com", CAT: "caterpillar.com",
  DE: "deere.com", MMM: "3m.com", HON: "honeywell.com",
  GE: "ge.com", RTX: "rtx.com", LMT: "lockheedmartin.com",
  NOC: "northropgrumman.com",
};

interface FeedIconProps {
  base: string;
  assetType: string;
  size?: number;
  className?: string;
}

export default function FeedIcon({ base, assetType, size = 28, className = "" }: FeedIconProps) {
  const [imgErr, setImgErr] = useState(false);
  const s = size;
  const fs = Math.max(8, Math.round(s * 0.35));

  // Crypto — real token icons from CoinCap CDN
  if (assetType === "Crypto" && !imgErr) {
    const sym = base.toLowerCase();
    return (
      <img
        src={`${CRYPTO_CDN}/${sym}@2x.png`}
        alt={base}
        width={s}
        height={s}
        className={`rounded-full object-cover ${className}`}
        style={{ background: "var(--cmc-neutral-2)" }}
        onError={() => setImgErr(true)}
      />
    );
  }

  // Equity — company logos from Clearbit
  if (assetType === "Equity" && !imgErr) {
    const domain = EQUITY_LOGO[base];
    if (domain) {
      return (
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt={base}
          width={s}
          height={s}
          className={`rounded-lg object-cover ${className}`}
          style={{ background: "var(--cmc-neutral-2)" }}
          onError={() => setImgErr(true)}
        />
      );
    }
  }

  // FX — country flags
  if (assetType === "FX") {
    const code = FX_MAP[base];
    if (code && !imgErr) {
      return (
        <img
          src={`${FLAG_CDN}/${code}.png`}
          alt={base}
          width={Math.round(s * 0.85)}
          height={Math.round(s * 0.64)}
          className={`rounded-sm object-cover ${className}`}
          onError={() => setImgErr(true)}
        />
      );
    }
  }

  // Metal — gradient circle
  const metalGrad = METAL_GRAD[base];
  if (metalGrad) {
    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold text-white ${className}`}
        style={{ width: s, height: s, fontSize: fs, background: `linear-gradient(135deg, ${metalGrad[0]}, ${metalGrad[1]})` }}
      >
        {base.length > 1 ? base.slice(1) : base}
      </div>
    );
  }

  // Commodity — themed gradient circle
  const comGrad = COMMODITY_GRAD[base];
  if (comGrad) {
    return (
      <div
        className={`flex items-center justify-center rounded-full font-bold ${className}`}
        style={{ width: s, height: s, fontSize: fs, background: `linear-gradient(135deg, ${comGrad[0]}, ${comGrad[1]})`, color: base.includes("OIL") ? "#f0c040" : "#333" }}
      >
        {base.slice(0, 3)}
      </div>
    );
  }

  // Fallback — letter circle with category color
  const colorMap: Record<string, string> = {
    Crypto: "var(--pf-accent)", "Crypto Index": "var(--pf-accent)", "Crypto NAV": "var(--pf-accent)",
    "Crypto Redemption Rate": "var(--pf-accent)", Equity: "var(--pf-info)", FX: "var(--pf-teal)",
    Metal: "#f5a623", Commodities: "#e6813e", Rates: "var(--pf-teal)", Kalshi: "#e06060", ECO: "#4caf50",
  };
  const c = colorMap[assetType] ?? "var(--cmc-neutral-5)";
  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold shrink-0 ${className}`}
      style={{ width: s, height: s, fontSize: fs, background: `${c}20`, color: c }}
    >
      {base.slice(0, 2)}
    </div>
  );
}
