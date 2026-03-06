"use client";

import { History } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface Props {
  username: string;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenHistory: () => void;
  onLogout: () => void;
}

export default function TopBar({ username, isDark, onToggleTheme, onOpenHistory, onLogout }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-wire shrink-0">
      <button
        onClick={onLogout}
        title="Sign out"
        className="text-sm font-mono text-ghost hover:text-ink w-40 truncate text-left transition-colors cursor-pointer"
      >
        {username}
      </button>

      <h1 className="text-sm font-semibold tracking-[0.25em] uppercase text-ink">
        IIGenAI
      </h1>

      <div className="w-40 flex items-center justify-end gap-1">
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ghost hover:text-ink text-xs font-mono tracking-wide transition-colors cursor-pointer"
        >
          <History size={14} strokeWidth={1.5} />
          History
        </button>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
