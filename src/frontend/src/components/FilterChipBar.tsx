import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const LS_ACTIVE_FILTERS = "vibeplay_active_filters";

interface FilterChip {
  id: string;
  label: string;
  emoji: string;
  type: "language" | "mood";
}

const FILTER_CHIPS: FilterChip[] = [
  { id: "hindi", label: "Hindi", emoji: "🇮🇳", type: "language" },
  { id: "haryanvi", label: "Haryanvi", emoji: "🎵", type: "language" },
  { id: "punjabi", label: "Punjabi", emoji: "🥁", type: "language" },
  { id: "bollywood", label: "Bollywood", emoji: "🎬", type: "language" },
  { id: "romantic", label: "Romantic", emoji: "💕", type: "mood" },
  { id: "sad", label: "Sad", emoji: "😢", type: "mood" },
  { id: "party", label: "Party", emoji: "🎉", type: "mood" },
  { id: "chill", label: "Chill", emoji: "🌊", type: "mood" },
  { id: "workout", label: "Workout", emoji: "💪", type: "mood" },
];

function readSavedFilters(): string[] {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_FILTERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface FilterChipBarProps {
  onFiltersChange?: (filters: string[]) => void;
}

export function FilterChipBar({ onFiltersChange }: FilterChipBarProps) {
  const [selected, setSelected] = useState<string[]>(() => readSavedFilters());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist to localStorage + notify parent whenever selection changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_ACTIVE_FILTERS, JSON.stringify(selected));
    } catch {
      // storage full — ignore
    }
    onFiltersChange?.(selected);
  }, [selected, onFiltersChange]);

  const toggleChip = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const clearAll = () => setSelected([]);

  return (
    <div className="relative mb-2">
      {/* Scrollable chip row */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-1"
        // biome-ignore lint/a11y/useSemanticElements: plain div needed for horizontal scroll layout
        role="toolbar"
        aria-label="Filter by language or mood"
      >
        {/* All / Clear chip */}
        <motion.button
          type="button"
          data-ocid="home.filter.tab"
          whileTap={{ scale: 0.94 }}
          onClick={clearAll}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-full touch-manipulation transition-all duration-200 select-none"
          style={{
            height: 34,
            paddingLeft: 12,
            paddingRight: 12,
            background:
              selected.length === 0
                ? "linear-gradient(135deg, oklch(0.72 0.19 145), oklch(0.60 0.16 145))"
                : "rgba(255,255,255,0.08)",
            border:
              selected.length === 0
                ? "1.5px solid oklch(0.72 0.19 145 / 0.6)"
                : "1.5px solid rgba(255,255,255,0.12)",
          }}
          aria-pressed={selected.length === 0}
        >
          <span
            className="text-xs font-semibold"
            style={{
              color: selected.length === 0 ? "#000" : "rgba(255,255,255,0.6)",
            }}
          >
            All
          </span>
        </motion.button>

        {/* Divider between All and language chips */}
        <div
          className="flex-shrink-0 self-center"
          style={{
            width: 1,
            height: 16,
            background: "rgba(255,255,255,0.12)",
          }}
        />

        {/* Language + Mood chips */}
        {FILTER_CHIPS.map((chip, i) => {
          const isActive = selected.includes(chip.id);
          const isLanguage = chip.type === "language";
          const activeBackground = isLanguage
            ? "linear-gradient(135deg, #7c3aed, #6366f1)"
            : "linear-gradient(135deg, #ec4899, #f43f5e)";
          const activeBorder = isLanguage
            ? "1.5px solid rgba(124,58,237,0.5)"
            : "1.5px solid rgba(236,72,153,0.5)";

          return (
            <motion.button
              key={chip.id}
              type="button"
              data-ocid="home.filter.tab"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => toggleChip(chip.id)}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-full touch-manipulation transition-all duration-200 select-none"
              style={{
                height: 34,
                paddingLeft: 12,
                paddingRight: 12,
                background: isActive
                  ? activeBackground
                  : "rgba(255,255,255,0.08)",
                border: isActive
                  ? activeBorder
                  : "1.5px solid rgba(255,255,255,0.12)",
              }}
              aria-pressed={isActive}
            >
              <span className="text-sm leading-none">{chip.emoji}</span>
              <span
                className="text-xs font-semibold whitespace-nowrap"
                style={{ color: isActive ? "#fff" : "rgba(255,255,255,0.75)" }}
              >
                {chip.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Right fade gradient to hint at scrollability */}
      <div
        className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, transparent, oklch(var(--background)))",
        }}
      />
    </div>
  );
}
