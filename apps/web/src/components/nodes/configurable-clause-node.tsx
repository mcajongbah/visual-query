import { Handle, Position, type NodeProps } from "@xyflow/react";
import * as Icons from "lucide-react";
import { SettingsIcon, XIcon, AlertCircleIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { Button } from "../ui/button";
import {
  getNodeConfig,
  type FieldConfig,
  type DataSource,
} from "../../lib/node-configs";
import {
  getColumnsFromContext,
  getTablesFromSchema,
  getOperators,
} from "../../lib/node-effects";
import { validateNode } from "../../lib/node-validator";
import { ColumnMultiSelectField } from "../config-fields/column-multi-select-field";
import { SelectField } from "../config-fields/select-field";
import { TextField } from "../config-fields/text-field";
import { NumberField } from "../config-fields/number-field";
import { OrderListField } from "../config-fields/order-list-field";

/**
 * Universal configurable node that handles clauses dynamically based on metadata
 */
export function ConfigurableClauseNode({
  id,
  data,
  selected,
}: NodeProps<SqlNodeData>) {
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

  // Resolve data source for a field
  const resolveDataSource = (dataSource?: DataSource) => {
    if (!dataSource) return [];

    if (typeof dataSource === "object" && "values" in dataSource) {
      return dataSource.values.map((v) => ({ label: v, value: v }));
    }

    switch (dataSource) {
      case "tables":
        return getTablesFromSchema(schema);

      case "columns":
        return (
          schema?.tables.flatMap((table: any) =>
            table.columns.map((col: any) => ({
              label: col.name,
              value: `${table.schema}.${table.name}.${col.name}`,
              tableName: table.name,
            }))
          ) || []
        );

      case "columns-from-context": {
        const cols = getColumnsFromContext(id, nodes, edges, schema);
        return cols;
      }

      case "operators":
        return getOperators("comparison").map((op) => ({
          label: op,
          value: op,
        }));

      case "logical-operators":
        return getOperators("logical").map((op) => ({ label: op, value: op }));

      default:
        return [];
    }
  };

  // Handle field change
  const handleFieldChange = (fieldKey: string, value: any) => {
    updateNodeData(id, { [fieldKey]: value });
  };

  // Render field based on type
  const renderField = (field: FieldConfig) => {
    const value = data.config?.[field.key];
    const options = resolveDataSource(field.dataSource);
    const errors = validationErrors.filter((e) =>
      e.toLowerCase().includes(field.label.toLowerCase())
    );
    const errorMsg = errors[0];
    const isRequired = field.validators?.some((v) => v.type === "required");

    // Check conditional visibility
    if (field.conditional) {
      const condValue = data.config?.[field.conditional.field];
      const operator = field.conditional.operator || "equals";
      let shouldShow = false;

      switch (operator) {
        case "equals":
          shouldShow = condValue === field.conditional.value;
          break;
        case "notEquals":
          shouldShow = condValue !== field.conditional.value;
          break;
        case "includes":
          shouldShow = Array.isArray(condValue)
            ? condValue.includes(field.conditional.value)
            : false;
          break;
        case "notIncludes":
          shouldShow = Array.isArray(condValue)
            ? !condValue.includes(field.conditional.value)
            : true;
          break;
      }

      if (!shouldShow) return null;
    }

    switch (field.type) {
      case "column-multi-select":
        return (
          <ColumnMultiSelectField
            key={field.key}
            label={field.label}
            helpText={field.helpText}
            error={errorMsg}
            required={isRequired}
            value={value || []}
            options={options}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );

      case "table-select":
      case "column-select":
      case "operator-select":
      case "single-select":
        return (
          <SelectField
            key={field.key}
            label={field.label}
            helpText={field.helpText}
            error={errorMsg}
            required={isRequired}
            value={value || ""}
            options={options}
            placeholder={field.placeholder}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );

      case "text":
        return (
          <TextField
            key={field.key}
            label={field.label}
            helpText={field.helpText}
            error={errorMsg}
            required={isRequired}
            value={value || ""}
            placeholder={field.placeholder}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );

      case "number":
        return (
          <NumberField
            key={field.key}
            label={field.label}
            helpText={field.helpText}
            error={errorMsg}
            required={isRequired}
            value={value || 0}
            placeholder={field.placeholder}
            min={
              field.validators?.find((v) => v.type === "min")?.value as number
            }
            max={
              field.validators?.find((v) => v.type === "max")?.value as number
            }
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );

      case "order-list":
        return (
          <OrderListField
            key={field.key}
            label={field.label}
            helpText={field.helpText}
            error={errorMsg}
            required={isRequired}
            value={value || []}
            columnOptions={options}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );

      case "column-multi-select":
        return (
          <ColumnMultiSelectField
            key={field.key}
            label={field.label}
            helpText={field.helpText}
            error={errorMsg}
            required={isRequired}
            value={value || []}
            options={options}
            onChange={(v) => handleFieldChange(field.key, v)}
          />
        );

      default:
        return (
          <div key={field.key} className="text-xs text-muted-foreground">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  // Render summary in collapsed node
  const renderConfigSummary = () => {
    if (!config?.display) return null;

    const displayConfigs = Object.entries(config.display)
      .filter(([_, cfg]) => cfg.showInSummary)
      .sort((a, b) => (a[1].priority || 999) - (b[1].priority || 999));

    if (displayConfigs.length === 0) {
      return <span className="opacity-50">Configure</span>;
    }

    const parts: string[] = [];
    for (const [fieldKey, displayCfg] of displayConfigs) {
      const value = data.config?.[fieldKey];
      if (value !== undefined && value !== null) {
        const formatted = displayCfg.format
          ? displayCfg.format(value, data.config)
          : String(value);
        if (formatted) parts.push(formatted);
      }
    }

    return parts.length > 0 ? (
      parts.join(" · ")
    ) : (
      <span className="opacity-50">Configure</span>
    );
  };

  const hasErrors = validationErrors.length > 0;

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 bg-background shadow-sm min-w-[160px] relative",
        selected ? "border-primary" : hasErrors ? "border-destructive" : "border-border"
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary" />

      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-1">
            {data.label}
            {hasErrors && <AlertCircleIcon className="size-3 text-destructive" />}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 truncate">
            {renderConfigSummary()}
          </div>
        </div>
        {config && config.fields.length > 0 && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowConfig(!showConfig)}
            className="shrink-0"
          >
            <SettingsIcon className="size-3" />
          </Button>
        )}
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
            {config.fields.map((field) => renderField(field))}
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
