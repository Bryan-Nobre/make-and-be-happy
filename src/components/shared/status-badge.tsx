import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border/70 bg-muted text-muted-foreground",
        info: "border-info/15 bg-info-soft text-info",
        success: "border-success/15 bg-success-soft text-success",
        warning: "border-warning/20 bg-warning-soft text-warning-foreground",
        danger: "border-destructive/15 bg-destructive-soft text-destructive",
        primary: "border-primary/15 bg-primary-soft text-primary-strong",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type Tone = NonNullable<VariantProps<typeof badge>["tone"]>;

export function StatusBadge({
  tone,
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn(badge({ tone }), className)}>
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
