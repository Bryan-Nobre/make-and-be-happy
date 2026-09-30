import * as React from "react";

import { cn } from "@/lib/utils";

/** Aparência compartilhada pelos campos de formulário (Input, NativeSelect). */
export const campoBase =
  "flex h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground shadow-xs transition-[color,border-color,box-shadow] placeholder:text-muted-foreground hover:border-muted-foreground/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20 md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          campoBase,
          "py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
