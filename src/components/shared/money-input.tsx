import { Input } from "@/components/ui/input";

/** Numeric input tuned for BRL amounts (two decimals, no spinners on mobile). */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
  className,
}: {
  id?: string;
  value: number | "";
  onChange: (value: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <Input
      id={id}
      className={className}
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
