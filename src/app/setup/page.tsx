import { LockKeyhole } from "lucide-react";

import { TelegramSetupForm } from "@/components/telegram-setup-form";

export default function SetupPage() {
  return (
    <main className="app-shell setup-shell">
      <p className="eyebrow">One-time setup</p>
      <h1>Connect your Telegram bot</h1>
      <p className="lede">Register the private webhook without exposing your bot token or webhook secret to this chat.</p>
      <div className="local-badge setup-badge"><LockKeyhole size={14} /> Secret-safe setup</div>
      <TelegramSetupForm />
    </main>
  );
}
