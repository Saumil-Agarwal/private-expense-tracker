"use client";

import { useEffect } from "react";

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready?.();
        window.Telegram.WebApp.expand?.();
        window.clearInterval(timer);
      } else if (attempts >= 20) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return children;
}
