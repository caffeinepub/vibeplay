import { WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

interface OfflineBannerProps {
  isOffline: boolean;
}

export function OfflineBanner({ isOffline }: OfflineBannerProps) {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 px-4 py-2.5"
          style={{
            background: "oklch(0.18 0.04 55 / 0.95)",
            borderBottom: "1px solid oklch(0.72 0.19 55 / 0.3)",
          }}
          data-ocid="app.offline_banner"
        >
          <WifiOff
            className="w-4 h-4 flex-shrink-0"
            style={{ color: "oklch(0.72 0.19 55)" }}
          />
          <p
            className="text-xs font-medium"
            style={{ color: "oklch(0.88 0.12 55)" }}
          >
            You're offline — showing cached content
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
