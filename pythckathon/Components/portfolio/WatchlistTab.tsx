"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Trash2, TrendingUp, TrendingDown, Bell, Plus, Pencil, X, ChevronUp, ChevronDown, FolderPlus } from "lucide-react";
import { getWatchlist, removeFromWatchlist, setTargetPrice, reorderWatchlist, moveToList, getWatchlistLists, createWatchlistList, renameWatchlistList, deleteWatchlistList, syncWatchlistFromBackend, type WatchlistItem, type WatchlistList } from "@/lib/watchlist";
import { fetchPythPrices } from "@/lib/api/backend";
import { toast } from "sonner";

interface WatchlistTabProps {
  wallet: string;
}

export default function WatchlistTab({ wallet }: WatchlistTabProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetInput, setTargetInput] = useState("");
  const [lists, setLists] = useState<WatchlistList[]>([]);
  const [activeList, setActiveList] = useState<string | undefined>(undefined);
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editListName, setEditListName] = useState("");

  useEffect(() => {
    if (wallet) {
      setItems(getWatchlist(wallet));
      setLists(getWatchlistLists(wallet));
      syncWatchlistFromBackend(wallet).then(({ items: merged, lists: mergedLists }) => {
        setItems(merged);
        setLists(mergedLists);
      });
    }
  }, [wallet]);

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const list = createWatchlistList(wallet, newListName.trim());
    setLists(getWatchlistLists(wallet));
    setActiveList(list.id);
    setNewListName("");
    setShowNewList(false);
    toast.success(`List "${list.name}" created`);
  };

  const handleRenameList = (listId: string) => {
    if (!editListName.trim()) return;
    renameWatchlistList(wallet, listId, editListName.trim());
    setLists(getWatchlistLists(wallet));
    setEditingListId(null);
    toast.success("List renamed");
  };

  const handleDeleteList = (listId: string) => {
    deleteWatchlistList(wallet, listId);
    setLists(getWatchlistLists(wallet));
    setItems(getWatchlist(wallet));
    if (activeList === listId) setActiveList(undefined);
    toast.success("List deleted");
  };

  const filteredItems = activeList
    ? items.filter(i => i.listId === activeList)
    : items.filter(i => !i.listId);

  useEffect(() => {
    if (items.length === 0) return;
    const symbols = [...new Set(items.map((i) => i.symbol.toUpperCase()))];
    fetchPythPrices(symbols)
      .then((prices) => {
        const map: Record<string, number> = {};
        for (const [sym, data] of Object.entries(prices)) {
          map[sym] = data.price;
        }
        setLivePrices(map);
      })
      .catch(() => {});
  }, [items]);

  const handleRemove = (id: string, type: "coin" | "stock") => {
    const updated = removeFromWatchlist(wallet, id, type);
    setItems(updated);
  };

  const coins = filteredItems.filter((i) => i.type === "coin");
  const stocks = filteredItems.filter((i) => i.type === "stock");

  return (
    <div>
      {/* Multi-list tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3">
        <button
          onClick={() => setActiveList(undefined)}
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
          style={{
            background: activeList === undefined ? "var(--cmc-text)" : "var(--cmc-neutral-2)",
            color: activeList === undefined ? "var(--cmc-bg)" : "var(--cmc-neutral-5)",
          }}
        >
          All ({items.filter(i => !i.listId).length})
        </button>
        {lists.map((list) => (
          <div key={list.id} className="shrink-0 flex items-center gap-0.5">
            {editingListId === list.id ? (
              <form onSubmit={(e) => { e.preventDefault(); handleRenameList(list.id); }} className="flex items-center gap-1">
                <input value={editListName} onChange={(e) => setEditListName(e.target.value)} autoFocus
                  className="rounded-lg px-2 py-1 text-xs outline-none w-24"
                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                  onBlur={() => handleRenameList(list.id)}
                />
              </form>
            ) : (
              <button
                onClick={() => setActiveList(list.id)}
                onDoubleClick={() => { setEditingListId(list.id); setEditListName(list.name); }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: activeList === list.id ? "var(--pf-accent)" : "var(--cmc-neutral-2)",
                  color: activeList === list.id ? "#fff" : "var(--cmc-neutral-5)",
                }}
                title="Double-click to rename"
              >
                {list.name} ({items.filter(i => i.listId === list.id).length})
              </button>
            )}
            {activeList === list.id && (
              <button onClick={() => handleDeleteList(list.id)} className="p-0.5 rounded hover:bg-red-500/10" title="Delete list">
                <X size={10} style={{ color: "#ea3943" }} />
              </button>
            )}
          </div>
        ))}
        {showNewList ? (
          <form onSubmit={(e) => { e.preventDefault(); handleCreateList(); }} className="flex items-center gap-1 shrink-0">
            <input value={newListName} onChange={(e) => setNewListName(e.target.value)} autoFocus placeholder="List name..."
              className="rounded-lg px-2 py-1 text-xs outline-none w-28"
              style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
            />
            <button type="submit" className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ color: "#16c784" }}>OK</button>
            <button type="button" onClick={() => setShowNewList(false)} className="p-0.5"><X size={10} style={{ color: "var(--cmc-neutral-5)" }} /></button>
          </form>
        ) : (
          <button onClick={() => setShowNewList(true)} className="shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors" style={{ color: "var(--cmc-neutral-5)", background: "var(--cmc-neutral-2)" }}>
            <FolderPlus size={11} /> New List
          </button>
        )}
      </div>

      {filteredItems.length === 0 && items.length === 0 ? (
        <div className="py-12 text-center rounded-xl" style={{ border: "1px dashed var(--cmc-border)" }}>
          <Star size={28} className="mx-auto mb-3" style={{ color: "var(--pf-accent)" }} />
          <h2 className="text-base font-semibold" style={{ color: "var(--cmc-text)" }}>
            Your watchlist is empty
          </h2>
          <p className="mt-1.5 text-sm max-w-xs mx-auto" style={{ color: "var(--cmc-text-sub)" }}>
            Star coins and stocks from their detail pages to start tracking them here.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/" className="rounded-lg px-4 py-2 text-xs font-medium" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
              Browse Coins
            </Link>
            <Link href="/stocks" className="rounded-lg px-4 py-2 text-xs font-medium" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
              Browse Stocks
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {coins.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>
                Cryptocurrencies ({coins.length})
              </h3>
              <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Name</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Target</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Distance</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {coins.map((item) => {
                      const price = livePrices[item.symbol.toUpperCase()];
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid var(--cmc-border)" }}
                          className="transition-colors hover:bg-white/2"
                        >
                          <td className="px-3 py-2.5">
                            <Link href={`/coins/${item.id}`} className="flex items-center gap-2 hover:opacity-80">
                              {item.image && <Image src={item.image} alt={item.name} width={22} height={22} className="rounded-full" />}
                              <span className="font-medium text-sm" style={{ color: "var(--cmc-text)" }}>{item.name}</span>
                              <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{item.symbol}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-medium" style={{ color: "var(--cmc-text)" }}>
                            {price ? `$${price >= 1 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : price.toFixed(6)}` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {editingTarget === item.id ? (
                              <form onSubmit={(e) => { e.preventDefault(); const updated = setTargetPrice(wallet, item.id, "coin", targetInput ? parseFloat(targetInput) : null); setItems(updated); setEditingTarget(null); }} className="flex items-center justify-end gap-1">
                                <input type="number" step="any" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} autoFocus
                                  className="w-20 rounded px-1.5 py-0.5 text-xs text-right outline-none"
                                  style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)", border: "1px solid var(--cmc-border)" }}
                                  onBlur={() => { const updated = setTargetPrice(wallet, item.id, "coin", targetInput ? parseFloat(targetInput) : null); setItems(updated); setEditingTarget(null); }}
                                />
                              </form>
                            ) : (
                              <button onClick={() => { setEditingTarget(item.id); setTargetInput(item.targetPrice?.toString() || ""); }}
                                className="text-xs cursor-pointer hover:opacity-80"
                                style={{ color: item.targetPrice ? "var(--cmc-text)" : "var(--cmc-neutral-5)" }}
                              >
                                {item.targetPrice ? `$${item.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Set target"}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold">
                            {(() => {
                              if (!item.targetPrice || !price) return <span style={{ color: "var(--cmc-neutral-5)" }}>—</span>;
                              const dist = ((item.targetPrice - price) / price) * 100;
                              return <span style={{ color: dist >= 0 ? "#16c784" : "#ea3943" }}>{dist >= 0 ? "+" : ""}{dist.toFixed(2)}%</span>;
                            })()}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleRemove(item.id, "coin")} className="p-1 transition-colors hover:text-red-500" style={{ color: "var(--cmc-neutral-5)" }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stocks.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--cmc-neutral-5)" }}>
                Stocks ({stocks.length})
              </h3>
              <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--cmc-border)" }}>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--cmc-border)" }}>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Name</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Price</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}>Added</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold" style={{ color: "var(--cmc-neutral-5)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((item) => {
                      const price = livePrices[item.symbol.toUpperCase()];
                      return (
                        <tr key={item.id} style={{ borderBottom: "1px solid var(--cmc-border)" }}
                          className="transition-colors hover:bg-white/2"
                        >
                          <td className="px-3 py-2.5">
                            <Link href={`/stocks/${item.id}`} className="flex items-center gap-2 hover:opacity-80">
                              <div className="flex h-5 w-5 items-center justify-center rounded text-[8px] font-bold" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>
                                {item.symbol.slice(0, 2)}
                              </div>
                              <span className="font-medium text-sm" style={{ color: "var(--cmc-text)" }}>{item.name}</span>
                              <span className="text-[10px] uppercase" style={{ color: "var(--cmc-neutral-5)" }}>{item.symbol}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-medium" style={{ color: "var(--cmc-text)" }}>
                            {price ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs" style={{ color: "var(--cmc-neutral-5)" }}>
                            {new Date(item.addedAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button onClick={() => handleRemove(item.id, "stock")} className="p-1 transition-colors hover:text-red-500" style={{ color: "var(--cmc-neutral-5)" }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
