export const formatPrice = (price: number): string => {
  if (price > 1) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } else {
    const numberOfZeros = String(price).slice(2).search(/[1-9]/);
    return parseFloat(price.toFixed(numberOfZeros + 4)).toString();
  }
};

export const formatLargeValue = (value: number): string => {
  const n = Number(value);
  if (!n && n !== 0) return '???';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
};

export const formatPercentageValue = (
  price: number,
  digits?: number
): string => {
  return price.toFixed(digits ?? 2).slice(price > 0 ? 0 : 1);
};

export const displayValueIfExists = (
  callback: (value: number) => string,
  value: number
) => {
  return value ? callback(value) : '???';
};

export function fmtUsd(n: number): string {
  if (n < 0) return `-${fmtUsd(-n)}`;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n < 0.01 && n > 0) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

export function fmtPrice(n: number | string): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (num === 0) return "$0";
  if (num >= 1) return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (num >= 0.0001) return `$${num.toFixed(6)}`;
  return `$${num.toExponential(2)}`;
}

export function fmtB(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export function fmtPct(n: number): string {
  if (n >= 100) return n.toFixed(0) + "%";
  if (n >= 10) return n.toFixed(1) + "%";
  return n.toFixed(2) + "%";
}

export function fmtAmount(n: number): string {
  if (n === 0) return "0";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(3);
}

export function fmtTvl(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function fmtCurrency(n: number): string {
  if (n < 0.01 && n > 0) return "<$0.01";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function truncAddr(addr: string): string {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

export const startsWithHttp = (url: string) => {
  return url.startsWith('http');
};

export const removeHttp = (url: string): string => {
  return url.replace(/^https?:\/\/(www.)?|\/?/g, '');
};

export const calculateElapsedTime = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
};
