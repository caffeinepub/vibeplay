import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

interface Genre {
  name: string;
  emoji: string;
  tag: string;
}

const GENRES: Genre[] = [
  { name: "Bollywood", emoji: "🎬", tag: "bollywood" },
  { name: "Punjabi", emoji: "🥁", tag: "punjabi" },
  { name: "Haryanvi", emoji: "🎵", tag: "haryanvi" },
  { name: "Pop", emoji: "⭐", tag: "pop" },
  { name: "Hip-Hop", emoji: "🎤", tag: "hip-hop" },
  { name: "Chill", emoji: "🌊", tag: "chill" },
  { name: "EDM", emoji: "⚡", tag: "edm" },
  { name: "Rock", emoji: "🎸", tag: "rock" },
  { name: "Devotional", emoji: "🙏", tag: "devotional" },
];

const MAX_SELECT = 4;

interface InterestPickerProps {
  onConfirm: (genres: string[]) => void;
  onSkip: () => void;
}

export function InterestPicker({ onConfirm, onSkip }: InterestPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (tag: string) => {
    setSelected((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, tag];
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        key="interest-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: "rgba(0,0,0,0.75)" }}
        data-ocid="interest.modal"
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
        <div className="absolute inset-0" onClick={onSkip} />
        <motion.div
          key="interest-sheet"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full max-w-[430px] rounded-t-3xl overflow-hidden"
          style={{
            background: "#1a1a1a",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="px-5 pt-4 pb-8">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground">
                What do you love listening to?
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pick a few to personalize your feed
              </p>
              {selected.length > 0 && (
                <p className="text-xs mt-1" style={{ color: "#1DB954" }}>
                  {selected.length}/{MAX_SELECT} selected
                </p>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2.5 mb-6">
              {GENRES.map((genre, i) => {
                const isSelected = selected.includes(genre.tag);
                const isDisabled = !isSelected && selected.length >= MAX_SELECT;
                return (
                  <motion.button
                    key={genre.tag}
                    type="button"
                    data-ocid={`interest.genre.button.${i + 1}`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => !isDisabled && toggle(genre.tag)}
                    disabled={isDisabled}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-1 touch-manipulation transition-all duration-200"
                    style={{
                      background: isSelected
                        ? "rgba(29,185,84,0.18)"
                        : "rgba(255,255,255,0.05)",
                      border: isSelected
                        ? "1.5px solid #1DB954"
                        : "1.5px solid rgba(255,255,255,0.1)",
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    <span className="text-2xl leading-none">{genre.emoji}</span>
                    <span
                      className="text-[10px] font-semibold text-center leading-tight"
                      style={{
                        color: isSelected ? "#1DB954" : "rgba(255,255,255,0.8)",
                      }}
                    >
                      {genre.name}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <Button
              data-ocid="interest.confirm.button"
              disabled={selected.length === 0}
              onClick={() => onConfirm(selected)}
              className="w-full h-12 rounded-2xl text-sm font-bold touch-manipulation transition-all"
              style={{
                background:
                  selected.length > 0 ? "#1DB954" : "rgba(255,255,255,0.1)",
                color: selected.length > 0 ? "#000" : "rgba(255,255,255,0.4)",
              }}
            >
              {selected.length === 0 ? "Select at least 1" : "Start Listening"}
            </Button>

            <button
              type="button"
              data-ocid="interest.skip.button"
              onClick={onSkip}
              className="w-full text-center text-xs text-muted-foreground mt-3 py-2 touch-manipulation"
            >
              Skip for now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
