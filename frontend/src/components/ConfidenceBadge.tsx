type Flag = "green" | "yellow" | "red";

interface Props {
  flag: Flag;
  confidence: number;
}

const styles: Record<Flag, { dot: string; text: string; bg: string }> = {
  green:  { dot: "bg-green-400",  text: "text-green-400",  bg: "bg-green-400/10"  },
  yellow: { dot: "bg-yellow-400", text: "text-yellow-400", bg: "bg-yellow-400/10" },
  red:    { dot: "bg-red-400",    text: "text-red-400",    bg: "bg-red-400/10"    },
};

export default function ConfidenceBadge({ flag, confidence }: Props) {
  const s = styles[flag];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono ${s.text} ${s.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {Math.round(confidence * 100)}%
    </span>
  );
}
