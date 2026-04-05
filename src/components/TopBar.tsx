import { Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-bg-secondary/80 backdrop-blur-sm sticky top-0 z-10">
      <div />

      <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-bg-tertiary text-text-secondary hover:text-text-primary transition-fast text-sm">
        <Search className="w-4 h-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden md:inline text-xs text-text-tertiary ml-2 px-1.5 py-0.5 rounded bg-bg-primary border border-border">
          Ctrl+K
        </kbd>
      </button>
    </header>
  );
}
