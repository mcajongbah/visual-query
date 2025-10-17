import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon, AlertCircleIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";
import { getNodeConfig } from "../../lib/node-configs";
import {
  getColumnsFromContext,
  getTablesFromSchema,
} from "../../lib/node-effects";
import { validateNode } from "../../lib/node-validator";
import { SelectField } from "../config-fields/select-field";

/**
 * Specialized node for JOIN operations
 */
export function RelationNode({ id, data, selected }: NodeProps<SqlNodeData>) {
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

  // Get available options
  const availableTables = getTablesFromSchema(schema);
  const availableColumns = getColumnsFromContext(id, nodes, edges, schema);

  // Get columns for the selected join table
  const joinTableColumns = data.config?.joinTable
    ? schema?.tables
        .find((t: any) => {
          const [schemaName, tableName] = data.config.joinTable.split(".");
          return t.name === tableName && t.schema === schemaName;
        })
        ?.columns.map((col: any) => ({
          label: col.name,
          value: `${data.config.joinTable}.${col.name}`,
        })) || []
    : [];

  // Handle field changes
  const handleFieldChange = (key: string, value: any) => {
    updateNodeData(id, { [key]: value });
  };

  // Render summary in collapsed node
  const renderConfigSummary = () => {
    const { joinTable, onColumn, onReferencedColumn } = data.config || {};

    if (!joinTable) {
      return <span className="opacity-50">Configure join</span>;
    }

    const tableName = joinTable.split(".").pop();
    if (!onColumn || !onReferencedColumn) {
      return tableName;
    }

    const col1 = onColumn.split(".").pop();
    const col2 = onReferencedColumn.split(".").pop();
    return `${tableName} ON ${col1} = ${col2}`;
  };

  const hasErrors = validationErrors.length > 0;
  const errors = validationErrors.reduce(
    (acc, err) => {
      if (err.toLowerCase().includes("table")) acc.joinTable = err;
      else if (err.toLowerCase().includes("left")) acc.onColumn = err;
      else if (err.toLowerCase().includes("right")) acc.onReferencedColumn = err;
      return acc;
    },
    {} as Record<string, string>
  );

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

      {showConfig && config && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-background border rounded-lg shadow-xl p-3 z-50 max-h-[500px] overflow-auto">
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

          <div className="space-y-3">
            {/* Join Table Selection */}
            <SelectField
              label="Join Table"
              helpText="Select the table to join"
              error={errors.joinTable}
              required
              value={data.config?.joinTable || ""}
              options={availableTables}
              placeholder="Select table"
              onChange={(v) => {
                handleFieldChange("joinTable", v);
                // Reset ON columns when table changes
                handleFieldChange("onColumn", "");
                handleFieldChange("onReferencedColumn", "");
              }}
            />

            {/* Left Column (from existing tables) */}
            <SelectField
              label="Left Column"
              helpText="Column from the left side of the join"
              error={errors.onColumn}
              required
              value={data.config?.onColumn || ""}
              options={availableColumns}
              placeholder="Select column"
              onChange={(v) => handleFieldChange("onColumn", v)}
            />

            {/* Right Column (from join table) */}
            {data.config?.joinTable && (
              <SelectField
                label="Right Column"
                helpText="Column from the joined table"
                error={errors.onReferencedColumn}
                required
                value={data.config?.onReferencedColumn || ""}
                options={joinTableColumns}
                placeholder="Select column"
                onChange={(v) => handleFieldChange("onReferencedColumn", v)}
              />
            )}

            {/* Foreign Key Suggestions */}
            {data.config?.joinTable && schema && (
              <ForeignKeySuggestions
                joinTable={data.config.joinTable}
                schema={schema}
                nodes={nodes}
                edges={edges}
                onApply={(leftCol, rightCol) => {
                  handleFieldChange("onColumn", leftCol);
                  handleFieldChange("onReferencedColumn", rightCol);
                }}
              />
            )}
          </div>

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

/**
 * Component to suggest foreign key relationships
 */
function ForeignKeySuggestions({
  joinTable,
  schema,
  nodes,
  edges,
  onApply,
}: {
  joinTable: string;
  schema: any;
  nodes: any[];
  edges: any[];
  onApply: (leftCol: string, rightCol: string) => void;
}) {
  // Find foreign keys that could apply
  const [schemaName, tableName] = joinTable.split(".");

  const joinTableInfo = schema.tables.find(
    (t: any) => t.name === tableName && t.schema === schemaName
  );

  if (!joinTableInfo?.foreignKeys || joinTableInfo.foreignKeys.length === 0) {
    return null;
  }

  return (
    <div className="p-2 bg-muted/50 rounded border">
      <p className="text-xs font-medium mb-1.5">Foreign Key Suggestions:</p>
      <div className="space-y-1">
        {joinTableInfo.foreignKeys.map((fk: any, index: number) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              const leftCol = `${fk.referencedSchema || schemaName}.${fk.referencedTable}.${fk.referencedColumns[0]}`;
              const rightCol = `${schemaName}.${tableName}.${fk.columns[0]}`;
              onApply(leftCol, rightCol);
            }}
            className="w-full text-left px-2 py-1.5 text-xs bg-background border rounded hover:bg-primary/10 hover:border-primary transition-colors"
          >
            <span className="font-medium">
              {fk.referencedTable}.{fk.referencedColumns[0]}
            </span>{" "}
            →{" "}
            <span className="font-medium">
              {tableName}.{fk.columns[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
