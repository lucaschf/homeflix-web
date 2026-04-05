import { Film, Home, List, Clock, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/browse", icon: Film, label: "Browse" },
  { to: "/lists", icon: List, label: "My Lists" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-16 lg:w-60 bg-bg-secondary border-r border-border flex flex-col z-20">
      <div className="h-16 flex items-center px-4 gap-3">
        <Film className="w-7 h-7 text-accent shrink-0" />
        <span className="text-lg font-bold text-text-primary hidden lg:block">
          HomeFlix
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 mt-4">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md transition-fast text-sm
               ${
                 isActive
                   ? "bg-accent/15 text-accent"
                   : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
               }`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
