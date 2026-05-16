import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { Copy } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const copyText = [
          typeof title === "string" ? title : "",
          typeof description === "string" ? description : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const handleCopy = () => {
          if (!copyText) return;
          navigator.clipboard?.writeText(copyText).catch(() => {});
        };

        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1 select-text">
              {title && <ToastTitle className="select-text">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="select-text whitespace-pre-wrap break-words">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            {copyText && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy message"
                className="absolute right-8 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-foreground/60 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
