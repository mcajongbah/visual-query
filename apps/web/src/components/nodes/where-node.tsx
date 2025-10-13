import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";

const OPERATORS = [
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

export function WhereNode({ id, data, selected }: NodeProps<SqlNodeData>) {
  const { schema, updateNodeData } = useQueryStore();
  const [showConfig, setShowConfig] = useState(false);

  const Icon =
    // @ts-expect-error - dynamic icon lookup
    Icons[
      data.meta.icon
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")
    ] || Icons.CircleHelp;

  const allColumns =
    schema?.tables.flatMap((table) =>
      table.columns.map((col) => ({
        label: col.name, // Just show column name
        value: `${table.schema}.${table.name}.${col.name}`,
      }))
    ) || [];

  const column = data.config?.column;
  const operator = data.config?.operator;
  const value = data.config?.value;

  const handleUpdate = (updates: Partial<SqlNodeData["config"]>) => {
    updateNodeData(id, updates);
  };

  const renderConfigSummary = () => {
    if (!column) return <span className="opacity-50">Configure condition</span>;
    return `${column.split(".").pop()} ${operator || "?"} ${value || "?"}`;
  };

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 bg-background shadow-sm min-w-[180px] relative",
        selected ? "border-primary" : "border-border"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />

      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{data.label}</div>
          <div className="text-[10px] text-muted-foreground mt-1 truncate">
            {renderConfigSummary()}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setShowConfig(!showConfig)}
          className="shrink-0"
        >
          <SettingsIcon className="size-3" />
        </Button>
      </div>

      {showConfig && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-background border rounded-lg shadow-lg p-3 z-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Condition</h4>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowConfig(false)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Column</label>
              <select
                className="w-full px-2 py-1.5 text-xs border rounded"
                value={column || ""}
                onChange={(e) => handleUpdate({ column: e.target.value })}
              >
                <option value="">Select column</option>
                {allColumns.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Operator</label>
              <select
                className="w-full px-2 py-1.5 text-xs border rounded"
                value={operator || ""}
                onChange={(e) => handleUpdate({ operator: e.target.value })}
              >
                <option value="">Select operator</option>
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            {operator && !["IS NULL", "IS NOT NULL"].includes(operator) && (
              <div>
                <label className="text-xs font-medium mb-1 block">Value</label>
                <input
                  type="text"
                  className="w-full px-2 py-1.5 text-xs border rounded"
                  value={value || ""}
                  onChange={(e) => handleUpdate({ value: e.target.value })}
                  placeholder="Enter value"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
