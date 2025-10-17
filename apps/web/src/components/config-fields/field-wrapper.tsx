import { AlertCircleIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface FieldWrapperProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FieldWrapper({
  label,
  helpText,
  error,
  required,
  children,
}: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </label>
      {children}
      {error && (
        <div className="flex items-center gap-1 text-[10px] text-destructive">
          <AlertCircleIcon className="size-3" />
          <span>{error}</span>
        </div>
      )}
      {helpText && !error && (
        <p className="text-[10px] text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
