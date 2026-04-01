import { Home, Library, Music2, Search } from "lucide-react";
import { motion } from "motion/react";
import type { TabName } from "../types";

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  hasActiveTrack: boolean;
}

const TABS: {
  id: TabName;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "search", label: "Search", Icon: Search },
  { id: "player", label: "Player", Icon: Music2 },
  { id: "library", label: "Library", Icon: Library },
];

export function BottomNav({
  activeTab,
  onTabChange,
  hasActiveTrack,
}: BottomNavProps) {
  return (
    <nav
      className="flex items-center justify-around bg-[oklch(0.09_0_0)] border-t border-border px-2 pb-safe-bottom"
      style={{ height: "64px", flexShrink: 0 }}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        const isPlayerTab = id === "player";
        return (
          <button
            key={id}
            type="button"
            data-ocid={`nav.${id}.link`}
            onClick={() => onTabChange(id)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full touch-manipulation relative"
            style={{ minHeight: 44 }}
          >
            {isActive && (
              <motion.div
                layoutId="active-tab-bg"
                className="absolute inset-x-2 inset-y-1 rounded-xl bg-vibe-green/10"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-colors duration-200 ${
                  isActive ? "text-vibe-green" : "text-muted-foreground"
                }`}
              />
              {isPlayerTab && hasActiveTrack && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-vibe-green rounded-full" />
              )}
            </div>
            <span
              className={`text-[10px] font-medium transition-colors duration-200 ${
                isActive ? "text-vibe-green" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
