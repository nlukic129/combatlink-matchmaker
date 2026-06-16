import { createContext, useContext, useEffect, useState } from "react";

export type Currency = "USD" | "EUR";

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  eurRate: number;
  format: (usdAmount: number | null | undefined) => string;
  toDisplay: (usdAmount: number) => number;
  toUsd: (displayAmount: number) => number;
};

const FALLBACK_RATE = 0.92;
const CACHE_KEY = "combatlink_eur_rate";
const PREF_KEY  = "combatlink_currency";
const TTL_MS    = 24 * 60 * 60 * 1000;

function ls(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}
function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() =>
    (ls(PREF_KEY) as Currency) ?? "USD"
  );
  const [eurRate, setEurRate] = useState<number>(() => {
    try {
      const cached = JSON.parse(ls(CACHE_KEY) ?? "null");
      if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rate;
    } catch { /* ignore */ }
    return FALLBACK_RATE;
  });

  useEffect(() => {
    try {
      const cached = JSON.parse(ls(CACHE_KEY) ?? "null");
      if (cached && Date.now() - cached.fetchedAt < TTL_MS) return;
    } catch { /* ignore */ }

    fetch("https://api.frankfurter.app/latest?from=USD&to=EUR")
      .then(r => r.json())
      .then(data => {
        const rate = data?.rates?.EUR;
        if (typeof rate === "number") {
          setEurRate(rate);
          lsSet(CACHE_KEY, JSON.stringify({ rate, fetchedAt: Date.now() }));
        }
      })
      .catch(() => { /* keep fallback */ });
  }, []);

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    lsSet(PREF_KEY, c);
  }

  function toDisplay(usdAmount: number): number {
    return currency === "EUR" ? usdAmount * eurRate : usdAmount;
  }

  function toUsd(displayAmount: number): number {
    return currency === "EUR" ? displayAmount / eurRate : displayAmount;
  }

  function format(usdAmount: number | null | undefined): string {
    if (usdAmount == null) return "—";
    const amount = toDisplay(usdAmount);
    const symbol = currency === "EUR" ? "€" : "$";
    if (amount >= 1_000_000) return `${symbol}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) {
      const k = amount / 1_000;
      return `${symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return `${symbol}${Math.round(amount).toLocaleString()}`;
  }

  return (
    <CurrencyContext value={{ currency, setCurrency, eurRate, format, toDisplay, toUsd }}>
      {children}
    </CurrencyContext>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
