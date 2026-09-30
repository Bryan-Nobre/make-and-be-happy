import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Fundo branco e texto grafite em todos os tipos; o estado aparece só na cor do ícone. */
const coresDoTema = {
  "--normal-bg": "var(--card)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--foreground)",
  "--success-bg": "var(--card)",
  "--success-border": "var(--border)",
  "--success-text": "var(--foreground)",
  "--info-bg": "var(--card)",
  "--info-border": "var(--border)",
  "--info-text": "var(--foreground)",
  "--warning-bg": "var(--card)",
  "--warning-border": "var(--border)",
  "--warning-text": "var(--foreground)",
  "--error-bg": "var(--card)",
  "--error-border": "var(--border)",
  "--error-text": "var(--foreground)",
  "--border-radius": "var(--radius)",
} as CSSProperties;

const Toaster = ({ style, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={{ ...coresDoTema, ...style }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md [&[data-type=success]_[data-icon]]:text-success [&[data-type=info]_[data-icon]]:text-info [&[data-type=warning]_[data-icon]]:text-warning [&[data-type=error]_[data-icon]]:text-destructive",
          title: "text-sm font-medium",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
