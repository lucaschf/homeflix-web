import { Film, FolderOpen } from "lucide-react";

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-xl bg-accent/15 flex items-center justify-center mb-6">
        <Film className="w-8 h-8 text-accent" />
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-2">
        Welcome to HomeFlix
      </h1>

      <p className="text-text-secondary max-w-md mb-8">
        Add a library to get started. Point to a folder with your movies and
        series, and we'll do the rest.
      </p>

      <button className="flex items-center gap-2 px-6 py-3 bg-accent text-text-inverse rounded-md font-medium hover:bg-accent-hover transition-fast">
        <FolderOpen className="w-5 h-5" />
        Add Library
      </button>
    </div>
  );
}
