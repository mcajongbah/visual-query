import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Button } from "../ui/button";
import { FieldWrapper } from "./field-wrapper";

interface OrderItem {
  column: string;
  direction: "ASC" | "DESC";
}

interface OrderListFieldProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  value: OrderItem[];
  columnOptions: Array<{ label: string; value: string }>;
  onChange: (value: OrderItem[]) => void;
}

export function OrderListField({
  label,
  helpText,
  error,
  required,
  value = [],
  columnOptions,
  onChange,
}: OrderListFieldProps) {
  const handleAdd = () => {
    onChange([...value, { column: "", direction: "ASC" }]);
  };

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleUpdate = (
    index: number,
    field: keyof OrderItem,
    newValue: string
  ) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: newValue };
    onChange(updated);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= value.length) return;

    const updated = [...value];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  return (
    <FieldWrapper
      label={label}
      helpText={helpText}
      error={error}
      required={required}
    >
      <div className="space-y-2">
        {value.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-1 p-2 border rounded-md bg-muted/30"
          >
            <div className="flex-1 space-y-1">
              <select
                className="w-full px-2 py-1 text-xs border rounded"
                value={item.column}
                onChange={(e) => handleUpdate(index, "column", e.target.value)}
              >
                <option value="">Select column</option>
                {columnOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="w-full px-2 py-1 text-xs border rounded"
                value={item.direction}
                onChange={(e) =>
                  handleUpdate(
                    index,
                    "direction",
                    e.target.value as "ASC" | "DESC"
                  )
                }
              >
                <option value="ASC">ASC (A-Z, 0-9)</option>
                <option value="DESC">DESC (Z-A, 9-0)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleMove(index, "up")}
                disabled={index === 0}
                type="button"
              >
                <ArrowUpIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleMove(index, "down")}
                disabled={index === value.length - 1}
                type="button"
              >
                <ArrowDownIcon className="size-3" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(index)}
              type="button"
            >
              <TrashIcon className="size-3" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleAdd}
          type="button"
        >
          <PlusIcon className="size-3 mr-1" />
          Add Column
        </Button>
      </div>
    </FieldWrapper>
  );
}
