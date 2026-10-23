import { motion } from "framer-motion";
import { useThemeStyles } from "@/lib/useThemeStyles";

interface Props {
  open: boolean;
  onClick: () => void;
}

export default function HamburgerButton({ open, onClick }: Props) {
  const { fg, cardBorder } = useThemeStyles();
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-xl transition-colors"
      style={{
        border: `1px solid ${cardBorder}`,
        backgroundColor: "rgba(128,128,128,0.08)",
        color: fg,
      }}
      aria-label="منو"
    >
      <motion.span
        className="block h-0.5 w-5 rounded-full"
        style={{ backgroundColor: fg }}
        animate={open ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.3 }}
      />
      <motion.span
        className="block h-0.5 w-5 rounded-full"
        style={{ backgroundColor: fg }}
        animate={open ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
      <motion.span
        className="block h-0.5 w-5 rounded-full"
        style={{ backgroundColor: fg }}
        animate={open ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.3 }}
      />
    </button>
  );
}
