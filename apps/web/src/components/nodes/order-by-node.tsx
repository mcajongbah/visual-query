import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { PlusIcon, SettingsIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";

export function OrderByNode({ id, data, selected }: NodeProps<SqlNodeData>) {
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

  const orderColumns = data.config?.orderColumns || [];

  const handleAddColumn = () => {
    updateNodeData(id, {
      orderColumns: [
        ...orderColumns,
        { column: "", direction: "ASC" as const },
      ],
    });
  };

  const handleUpdateColumn = (
    index: number,
    updates: Partial<{ column: string; direction: "ASC" | "DESC" }>
  ) => {
    const newColumns = [...orderColumns];
    newColumns[index] = { ...newColumns[index], ...updates };
    updateNodeData(id, { orderColumns: newColumns });
  };

  const handleRemoveColumn = (index: number) => {
    updateNodeData(id, {
      orderColumns: orderColumns.filter((_, i) => i !== index),
    });
  };

  const renderConfigSummary = () => {
    if (!orderColumns.length)
      return <span className="opacity-50">Add columns</span>;
    return orderColumns
      .map((o) => {
        const col = o.column.split(".").pop() || o.column;
        return `${col} ${o.direction}`;
      })
      .join(", ");
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
        <div className="absolute top-full left-0 mt-2 w-80 bg-background border rounded-lg shadow-lg p-3 z-50 max-h-96 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Order By Columns</h4>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowConfig(false)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>

          <div className="space-y-2">
            {orderColumns.map((item, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <select
                    className="w-full px-2 py-1.5 text-xs border rounded"
                    value={item.column}
                    onChange={(e) =>
                      handleUpdateColumn(index, { column: e.target.value })
                    }
                  >
                    <option value="">Select column</option>
                    {allColumns.map((col) => (
                      <option key={col.value} value={col.value}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full px-2 py-1.5 text-xs border rounded"
                    value={item.direction}
                    onChange={(e) =>
                      handleUpdateColumn(index, {
                        direction: e.target.value as "ASC" | "DESC",
                      })
                    }
                  >
                    <option value="ASC">Ascending</option>
                    <option value="DESC">Descending</option>
                  </select>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemoveColumn(index)}
                >
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleAddColumn}
            >
              <PlusIcon className="size-3 mr-1" />
              Add Column
            </Button>
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
