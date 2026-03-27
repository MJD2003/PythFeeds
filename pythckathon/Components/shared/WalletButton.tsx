"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, LogOut, Copy, Check, Eye } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { RainbowButton } from "@/Components/ui/rainbow-button";

export default function WalletButton() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showMenu]);

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  const copyAddress = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!connected) {
    return (
      <RainbowButton
        onClick={() => setVisible(true)}
        size="sm"
        className="text-xs font-semibold gap-1.5"
      >
        <Wallet size={13} />
        <span className="hidden sm:inline">Connect</span>
      </RainbowButton>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <RainbowButton
        onClick={() => setShowMenu((p) => !p)}
        variant="outline"
        size="sm"
        className="text-xs font-semibold gap-1.5"
      >
        <div
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--pf-up)" }}
        />
        {short}
      </RainbowButton>

      {showMenu && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-xl border p-1 shadow-xl"
          style={{
            background: "var(--cmc-bg)",
            borderColor: "var(--cmc-border)",
            zIndex: 1002,
          }}
        >
          <button
            onClick={copyAddress}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-(--cmc-neutral-1)"
            style={{ color: "var(--cmc-text)" }}
          >
            {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Address"}
          </button>

          <Link
            href="/watchlist"
            onClick={() => setShowMenu(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-(--cmc-neutral-1)"
            style={{ color: "var(--cmc-text)" }}
          >
            <Eye size={13} />
            My Watchlist
          </Link>

          <div className="my-1" style={{ borderTop: "1px solid var(--cmc-border)" }} />

          <button
            onClick={() => { disconnect(); setShowMenu(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-(--cmc-neutral-1)"
            style={{ color: "#ea3943" }}
          >
            <LogOut size={13} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
