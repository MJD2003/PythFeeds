"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Trash2, ArrowDown, Copy, Check, Mic, MicOff, Wand2, Loader2, Volume2, Square } from "lucide-react";
import { fetchAISimplify } from "@/lib/api/backend";
import { usePathname } from "next/navigation";

interface Message {
  role: "user" | "model";
  content: string;
  ts?: number;
}

function renderMd(text: string) {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <br key={i} />;
    if (trimmed.startsWith('### ')) {
      return <p key={i} className="font-bold text-xs mt-2 mb-0.5" style={{ color: "var(--cmc-text)" }}>{trimmed.slice(4)}</p>;
    }
    if (trimmed.startsWith('## ')) {
      return <p key={i} className="font-bold text-sm mt-2 mb-0.5" style={{ color: "var(--cmc-text)" }}>{trimmed.slice(3)}</p>;
    }
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return <p key={i} className="font-semibold mt-1.5">{trimmed.replace(/\*\*/g, '')}</p>;
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s*/, '');
      return (
        <div key={i} className="flex gap-2 pl-0.5">
          <span className="shrink-0 text-[10px] font-bold mt-px" style={{ color: "var(--cmc-neutral-5)" }}>{trimmed.match(/^\d+/)?.[0]}.</span>
          <span>{content.replace(/\*\*(.*?)\*\*/g, '$1')}</span>
        </div>
      );
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      return (
        <div key={i} className="flex gap-2 pl-0.5">
          <span className="mt-[7px] w-1 h-1 rounded-full shrink-0" style={{ background: "var(--cmc-neutral-5)" }} />
          <span>{trimmed.replace(/^[-•*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</span>
        </div>
      );
    }
    if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
      return <code key={i} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: "var(--cmc-neutral-2)", color: "var(--cmc-text)" }}>{trimmed.slice(1, -1)}</code>;
    }
    const parts = trimmed.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={i}>
        {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
      </p>
    );
  });
}

const BASE_SUGGESTIONS = [
  "Why is BTC moving today?",
  "Current market sentiment",
  "Explain what Pyth Network does",
];

function getContextSuggestions(pathname: string): string[] {
  if (pathname.startsWith("/coins/")) {
    const slug = pathname.split("/")[2];
    return [`Analyze ${slug}`, `Is ${slug} a good buy?`, `${slug} price prediction`];
  }
  if (pathname.startsWith("/stocks/") && pathname.split("/").length > 2) {
    const ticker = pathname.split("/")[2].toUpperCase();
    return [`Analyze ${ticker} stock`, `${ticker} earnings outlook`, `${ticker} vs competitors`];
  }
  if (pathname === "/portfolio") return ["How diversified is my portfolio?", "Risk assessment tips", "Rebalancing strategies"];
  if (pathname === "/news") return ["Summarize today's news", "Most impactful headline?", "Market sentiment from news"];
  if (pathname === "/swap") return ["Best tokens to swap now", "Explain slippage", "DEX vs CEX trading"];
  if (pathname === "/correlation") return ["Which coins are least correlated?", "Explain correlation", "Diversification advice"];
  if (pathname === "/stocks") return ["Top performing sectors", "Stocks vs crypto today", "Impact of Fed rates"];
  if (pathname === "/fear-greed") return ["What drives Fear & Greed?", "Should I buy when fearful?", "Historical extremes"];
  if (pathname === "/yields") return ["Best DeFi yields now", "Explain impermanent loss", "Safest yield strategies"];
  if (pathname === "/alerts") return ["Best alert strategies", "Key support levels for BTC", "When to set alerts"];
  if (pathname === "/calendar") return ["What events are coming up?", "How does CPI affect crypto?", "Next FOMC meeting impact"];
  if (pathname === "/heatmap") return ["Which sectors are hottest?", "Explain the heatmap colors", "Biggest movers today"];
  if (pathname === "/feeds") return ["What are Pyth price feeds?", "Explain confidence intervals", "Which feeds have widest spreads?"];
  return ["Top gainers this week", "SOL vs ETH comparison", "What's happening in DeFi?"];
}

export default function AIChatbot() {
  const pathname = usePathname();
  const SUGGESTIONS = [...BASE_SUGGESTIONS, ...getContextSuggestions(pathname)];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [simplifyingIdx, setSimplifyingIdx] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isOpen, scrollToBottom]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [isOpen]);

  // Derive page context from pathname for AI awareness
  const getPageContext = useCallback(() => {
    const ctx: Record<string, string> = {};
    if (pathname === "/") ctx.page = "homepage (crypto ranking)";
    else if (pathname.startsWith("/coins/")) { ctx.page = "coin_detail"; ctx.symbol = pathname.split("/")[2]; }
    else if (pathname.startsWith("/stocks/") && pathname.split("/").length > 2) { ctx.page = "stock_detail"; ctx.symbol = pathname.split("/")[2]; }
    else if (pathname === "/stocks") ctx.page = "stocks_list";
    else if (pathname === "/portfolio") ctx.page = "portfolio";
    else if (pathname === "/watchlist") ctx.page = "watchlist";
    else if (pathname === "/news") ctx.page = "news";
    else if (pathname === "/correlation") ctx.page = "correlation_matrix";
    else if (pathname === "/swap") ctx.page = "token_swap";
    else if (pathname === "/fear-greed") ctx.page = "fear_greed_index";
    else if (pathname === "/analytics") ctx.page = "defi_analytics";
    else if (pathname === "/yields") ctx.page = "defi_yields";
    else if (pathname === "/alerts") ctx.page = "price_alerts";
    else if (pathname === "/digest") ctx.page = "ai_digest";
    else if (pathname === "/heatmap") ctx.page = "heatmap";
    else if (pathname === "/calendar") ctx.page = "calendar";
    else if (pathname === "/feeds") ctx.page = "feeds";
    else if (pathname === "/bubbles") ctx.page = "bubbles";
    else if (pathname === "/converter") ctx.page = "converter";
    else if (pathname === "/compare") ctx.page = "compare";
    else ctx.page = pathname;
    return Object.keys(ctx).length > 0 ? ctx : undefined;
  }, [pathname]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage = text.trim();
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage, ts: Date.now() }];
    setMessages(newMessages);
    setIsLoading(true);

    const history = newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    const pageContext = getPageContext();

    try {
      let gotReply = false;

      // Try streaming first
      try {
        const res = await fetch("/api/cryptoserve/ai/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, history, pageContext }),
        });

        if (!res.ok || !res.body) throw new Error("Stream unavailable");

        const modelMsg: Message = { role: "model", content: "", ts: Date.now() };
        setMessages([...newMessages, modelMsg]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") break;
              try {
                const parsed = JSON.parse(payload);
                if (parsed.text) {
                  accumulated += parsed.text;
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "model") {
                      updated[updated.length - 1] = { ...last, content: accumulated };
                    }
                    return updated;
                  });
                }
                if (parsed.error) throw new Error(parsed.error);
              } catch (e: any) {
                if (e?.message && e.message !== "Stream unavailable") throw e;
              }
            }
          }
        }

        if (accumulated) {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "model") {
              updated[updated.length - 1] = { ...last, content: accumulated, ts: Date.now() };
            }
            return updated;
          });
          gotReply = true;
        }
      } catch {
        // Streaming failed — remove placeholder if empty
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.role === "model" && !last.content) return prev.slice(0, -1);
          return prev;
        });
      }

      // Fallback to non-streaming endpoint
      if (!gotReply) {
        const fallbackRes = await fetch("/api/cryptoserve/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, history, pageContext }),
        });
        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "AI unavailable");
        }
        const data = await fallbackRes.json();
        setMessages([...newMessages, { role: "model", content: data.reply, ts: Date.now() }]);
      }
    } catch (err: any) {
      const msg = err?.message?.includes("wait")
        ? err.message
        : "Sorry, something went wrong. Please try again.";
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === "model" && !last.content) {
          return [...prev.slice(0, -1), { role: "model" as const, content: msg, ts: Date.now() }];
        }
        return [...prev, { role: "model" as const, content: msg, ts: Date.now() }];
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const [voiceError, setVoiceError] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const voiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopRecording = useCallback((autoSend = false) => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    if (voiceTimeoutRef.current) { clearTimeout(voiceTimeoutRef.current); voiceTimeoutRef.current = null; }
    setRecordingDuration(0);
    if (autoSend) {
      setTimeout(() => {
        setInput(prev => { if (prev.trim()) sendMessage(prev.trim()); return ""; });
      }, 200);
    }
  }, []);

  const toggleVoice = () => {
    setVoiceError("");
    if (isListening) {
      stopRecording(true);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceError("Voice input not supported in this browser. Try Chrome.");
      setTimeout(() => setVoiceError(""), 4000);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new SR() as any;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      let finalTranscript = "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        let interim = "";
        for (let i = 0; i < e.results.length; i++) {
          const result = e.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        setInput(finalTranscript + interim);
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        stopRecording(false);
        const errorMessages: Record<string, string> = {
          "not-allowed": "Microphone access denied. Check browser permissions.",
          "no-speech": "No speech detected. Please try again.",
          "audio-capture": "No microphone found. Check your device settings.",
          "network": "Network error. Check your connection and try again.",
          "aborted": "Voice input was cancelled.",
          "service-not-allowed": "Speech service not available. Try Chrome browser.",
          "language-not-supported": "Language not supported. Try again.",
        };
        setVoiceError(errorMessages[e.error] || `Voice error: ${e.error || "unknown"}. Try again.`);
        setTimeout(() => setVoiceError(""), 4000);
      };
      recognition.onend = () => {
        stopRecording(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);

      voiceTimeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          stopRecording(true);
        }
      }, 10000);
    } catch {
      setVoiceError("Could not start voice input. Check microphone permissions.");
      setTimeout(() => setVoiceError(""), 4000);
    }
  };

  // TTS: read AI message aloud
  const speakMessage = (text: string, idx: number) => {
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const clean = text.replace(/\*\*/g, "").replace(/^#+\s*/gm, "").replace(/^[-•*]\s*/gm, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    speechSynthRef.current = utterance;
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
  };

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const simplifyMessage = async (idx: number) => {
    const msg = messages[idx];
    if (!msg || msg.role !== "model" || simplifyingIdx !== null) return;
    setSimplifyingIdx(idx);
    try {
      const simplified = await fetchAISimplify(msg.content);
      setMessages(prev => prev.map((m, i) => i === idx ? { ...m, content: simplified } : m));
    } catch {}
    setSimplifyingIdx(null);
  };

  const hasMessages = messages.length > 0;
  const modelBubbleBg = isDark ? "rgba(255,255,255,0.05)" : "var(--cmc-neutral-1)";

  return (
    <>
      <style>{`
        @keyframes cb-glow-spin {
          0% { transform: translate(-50%,-50%) rotate(0deg); }
          100% { transform: translate(-50%,-50%) rotate(360deg); }
        }
        @keyframes cb-slide-up {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cb-msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cb-scroll::-webkit-scrollbar { width: 3px; }
        .cb-scroll::-webkit-scrollbar-track { background: transparent; }
        .cb-scroll::-webkit-scrollbar-thumb { background: var(--cmc-neutral-3); border-radius: 3px; }
      `}</style>

      {/* FAB — just the pyth.png image */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 hover:scale-110 active:scale-95 ${isOpen ? "scale-0 opacity-0 pointer-events-none" : "scale-100 opacity-100"}`}
        aria-label="Open AI Chat"
      >
        <img src="/pyth.png" alt="PythFeeds AI" className="w-12 h-12 object-contain drop-shadow-lg" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-[390px] max-w-[calc(100vw-2rem)] flex flex-col rounded-3xl overflow-hidden"
          style={{
            height: "min(600px, calc(100vh - 6rem))",
            background: "var(--cmc-bg)",
            border: "1px solid var(--cmc-border)",
            boxShadow: isDark
              ? "0 25px 50px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)"
              : "0 25px 50px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
            animation: "cb-slide-up 0.25s ease-out",
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--cmc-border)" }}>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <img src="/pyth.png" alt="" className="w-8 h-8 object-contain" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ background: "#16c784", borderColor: "var(--cmc-bg)" }} />
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: "var(--cmc-text)" }}>PythFeeds AI</p>
                <p className="text-[10px]" style={{ color: "#16c784" }}>Online</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {hasMessages && (
                <button onClick={() => setMessages([])} className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--cmc-neutral-5)" }} title="New chat">
                  <Trash2 size={14} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--cmc-neutral-5)" }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative cb-scroll" style={{ scrollbarWidth: "thin" }}>
            {!hasMessages ? (
              <div className="flex flex-col items-center px-5 pt-10 pb-4">
                <img src="/pyth.png" alt="" className="w-16 h-16 object-contain mb-4" />
                <p className="text-lg font-bold mb-1" style={{ color: "var(--cmc-text)" }}>How can I help?</p>
                <p className="text-xs mb-6" style={{ color: "var(--cmc-neutral-5)" }}>Ask me anything about crypto &amp; markets</p>
                <div className="w-full space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left px-4 py-3 rounded-xl text-[13px] transition-all hover:translate-x-0.5 active:scale-[0.99]"
                      style={{
                        background: "var(--cmc-neutral-1)",
                        border: "1px solid var(--cmc-border)",
                        color: "var(--cmc-text)",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} style={{ animation: "cb-msg-in 0.2s ease-out" }}>
                    <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "model" && (
                        <img src="/pyth.png" alt="" className="w-6 h-6 object-contain mr-2 shrink-0 mt-0.5" />
                      )}
                      <div
                        className={`px-3.5 py-2.5 max-w-[82%] text-[13px] leading-[1.65] ${
                          msg.role === "user" ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"
                        }`}
                        style={{
                          background: msg.role === "user" ? "var(--pf-accent)" : modelBubbleBg,
                          color: msg.role === "user" ? "#fff" : "var(--cmc-text)",
                          border: msg.role === "user" ? "none" : "1px solid var(--cmc-border)",
                        }}
                      >
                        {msg.role === "model" ? renderMd(msg.content) : msg.content}
                      </div>
                    </div>
                    {msg.role === "model" && (
                      <div className="flex items-center gap-2 mt-0.5 ml-8">
                        {msg.ts && (
                          <span className="text-[9px]" style={{ color: "var(--cmc-neutral-4)" }}>
                            {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        <button
                          onClick={() => copyMessage(msg.content, i)}
                          className="text-[9px] flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                          style={{ color: "var(--cmc-neutral-5)" }}
                        >
                          {copiedIdx === i ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
                        </button>
                        <button
                          onClick={() => simplifyMessage(i)}
                          className="text-[9px] flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                          style={{ color: "var(--pf-accent)" }}
                          title="Simplify (ELI5)"
                        >
                          {simplifyingIdx === i ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />} ELI5
                        </button>
                        <button
                          onClick={() => speakMessage(msg.content, i)}
                          className="text-[9px] flex items-center gap-0.5 opacity-40 hover:opacity-80 transition-opacity"
                          style={{ color: speakingIdx === i ? "#16c784" : "var(--cmc-neutral-5)" }}
                          title={speakingIdx === i ? "Stop reading" : "Read aloud"}
                        >
                          {speakingIdx === i ? <><Square size={8} /> Stop</> : <><Volume2 size={9} /> Listen</>}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start" style={{ animation: "cb-msg-in 0.2s ease-out" }}>
                    <img src="/pyth.png" alt="" className="w-6 h-6 object-contain mr-2 shrink-0 mt-0.5" />
                    <div className="px-4 py-3.5 rounded-2xl rounded-bl-md flex items-center gap-1.5" style={{ background: modelBubbleBg, border: "1px solid var(--cmc-border)" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--pf-accent)", animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--pf-accent)", animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--pf-accent)", animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {showScrollBtn && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110"
                style={{ background: "var(--cmc-bg)", border: "1px solid var(--cmc-border)", color: "var(--cmc-neutral-5)" }}
              >
                <ArrowDown size={12} />
              </button>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="shrink-0 px-4 pb-4 pt-2">
            <div className="relative rounded-2xl">
              {/* Glow on focus */}
              <div
                className="absolute -inset-0.5 rounded-2xl transition-opacity duration-500 pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, rgba(153,69,255,0.15), rgba(153,69,255,0.15))",
                  filter: "blur(8px)",
                  opacity: inputFocused ? 0.8 : 0,
                }}
              />
              {/* Animated border */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                style={{
                  padding: "1px",
                  background: inputFocused
                    ? "conic-gradient(from 0deg, var(--pf-accent), var(--pf-teal), var(--pf-accent), var(--pf-teal), var(--pf-accent))"
                    : "var(--cmc-border)",
                  WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  transition: "background 0.3s ease",
                }}
              >
                {inputFocused && (
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: "300%", height: "300%",
                    background: "conic-gradient(from 0deg, transparent 0%, var(--pf-accent) 10%, transparent 20%, var(--pf-teal) 30%, transparent 40%, var(--pf-accent) 50%, transparent 60%, var(--pf-teal) 70%, transparent 80%)",
                    animation: "cb-glow-spin 4s linear infinite",
                  }} />
                )}
              </div>
              {/* Voice error */}
              {voiceError && (
                <div className="mx-3 mb-1 px-3 py-1.5 rounded-lg text-[10px] font-medium" style={{ background: "rgba(234,57,67,0.08)", color: "#ea3943" }}>
                  {voiceError}
                </div>
              )}
              {/* Input row */}
              <div className="relative flex items-center gap-2 rounded-2xl px-4 py-3" style={{ background: isDark ? "#111115" : "#fafbfd" }}>
                {isListening ? (
                  /* WhatsApp-style recording UI */
                  <>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ background: "#ea3943" }} />
                      <span className="text-xs font-mono font-medium" style={{ color: "#ea3943" }}>{fmtDuration(recordingDuration)}</span>
                      <div className="flex items-center gap-[2px] flex-1 justify-center h-5">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <span
                            key={i}
                            className="w-[2px] rounded-full animate-pulse"
                            style={{
                              background: "var(--pf-accent)",
                              height: `${4 + Math.random() * 14}px`,
                              animationDelay: `${i * 50}ms`,
                              animationDuration: `${400 + Math.random() * 400}ms`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleVoice}
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
                      style={{ background: "#ea3943", color: "#fff" }}
                      title="Stop recording & send"
                    >
                      <Square size={12} />
                    </button>
                  </>
                ) : (
                  /* Normal input */
                  <>
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder="Ask anything..."
                      className="flex-1 bg-transparent text-sm outline-none min-w-0"
                      style={{ color: "var(--cmc-text)" }}
                      disabled={isLoading}
                    />
                    {!input.trim() ? (
                      <button
                        type="button"
                        onClick={toggleVoice}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 hover:scale-110"
                        style={{ background: "rgba(153,69,255,0.1)", color: "var(--pf-accent)" }}
                        title="Hold to record voice message"
                      >
                        <Mic size={14} />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-20"
                        style={{ background: "var(--pf-accent)", color: "#fff" }}
                      >
                        <Send size={14} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="text-center text-[9px] mt-1.5" style={{ color: "var(--cmc-neutral-4)", opacity: 0.5 }}>
              Not financial advice
            </p>
          </form>
        </div>
      )}
    </>
  );
}
