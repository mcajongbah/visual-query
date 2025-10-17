import { FieldWrapper } from "./field-wrapper";

interface SelectFieldProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  value: string;
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
  onChange: (value: string) => void;
}

export function SelectField({
  label,
  helpText,
  error,
  required,
  value,
  options,
  placeholder = "Select an option",
  onChange,
}: SelectFieldProps) {
  return (
    <FieldWrapper
      label={label}
      helpText={helpText}
      error={error}
      required={required}
    >
      <select
        className="w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-primary"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}
