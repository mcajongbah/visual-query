import { Input } from "../ui/input";
import { FieldWrapper } from "./field-wrapper";

interface TextFieldProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function TextField({
  label,
  helpText,
  error,
  required,
  value,
  placeholder,
  onChange,
}: TextFieldProps) {
  return (
    <FieldWrapper
      label={label}
      helpText={helpText}
      error={error}
      required={required}
    >
      <Input
        type="text"
        className="text-xs"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldWrapper>
  );
}
