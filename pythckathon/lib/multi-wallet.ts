/**
 * Multi-wallet management — persists watched wallet addresses in localStorage.
 * The connected wallet is always included automatically.
 */

const STORAGE_KEY = "pythfeeds_wallets";

export interface WatchedWallet {
  address: string;
  label: string;
  addedAt: number;
}

export function getWatchedWallets(): WatchedWallet[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addWatchedWallet(address: string, label?: string): WatchedWallet[] {
  const wallets = getWatchedWallets();
  if (wallets.some((w) => w.address === address)) return wallets;
  const updated = [
    ...wallets,
    {
      address,
      label: label || `Wallet ${wallets.length + 1}`,
      addedAt: Date.now(),
    },
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function removeWatchedWallet(address: string): WatchedWallet[] {
  const updated = getWatchedWallets().filter((w) => w.address !== address);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function updateWalletLabel(address: string, label: string): WatchedWallet[] {
  const wallets = getWatchedWallets();
  const wallet = wallets.find((w) => w.address === address);
  if (wallet) wallet.label = label;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
  return wallets;
}

/** Validate a Solana base58 address (basic check) */
export function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}
