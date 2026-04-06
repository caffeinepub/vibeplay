import { Eye, EyeOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

type Mode = "login" | "signup";

interface LoginScreenProps {
  onClose: () => void;
  onLogin: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onRegister: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
}

export function LoginScreen({
  onClose,
  onLogin,
  onRegister,
}: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const result =
        mode === "login"
          ? await onLogin(email.trim(), password)
          : await onRegister(email.trim(), password);
      if (result.success) {
        onClose();
      } else {
        setError(result.error ?? "Something went wrong");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
  }

  return (
    <motion.div
      data-ocid="login.modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col bg-background overflow-y-auto"
    >
      {/* Top gradient bar */}
      <div
        className="w-full flex-shrink-0"
        style={{
          height: 3,
          background:
            "linear-gradient(90deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350), oklch(0.75 0.17 200))",
        }}
      />

      {/* Close button */}
      <div className="flex justify-end p-4 flex-shrink-0">
        <button
          type="button"
          data-ocid="login.close_button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/60 hover:bg-muted touch-manipulation transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Logo & Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col items-center px-6 pt-2 pb-8"
      >
        {/* Glow behind logo */}
        <div className="relative mb-4">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-50"
            style={{
              background:
                "radial-gradient(circle, oklch(0.58 0.24 293 / 0.6), oklch(0.62 0.24 350 / 0.3) 60%, transparent)",
              transform: "scale(1.5)",
            }}
          />
          <img
            src="/assets/generated/vibeplay-logo-transparent.dim_400x400.png"
            alt="VibePlay"
            className="relative w-16 h-16 object-contain"
          />
        </div>
        <img
          src="/assets/generated/vibeplay-wordmark-color.dim_400x100.png"
          alt="VibePlay"
          className="h-8 object-contain mb-1"
        />
        <p className="text-sm text-muted-foreground">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </p>
      </motion.div>

      {/* Mode toggle */}
      <div className="flex mx-6 mb-6 rounded-2xl bg-muted/40 p-1 flex-shrink-0">
        <button
          type="button"
          data-ocid="login.tab"
          onClick={() => switchMode("login")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold touch-manipulation transition-all ${
            mode === "login" ? "shadow-sm text-white" : "text-muted-foreground"
          }`}
          style={{
            background:
              mode === "login"
                ? "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350))"
                : "transparent",
          }}
        >
          Log In
        </button>
        <button
          type="button"
          data-ocid="login.signup.tab"
          onClick={() => switchMode("signup")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold touch-manipulation transition-all ${
            mode === "signup" ? "shadow-sm text-white" : "text-muted-foreground"
          }`}
          style={{
            background:
              mode === "signup"
                ? "linear-gradient(135deg, oklch(0.62 0.24 350), oklch(0.58 0.24 293))"
                : "transparent",
          }}
        >
          Sign Up
        </button>
      </div>

      {/* Form with gradient border */}
      <motion.form
        key={mode}
        initial={{ opacity: 0, x: mode === "login" ? -10 : 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 mx-6 px-4 py-5 rounded-2xl flex-shrink-0"
        style={{
          background: "oklch(0.13 0 0)",
          border: "1px solid transparent",
          backgroundClip: "padding-box",
          boxShadow:
            "0 0 0 1px oklch(0.58 0.24 293 / 0.25), 0 0 0 1px oklch(0.75 0.17 200 / 0.15)",
        }}
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-email"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Email
          </label>
          <input
            id="login-email"
            data-ocid="login.input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-muted/40 border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-vibe-green/50 focus:bg-muted/60 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="login-password"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              data-ocid="login.input"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full bg-muted/40 border border-border rounded-2xl px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-vibe-green/50 focus:bg-muted/60 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground touch-manipulation transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              data-ocid="login.error_state"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="px-4 py-3 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          data-ocid="login.submit_button"
          disabled={isLoading}
          className="w-full py-3.5 rounded-2xl font-bold text-sm text-white touch-manipulation active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.58 0.24 293), oklch(0.62 0.24 350), oklch(0.75 0.17 200))",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {mode === "login" ? "Logging in…" : "Creating account…"}
            </span>
          ) : mode === "login" ? (
            "Log In"
          ) : (
            "Create Account"
          )}
        </button>
      </motion.form>

      <div className="flex justify-center mt-6 px-6">
        <button
          type="button"
          data-ocid="login.cancel_button"
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground touch-manipulation transition-colors py-2"
        >
          Continue as Guest
        </button>
      </div>

      <div className="flex-1 flex items-end justify-center px-6 py-8">
        <p className="text-xs text-muted-foreground/50 text-center">
          Made with ♪ by{" "}
          <span className="text-muted-foreground/70">Deepak Chahal</span>
        </p>
      </div>
    </motion.div>
  );
}
