import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";

export function FromNode({ id, data, selected }: NodeProps<SqlNodeData>) {
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

  const selectedTable = data.config?.selectedTable;

  const handleSelectTable = (tableValue: string) => {
    updateNodeData(id, { selectedTable: tableValue });
    setShowConfig(false);
  };

  const renderConfigSummary = () => {
    if (!selectedTable) return <span className="opacity-50">Select table</span>;
    const table = tables.find((t) => t.value === selectedTable);
    return table?.shortLabel || selectedTable;
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
            <h4 className="font-semibold text-sm">Select Table</h4>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowConfig(false)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>

          <div className="space-y-1">
            {tables.map((table) => (
              <button
                key={table.value}
                onClick={() => handleSelectTable(table.value)}
                className={cn(
                  "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted",
                  selectedTable === table.value && "bg-primary/10 font-medium"
                )}
              >
                {table.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
