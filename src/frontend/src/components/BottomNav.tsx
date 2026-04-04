import { Home, Library, Music2, Search } from "lucide-react";
import { motion } from "motion/react";
import type { TabName } from "../types";

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
  hasActiveTrack: boolean;
}

type TabIcon = React.ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

const TABS: {
  id: TabName;
  label: string;
  Icon: TabIcon;
}[] = [
  { id: "home", label: "Home", Icon: Home as TabIcon },
  { id: "search", label: "Search", Icon: Search as TabIcon },
  { id: "player", label: "Player", Icon: Music2 as TabIcon },
  { id: "library", label: "Library", Icon: Library as TabIcon },
];

export function BottomNav({
  activeTab,
  onTabChange,
  hasActiveTrack,
}: BottomNavProps) {
  return (
    <nav
      className="flex items-center justify-around bg-[oklch(0.09_0_0)] px-2 pb-safe-bottom"
      style={{
        height: "64px",
        flexShrink: 0,
        borderTop: "1px solid transparent",
        background:
          "linear-gradient(oklch(0.09 0 0), oklch(0.09 0 0)) padding-box, linear-gradient(90deg, oklch(0.58 0.24 293 / 0.3), oklch(0.62 0.24 350 / 0.3), oklch(0.75 0.17 200 / 0.3)) border-box",
      }}
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
                className="absolute inset-x-2 inset-y-1 rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.58 0.24 293 / 0.15), oklch(0.62 0.24 350 / 0.15))",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <div className="relative">
              <Icon
                className="w-5 h-5 transition-colors duration-200"
                style={{
                  color: isActive
                    ? "oklch(0.62 0.24 350)"
                    : "oklch(var(--muted-foreground))",
                }}
              />
              {isPlayerTab && hasActiveTrack && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))",
                  }}
                />
              )}
            </div>
            <span
              className="text-[10px] font-medium transition-colors duration-200"
              style={{
                color: isActive
                  ? "oklch(0.62 0.24 350)"
                  : "oklch(var(--muted-foreground))",
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
