import {
  PlusIcon,
  TrashIcon,
  BracesIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { FieldWrapper } from "./field-wrapper";
import { cn } from "../../lib/utils";

export interface PredicateCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  logicalOp?: "AND" | "OR"; // Logical operator before this condition
}

export interface PredicateGroup {
  id: string;
  type: "group";
  logicalOp: "AND" | "OR";
  conditions: (PredicateCondition | PredicateGroup)[];
  parentLogicalOp?: "AND" | "OR"; // Logical operator before this group
}

type PredicateItem = PredicateCondition | PredicateGroup;

interface PredicateBuilderFieldProps {
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  value: PredicateItem[];
  columnOptions: Array<{ label: string; value: string }>;
  operatorOptions?: string[];
  onChange: (value: PredicateItem[]) => void;
}

const DEFAULT_OPERATORS = [
  "=",
  "<>",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "LIKE",
  "IN",
  "BETWEEN",
  "IS NULL",
  "IS NOT NULL",
];

let conditionIdCounter = 0;

export function PredicateBuilderField({
  label,
  helpText,
  error,
  required,
  value = [],
  columnOptions,
  operatorOptions = DEFAULT_OPERATORS,
  onChange,
}: PredicateBuilderFieldProps) {
  const handleAddCondition = (
    logicalOp: "AND" | "OR" = "AND",
    parentList: PredicateItem[] = value
  ) => {
    const newCondition: PredicateCondition = {
      id: `condition-${++conditionIdCounter}`,
      column: "",
      operator: "=",
      value: "",
      logicalOp: parentList.length > 0 ? logicalOp : undefined,
    };

    onChange([...parentList, newCondition]);
  };

  const handleAddGroup = (
    logicalOp: "AND" | "OR" = "AND",
    parentList: PredicateItem[] = value
  ) => {
    const newGroup: PredicateGroup = {
      id: `group-${++conditionIdCounter}`,
      type: "group",
      logicalOp: "AND",
      conditions: [],
      parentLogicalOp: parentList.length > 0 ? logicalOp : undefined,
    };

    onChange([...parentList, newGroup]);
  };

  const handleRemove = (index: number, parentList: PredicateItem[] = value) => {
    const updated = parentList.filter((_, i) => i !== index);
    // Reset logicalOp for first item
    if (updated.length > 0 && "logicalOp" in updated[0]) {
      updated[0] = { ...updated[0], logicalOp: undefined };
    }
    onChange(updated);
  };

  const handleUpdateCondition = (
    index: number,
    field: keyof PredicateCondition,
    newValue: any,
    parentList: PredicateItem[] = value
  ) => {
    const updated = [...parentList];
    const item = updated[index];
    if ("type" in item && item.type === "group") return; // Skip groups

    updated[index] = { ...item, [field]: newValue } as PredicateCondition;
    onChange(updated);
  };

  const handleUpdateGroup = (
    index: number,
    newConditions: PredicateItem[],
    parentList: PredicateItem[] = value
  ) => {
    const updated = [...parentList];
    const group = updated[index] as PredicateGroup;
    updated[index] = { ...group, conditions: newConditions };
    onChange(updated);
  };

  const handleToggleGroupLogicalOp = (
    index: number,
    parentList: PredicateItem[] = value
  ) => {
    const updated = [...parentList];
    const group = updated[index] as PredicateGroup;
    updated[index] = {
      ...group,
      logicalOp: group.logicalOp === "AND" ? "OR" : "AND",
    };
    onChange(updated);
  };

  const renderCondition = (
    item: PredicateCondition,
    index: number,
    parentList: PredicateItem[],
    depth: number = 0
  ) => {
    const needsValue = ![" IS NULL", "IS NOT NULL"].includes(item.operator);

    return (
      <div
        key={item.id}
        className={cn("flex items-start gap-2", depth > 0 && "pl-4")}
      >
        {item.logicalOp && (
          <span className="text-xs font-semibold text-primary mt-1.5 min-w-[32px]">
            {item.logicalOp}
          </span>
        )}
        <div className="flex-1 space-y-1 p-2 border rounded-md bg-background">
          <div className="grid grid-cols-2 gap-1">
            <select
              className="px-2 py-1 text-xs border rounded"
              value={item.column}
              onChange={(e) =>
                handleUpdateCondition(index, "column", e.target.value, parentList)
              }
            >
              <option value="">Column</option>
              {columnOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="px-2 py-1 text-xs border rounded"
              value={item.operator}
              onChange={(e) =>
                handleUpdateCondition(index, "operator", e.target.value, parentList)
              }
            >
              {operatorOptions.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          {needsValue && (
            <input
              type="text"
              className="w-full px-2 py-1 text-xs border rounded"
              placeholder="Value"
              value={item.value}
              onChange={(e) =>
                handleUpdateCondition(index, "value", e.target.value, parentList)
              }
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => handleRemove(index, parentList)}
          type="button"
        >
          <TrashIcon className="size-3" />
        </Button>
      </div>
    );
  };

  const renderGroup = (
    item: PredicateGroup,
    index: number,
    parentList: PredicateItem[],
    depth: number = 0
  ) => {
    return (
      <div key={item.id} className={cn("space-y-2", depth > 0 && "pl-4")}>
        {item.parentLogicalOp && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">
              {item.parentLogicalOp}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
        )}
        <div className="border-2 border-dashed rounded-md p-2 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleToggleGroupLogicalOp(index, parentList)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded hover:opacity-80"
              type="button"
            >
              <BracesIcon className="size-3" />
              {item.logicalOp} Group
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(index, parentList)}
              type="button"
            >
              <TrashIcon className="size-3" />
            </Button>
          </div>

          <div className="space-y-2">
            {item.conditions.map((subItem, subIndex) => {
              if ("type" in subItem && subItem.type === "group") {
                return renderGroup(
                  subItem,
                  subIndex,
                  item.conditions,
                  depth + 1
                );
              }
              return renderCondition(
                subItem as PredicateCondition,
                subIndex,
                item.conditions,
                depth + 1
              );
            })}
          </div>

          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              onClick={() => handleAddCondition(item.logicalOp, item.conditions)}
              type="button"
            >
              <PlusIcon className="size-3 mr-1" />
              Add {item.logicalOp} Condition
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => handleAddGroup(item.logicalOp, item.conditions)}
              type="button"
            >
              <BracesIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <FieldWrapper
      label={label}
      helpText={helpText}
      error={error}
      required={required}
    >
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {value.map((item, index) => {
          if ("type" in item && item.type === "group") {
            return renderGroup(item, index, value, 0);
          }
          return renderCondition(item as PredicateCondition, index, value, 0);
        })}

        <div className="flex gap-1 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="text-xs flex-1"
            onClick={() => handleAddCondition(value.length > 0 ? "AND" : undefined)}
            type="button"
          >
            <PlusIcon className="size-3 mr-1" />
            Add Condition
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => handleAddGroup(value.length > 0 ? "AND" : undefined)}
            type="button"
          >
            <BracesIcon className="size-3 mr-1" />
            Group
          </Button>
        </div>
      </div>
    </FieldWrapper>
  );
}
