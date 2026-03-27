import { getUserData, setUserData } from "@/lib/api/backend";

const STORAGE_KEY = "cryptoserve_watchlist";
const LISTS_KEY = "cryptoserve_watchlists";

export interface WatchlistItem {
  id: string;
  type: "coin" | "stock";
  symbol: string;
  name: string;
  image?: string;
  addedAt: number;
  targetPrice?: number;
  listId?: string;
}

export interface WatchlistList {
  id: string;
  name: string;
  createdAt: number;
}

// ═══ Multi-list management ═══
function listsKey(wallet: string) { return `${LISTS_KEY}_${wallet}`; }

export function getWatchlistLists(wallet: string): WatchlistList[] {
  if (typeof window === "undefined" || !wallet) return [];
  try { return JSON.parse(localStorage.getItem(listsKey(wallet)) || "[]"); } catch { return []; }
}

function saveLists(wallet: string, lists: WatchlistList[]) {
  if (typeof window === "undefined" || !wallet) return;
  localStorage.setItem(listsKey(wallet), JSON.stringify(lists));
  // Async backend sync (fire-and-forget)
  setUserData(wallet, "watchlist_lists", lists).catch(() => {});
}

export function createWatchlistList(wallet: string, name: string): WatchlistList {
  const lists = getWatchlistLists(wallet);
  const newList: WatchlistList = { id: `list_${Date.now()}`, name, createdAt: Date.now() };
  lists.push(newList);
  saveLists(wallet, lists);
  return newList;
}

export function renameWatchlistList(wallet: string, listId: string, name: string) {
  const lists = getWatchlistLists(wallet);
  const list = lists.find(l => l.id === listId);
  if (list) { list.name = name; saveLists(wallet, lists); }
}

export function deleteWatchlistList(wallet: string, listId: string) {
  saveLists(wallet, getWatchlistLists(wallet).filter(l => l.id !== listId));
  // Move items back to default
  const items = getWatchlist(wallet);
  for (const item of items) { if (item.listId === listId) delete item.listId; }
  saveWatchlist(wallet, items);
}

export function moveToList(wallet: string, itemId: string, type: "coin" | "stock", listId: string | undefined) {
  const items = getWatchlist(wallet);
  const item = items.find(i => i.id === itemId && i.type === type);
  if (item) { item.listId = listId; saveWatchlist(wallet, items); }
  return items;
}

export function reorderWatchlist(wallet: string, reordered: WatchlistItem[]) {
  saveWatchlist(wallet, reordered);
}

export function setTargetPrice(wallet: string, id: string, type: "coin" | "stock", price: number | null): WatchlistItem[] {
  const list = getWatchlist(wallet);
  const item = list.find((i) => i.id === id && i.type === type);
  if (item) {
    if (price === null) { delete item.targetPrice; } else { item.targetPrice = price; }
    saveWatchlist(wallet, list);
  }
  return list;
}

function getKey(wallet: string): string {
  return `${STORAGE_KEY}_${wallet}`;
}

export function getWatchlist(wallet: string): WatchlistItem[] {
  if (typeof window === "undefined" || !wallet) return [];
  try {
    const raw = localStorage.getItem(getKey(wallet));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(wallet: string, list: WatchlistItem[]): void {
  if (typeof window === "undefined" || !wallet) return;
  localStorage.setItem(getKey(wallet), JSON.stringify(list));
  // Async backend sync (fire-and-forget)
  setUserData(wallet, "watchlist_items", list).catch(() => {});
}

export function addToWatchlist(
  wallet: string,
  item: Omit<WatchlistItem, "addedAt">
): WatchlistItem[] {
  const list = getWatchlist(wallet);
  if (list.some((i) => i.id === item.id && i.type === item.type)) return list;
  const updated = [...list, { ...item, addedAt: Date.now() }];
  saveWatchlist(wallet, updated);
  return updated;
}

export function removeFromWatchlist(
  wallet: string,
  id: string,
  type: "coin" | "stock"
): WatchlistItem[] {
  const list = getWatchlist(wallet).filter(
    (i) => !(i.id === id && i.type === type)
  );
  saveWatchlist(wallet, list);
  return list;
}

export function isInWatchlist(
  wallet: string,
  id: string,
  type: "coin" | "stock"
): boolean {
  return getWatchlist(wallet).some((i) => i.id === id && i.type === type);
}

export function toggleWatchlist(
  wallet: string,
  item: Omit<WatchlistItem, "addedAt">
): { list: WatchlistItem[]; added: boolean } {
  if (isInWatchlist(wallet, item.id, item.type)) {
    return { list: removeFromWatchlist(wallet, item.id, item.type), added: false };
  }
  return { list: addToWatchlist(wallet, item), added: true };
}

// ═══ Backend sync ═══

export async function syncWatchlistFromBackend(wallet: string): Promise<{ items: WatchlistItem[]; lists: WatchlistList[] }> {
  if (!wallet) return { items: [], lists: [] };
  try {
    const [remoteItems, remoteLists] = await Promise.all([
      getUserData<WatchlistItem[]>(wallet, "watchlist_items"),
      getUserData<WatchlistList[]>(wallet, "watchlist_lists"),
    ]);
    const localItems = getWatchlist(wallet);
    const localLists = getWatchlistLists(wallet);

    // Merge: remote wins for items that exist in both (by id+type), local adds new ones
    let mergedItems: WatchlistItem[];
    if (remoteItems && remoteItems.length > 0) {
      const remoteMap = new Map(remoteItems.map(i => [`${i.id}_${i.type}`, i]));
      for (const local of localItems) {
        const key = `${local.id}_${local.type}`;
        if (!remoteMap.has(key)) remoteMap.set(key, local);
      }
      mergedItems = Array.from(remoteMap.values());
    } else {
      mergedItems = localItems;
    }

    let mergedLists: WatchlistList[];
    if (remoteLists && remoteLists.length > 0) {
      const remoteMap = new Map(remoteLists.map(l => [l.id, l]));
      for (const local of localLists) {
        if (!remoteMap.has(local.id)) remoteMap.set(local.id, local);
      }
      mergedLists = Array.from(remoteMap.values());
    } else {
      mergedLists = localLists;
    }

    // Save merged data to both stores
    if (typeof window !== "undefined") {
      localStorage.setItem(getKey(wallet), JSON.stringify(mergedItems));
      localStorage.setItem(listsKey(wallet), JSON.stringify(mergedLists));
    }
    setUserData(wallet, "watchlist_items", mergedItems).catch(() => {});
    setUserData(wallet, "watchlist_lists", mergedLists).catch(() => {});

    return { items: mergedItems, lists: mergedLists };
  } catch {
    return { items: getWatchlist(wallet), lists: getWatchlistLists(wallet) };
  }
}
