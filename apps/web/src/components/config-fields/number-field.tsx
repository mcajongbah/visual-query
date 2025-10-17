import { Input } from "../ui/input";
import { FieldWrapper } from "./field-wrapper";

interface NumberFieldProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  value: number;
  placeholder?: string;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

export function NumberField({
  label,
  helpText,
  error,
  required,
  value,
  placeholder,
  min,
  max,
  onChange,
}: NumberFieldProps) {
  return (
    <FieldWrapper
      label={label}
      helpText={helpText}
      error={error}
      required={required}
    >
      <Input
        type="number"
        className="text-xs"
        value={value || ""}
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </FieldWrapper>
  );
}
