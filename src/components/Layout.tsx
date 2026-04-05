import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function Layout() {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      <Sidebar />

      <div className="flex-1 ml-16 lg:ml-60">
        <TopBar />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
