import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon, AlertCircleIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";
import { getNodeConfig } from "../../lib/node-configs";
import { getColumnsFromContext, getOperators } from "../../lib/node-effects";
import { validateNode } from "../../lib/node-validator";
import { PredicateBuilderField } from "../config-fields/predicate-builder-field";

/**
 * Specialized node for WHERE and HAVING clauses with complex predicate building
 */
export function PredicateNode({ id, data, selected }: NodeProps<SqlNodeData>) {
  const { schema, updateNodeData, nodes, edges } = useQueryStore();
  const [showConfig, setShowConfig] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const config = getNodeConfig(data.label);

  // Get icon dynamically
  const Icon =
    // @ts-expect-error - dynamic icon lookup
    Icons[
      data.meta.icon
        .split("-")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("")
    ] || Icons.CircleHelp;

  // Validate on config change
  useEffect(() => {
    const node = nodes.find((n) => n.id === id);
    if (node) {
      const errors = validateNode(node, { nodes, edges, schema });
      setValidationErrors(errors.map((e) => e.message));
    }
  }, [data.config, id, nodes, edges, schema]);

  // Get available columns from context
  const availableColumns = getColumnsFromContext(id, nodes, edges, schema);
  const operators = getOperators("comparison");

  // Handle field change
  const handleConditionsChange = (value: any) => {
    updateNodeData(id, { conditions: value });
  };

  // Render summary in collapsed node
  const renderConfigSummary = () => {
    const conditions = data.config?.conditions || [];

    if (conditions.length === 0) {
      return <span className="opacity-50">No conditions</span>;
    }

    if (conditions.length === 1) {
      const c = conditions[0];
      if ("type" in c && c.type === "group") {
        return `1 group`;
      }
      const colName = c.column?.split(".").pop() || "?";
      return `${colName} ${c.operator || "?"} ${c.value || "?"}`;
    }

    // Count groups and conditions
    let groupCount = 0;
    let conditionCount = 0;

    const countItems = (items: any[]) => {
      for (const item of items) {
        if ("type" in item && item.type === "group") {
          groupCount++;
          countItems(item.conditions);
        } else {
          conditionCount++;
        }
      }
    };

    countItems(conditions);

    const parts = [];
    if (conditionCount > 0) parts.push(`${conditionCount} conditions`);
    if (groupCount > 0) parts.push(`${groupCount} groups`);

    return parts.join(", ");
  };

  const hasErrors = validationErrors.length > 0;

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 bg-background shadow-sm min-w-[180px] relative",
        selected
          ? "border-primary"
          : hasErrors
            ? "border-destructive"
            : "border-border"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />

      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-1">
            {data.label}
            {hasErrors && (
              <AlertCircleIcon className="size-3 text-destructive" />
            )}
          </div>
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
        <div className="absolute top-full left-0 mt-2 w-[420px] bg-background border rounded-lg shadow-xl p-3 z-50 max-h-[600px] overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Configure {data.label}</h4>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowConfig(false)}
            >
              <XIcon className="size-3" />
            </Button>
          </div>

          <PredicateBuilderField
            label="Filter Conditions"
            helpText={config?.fields[0]?.helpText}
            value={data.config?.conditions || []}
            columnOptions={availableColumns}
            operatorOptions={operators}
            onChange={handleConditionsChange}
          />

          {hasErrors && (
            <div className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs">
              <p className="font-semibold text-destructive mb-1">
                Validation Errors:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-destructive">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-primary" />
    </div>
  );
}
