import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";

export function JoinNode({ id, data, selected }: NodeProps<SqlNodeData>) {
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

  const tables =
    schema?.tables.map((t) => ({
      label: t.name, // Just show table name
      value: `${t.schema}.${t.name}`,
      shortLabel: t.name,
    })) || [];

  const allColumns =
    schema?.tables.flatMap((table) =>
      table.columns.map((col) => ({
        label: col.name, // Just show column name
        value: `${table.schema}.${table.name}.${col.name}`,
      }))
    ) || [];

  const joinTable = data.config?.joinTable;
  const onColumn = data.config?.onColumn;
  const onReferencedColumn = data.config?.onReferencedColumn;

  const handleUpdate = (updates: Partial<SqlNodeData["config"]>) => {
    updateNodeData(id, updates);
  };

  const renderConfigSummary = () => {
    if (!joinTable) return <span className="opacity-50">Configure join</span>;
    const table = tables.find((t) => t.value === joinTable);
    if (!onColumn || !onReferencedColumn) return table?.shortLabel;
    return `${table?.shortLabel} ON ...`;
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
        <div className="absolute top-full left-0 mt-2 w-72 bg-background border rounded-lg shadow-lg p-3 z-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Join Configuration</h4>
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
              <label className="text-xs font-medium mb-1 block">
                Join Table
              </label>
              <select
                className="w-full px-2 py-1.5 text-xs border rounded"
                value={joinTable || ""}
                onChange={(e) => handleUpdate({ joinTable: e.target.value })}
              >
                <option value="">Select table</option>
                {tables.map((table) => (
                  <option key={table.value} value={table.value}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">
                ON Column
              </label>
              <select
                className="w-full px-2 py-1.5 text-xs border rounded"
                value={onColumn || ""}
                onChange={(e) => handleUpdate({ onColumn: e.target.value })}
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
              <label className="text-xs font-medium mb-1 block">
                Referenced Column
              </label>
              <select
                className="w-full px-2 py-1.5 text-xs border rounded"
                value={onReferencedColumn || ""}
                onChange={(e) =>
                  handleUpdate({ onReferencedColumn: e.target.value })
                }
              >
                <option value="">Select column</option>
                {allColumns.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
