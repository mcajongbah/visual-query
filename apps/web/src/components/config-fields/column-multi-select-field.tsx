import { Button } from "../ui/button";
import { FieldWrapper } from "./field-wrapper";

interface ColumnMultiSelectFieldProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  value: string[];
  options: Array<{ label: string; value: string; tableName?: string }>;
  onChange: (value: string[]) => void;
}

export function ColumnMultiSelectField({
  label,
  helpText,
  error,
  required,
  value = [],
  options,
  onChange,
}: ColumnMultiSelectFieldProps) {
  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  return (
    <FieldWrapper
      label={label}
      helpText={helpText}
      error={error}
      required={required}
    >
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleSelectAll}
          type="button"
        >
          {value.length === options.length ? "Deselect All" : "Select All"}
        </Button>

        <div className="border rounded-md max-h-48 overflow-auto">
          {options.length === 0 ? (
            <div className="p-2 text-xs text-muted-foreground text-center">
              No columns available
            </div>
          ) : (
            <div className="space-y-0.5 p-1">
              {options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-xs p-1.5 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={value.includes(option.value)}
                    onChange={() => handleToggle(option.value)}
                    className="size-3"
                  />
                  <span className="truncate flex-1">{option.label}</span>
                  {option.tableName && (
                    <span className="text-[10px] text-muted-foreground">
                      {option.tableName}
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </FieldWrapper>
  );
}
