import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { cn } from "../../lib/utils";
import { type SqlNodeData } from "store/query-store";

export function SqlNode({ data, selected }: NodeProps<SqlNodeData>) {
  const Icon =
    // @ts-expect-error - dynamic icon lookup
    Icons[
      data.meta.icon
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")
    ] || Icons.CircleHelp;

  const renderConfigSummary = () => {
    if (!data.config) return null;

    const parts: string[] = [];

    if (data.config.selectedColumns?.length) {
      parts.push(data.config.selectedColumns.join(", "));
    }
    if (data.config.selectedTable) {
      parts.push(data.config.selectedTable);
    }
    if (data.config.column && data.config.operator) {
      parts.push(
        `${data.config.column} ${data.config.operator} ${
          data.config.value || "?"
        }`
      );
    }
    if (data.config.joinTable) {
      parts.push(data.config.joinTable);
    }
    if (data.config.aggregateColumn) {
      parts.push(data.config.aggregateColumn);
    }
    if (data.config.groupColumns?.length) {
      parts.push(data.config.groupColumns.join(", "));
    }
    if (data.config.orderColumns?.length) {
      parts.push(
        data.config.orderColumns
          .map((o) => `${o.column} ${o.direction}`)
          .join(", ")
      );
    }
    if (data.config.limitValue) {
      parts.push(String(data.config.limitValue));
    }

    if (parts.length === 0) return null;

    return (
      <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[160px]">
        {parts.join(" ")}
      </div>
    );
  };

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 bg-background shadow-sm min-w-[140px]",
        selected ? "border-primary" : "border-border"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />

      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{data.label}</div>
          {renderConfigSummary()}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
