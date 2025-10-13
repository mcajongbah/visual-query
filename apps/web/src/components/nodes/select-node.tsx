import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";

export function SelectNode({ id, data, selected }: NodeProps<SqlNodeData>) {
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

  // Get all available columns from all tables
  const allColumns =
    schema?.tables.flatMap((table) =>
      table.columns.map((col) => ({
        label: col.name, // Just show column name
        value: `${table.schema}.${table.name}.${col.name}`, // Keep full path as value
        shortLabel: col.name,
        tableName: table.name, // For display context if needed
      }))
    ) || [];

  const selectedColumns = data.config?.selectedColumns || [];

  const handleToggleColumn = (columnValue: string) => {
    const newSelected = selectedColumns.includes(columnValue)
      ? selectedColumns.filter((c) => c !== columnValue)
      : [...selectedColumns, columnValue];

    updateNodeData(id, { selectedColumns: newSelected });
  };

  const handleSelectAll = () => {
    if (selectedColumns.length === allColumns.length) {
      updateNodeData(id, { selectedColumns: [] });
    } else {
      updateNodeData(id, { selectedColumns: allColumns.map((c) => c.value) });
    }
  };

  const renderConfigSummary = () => {
    if (!selectedColumns.length) return <span className="opacity-50">*</span>;
    if (selectedColumns.length === allColumns.length) return "*";
    if (selectedColumns.length <= 3) {
      return allColumns
        .filter((c) => selectedColumns.includes(c.value))
        .map((c) => c.shortLabel)
        .join(", ");
    }
    return `${selectedColumns.length} columns`;
  };

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 bg-background shadow-sm min-w-[160px] relative",
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
        <div className="absolute top-full left-0 mt-2 w-64 bg-background border rounded-lg shadow-lg p-3 z-50 max-h-80 overflow-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-sm">Select Columns</h4>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowConfig(false)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSelectAll}
            >
              {selectedColumns.length === allColumns.length
                ? "Deselect All"
                : "Select All"}
            </Button>

            <div className="space-y-1 max-h-48 overflow-auto">
              {allColumns.map((col) => (
                <label
                  key={col.value}
                  className="flex items-center gap-2 text-xs p-1 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.value)}
                    onChange={() => handleToggleColumn(col.value)}
                    className="size-3"
                  />
                  <span className="truncate">{col.shortLabel}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
