import * as React from "react";

import { campoBase } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** `<select>` HTML nativo com a mesma aparência do `Input`. */
const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => {
    return (
      <select className={cn(campoBase, "cursor-pointer pr-2", className)} ref={ref} {...props} />
    );
  },
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
