/**
 * Field types for node configuration
 */
export type FieldType =
  | "single-select" // Dropdown with single selection
  | "multi-select" // Checkboxes for multiple selection
  | "text" // Text input
  | "number" // Number input
  | "column-select" // Column selector (single)
  | "column-multi-select" // Multiple column selector
  | "table-select" // Table selector
  | "operator-select" // Operator dropdown
  | "predicate-builder" // Complex WHERE/HAVING builder
  | "order-list" // List of column + direction
  | "join-config"; // Join table + ON condition

/**
 * Data source for select fields
 */
export type DataSource =
  | "tables" // All tables from schema
  | "columns" // All columns from schema
  | "columns-from-context" // Columns from connected FROM/JOIN nodes
  | "operators" // Comparison operators
  | "aggregate-operators" // COUNT, SUM, AVG, MIN, MAX
  | "logical-operators" // AND, OR, NOT
  | { values: string[] }; // Static list

/**
 * Validator types
 */
export type ValidatorType = "required" | "min" | "max" | "regex" | "custom";

export interface FieldValidator {
  type: ValidatorType;
  value?: any;
  message: string;
  validate?: (value: any, allConfig: any, context: any) => boolean;
}

/**
 * Field configuration definition
 */
export interface FieldConfig {
  key: string; // Config key (e.g., "selectedColumns")
  label: string; // Display label
  type: FieldType;
  dataSource?: DataSource;
  placeholder?: string;
  defaultValue?: any;
  validators?: FieldValidator[];
  helpText?: string;
  dependsOn?: string[]; // Other fields this depends on
  conditional?: {
    // Show field only if condition met
    field: string;
    value: any;
    operator?: "equals" | "notEquals" | "includes" | "notIncludes";
  };
}

/**
 * Display configuration for node summary
 */
export interface DisplayConfig {
  showInSummary: boolean;
  format?: (value: any, context?: any) => string; // Format value for display
  icon?: string; // Optional icon name
  priority?: number; // Display order (lower = higher priority)
}

/**
 * Effect definition for cascading updates
 */
export interface NodeEffect {
  trigger: {
    nodeValue: string; // Which keyword triggers this
    configKey: string; // Which config change triggers it
  };
  targets: Array<{
    targetNodeValues: string[]; // Which keywords are affected
    action: "reset" | "update" | "validate" | "custom";
    configKey?: string;
    newValue?: any | ((oldValue: any, context: any) => any);
    customHandler?: (
      triggerNode: any,
      targetNode: any,
      context: any
    ) => Partial<any>;
  }>;
}

/**
 * Complete node configuration
 */
export interface NodeConfig {
  keyword: string; // Matches SqlKeywordMeta.value
  archetype: "clause" | "predicate" | "relation" | "simple"; // Which component to use
  fields: FieldConfig[];
  display: Record<string, DisplayConfig>; // Key matches field key
  effects?: NodeEffect[];
}

/**
 * Configuration registry for all SQL keywords
 */
export const nodeConfigRegistry: Record<string, NodeConfig> = {
  SELECT: {
    keyword: "SELECT",
    archetype: "clause",
    fields: [
      {
        key: "selectedColumns",
        label: "Columns",
        type: "column-multi-select",
        dataSource: "columns-from-context",
        defaultValue: [],
        helpText: "Select columns to retrieve. Empty = * (all columns)",
      },
    ],
    display: {
      selectedColumns: {
        showInSummary: true,
        priority: 1,
        format: (cols: string[], context) => {
          if (!cols || cols.length === 0) return "*";
          const allColumns = context?.allColumns || [];
          if (cols.length === allColumns.length) return "*";
          if (cols.length <= 3) {
            return cols.map((c) => c.split(".").pop()).join(", ");
          }
          return `${cols.length} columns`;
        },
      },
    },
    effects: [
      {
        trigger: { nodeValue: "SELECT", configKey: "selectedColumns" },
        targets: [
          {
            targetNodeValues: ["FROM"],
            action: "validate",
          },
        ],
      },
    ],
  },

  FROM: {
    keyword: "FROM",
    archetype: "clause",
    fields: [
      {
        key: "selectedTable",
        label: "Table",
        type: "table-select",
        dataSource: "tables",
        validators: [{ type: "required", message: "Table is required" }],
        helpText: "Select the primary table for this query",
      },
    ],
    display: {
      selectedTable: {
        showInSummary: true,
        priority: 1,
        format: (table: string) => table.split(".").pop() || table,
      },
    },
    effects: [
      {
        trigger: { nodeValue: "FROM", configKey: "selectedTable" },
        targets: [
          {
            targetNodeValues: ["SELECT"],
            action: "reset",
            configKey: "selectedColumns",
            newValue: [],
          },
          {
            targetNodeValues: ["WHERE", "HAVING"],
            action: "reset",
            configKey: "conditions",
            newValue: [],
          },
          {
            targetNodeValues: [
              "INNER JOIN",
              "LEFT JOIN",
              "RIGHT JOIN",
              "FULL OUTER JOIN",
              "JOIN",
            ],
            action: "validate",
          },
        ],
      },
    ],
  },

  WHERE: {
    keyword: "WHERE",
    archetype: "predicate",
    fields: [
      {
        key: "conditions",
        label: "Conditions",
        type: "predicate-builder",
        dataSource: "columns-from-context",
        defaultValue: [],
        helpText:
          "Build filter conditions. Supports grouping with AND/OR logic.",
      },
    ],
    display: {
      conditions: {
        showInSummary: true,
        priority: 1,
        format: (conditions: any[]) => {
          if (!conditions || conditions.length === 0) return "No conditions";
          if (conditions.length === 1) {
            const c = conditions[0];
            return `${c.column?.split(".").pop()} ${c.operator} ${
              c.value || "?"
            }`;
          }
          return `${conditions.length} conditions`;
        },
      },
    },
  },

  HAVING: {
    keyword: "HAVING",
    archetype: "predicate",
    fields: [
      {
        key: "conditions",
        label: "Conditions",
        type: "predicate-builder",
        dataSource: "columns-from-context",
        defaultValue: [],
        helpText: "Filter aggregated results. Use aggregate functions.",
      },
    ],
    display: {
      conditions: {
        showInSummary: true,
        priority: 1,
        format: (conditions: any[]) => {
          if (!conditions || conditions.length === 0) return "No conditions";
          return `${conditions.length} conditions`;
        },
      },
    },
  },

  "INNER JOIN": {
    keyword: "INNER JOIN",
    archetype: "relation",
    fields: [
      {
        key: "joinTable",
        label: "Join Table",
        type: "table-select",
        dataSource: "tables",
        validators: [{ type: "required", message: "Join table is required" }],
      },
      {
        key: "onColumn",
        label: "Left Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Join condition column required" },
        ],
        helpText: "Column from the left table",
      },
      {
        key: "onReferencedColumn",
        label: "Right Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Referenced column required" },
        ],
        helpText: "Column from the joined table",
        dependsOn: ["joinTable"],
      },
    ],
    display: {
      joinTable: {
        showInSummary: true,
        priority: 1,
        format: (table: string) => table.split(".").pop() || table,
      },
      onColumn: {
        showInSummary: true,
        priority: 2,
        format: (col: string, context) => {
          const onRef = context?.onReferencedColumn;
          if (onRef) {
            return `${col.split(".").pop()} = ${onRef.split(".").pop()}`;
          }
          return "";
        },
      },
    },
  },

  "LEFT JOIN": {
    keyword: "LEFT JOIN",
    archetype: "relation",
    fields: [
      {
        key: "joinTable",
        label: "Join Table",
        type: "table-select",
        dataSource: "tables",
        validators: [{ type: "required", message: "Join table is required" }],
      },
      {
        key: "onColumn",
        label: "Left Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Join condition column required" },
        ],
      },
      {
        key: "onReferencedColumn",
        label: "Right Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Referenced column required" },
        ],
        dependsOn: ["joinTable"],
      },
    ],
    display: {
      joinTable: {
        showInSummary: true,
        priority: 1,
        format: (table: string) => table.split(".").pop() || table,
      },
      onColumn: {
        showInSummary: true,
        priority: 2,
        format: (col: string, context) => {
          const onRef = context?.onReferencedColumn;
          if (onRef) {
            return `${col.split(".").pop()} = ${onRef.split(".").pop()}`;
          }
          return "";
        },
      },
    },
  },

  "RIGHT JOIN": {
    keyword: "RIGHT JOIN",
    archetype: "relation",
    fields: [
      {
        key: "joinTable",
        label: "Join Table",
        type: "table-select",
        dataSource: "tables",
        validators: [{ type: "required", message: "Join table is required" }],
      },
      {
        key: "onColumn",
        label: "Left Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Join condition column required" },
        ],
      },
      {
        key: "onReferencedColumn",
        label: "Right Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Referenced column required" },
        ],
        dependsOn: ["joinTable"],
      },
    ],
    display: {
      joinTable: {
        showInSummary: true,
        priority: 1,
        format: (table: string) => table.split(".").pop() || table,
      },
      onColumn: {
        showInSummary: true,
        priority: 2,
        format: (col: string, context) => {
          const onRef = context?.onReferencedColumn;
          if (onRef) {
            return `${col.split(".").pop()} = ${onRef.split(".").pop()}`;
          }
          return "";
        },
      },
    },
  },

  "FULL OUTER JOIN": {
    keyword: "FULL OUTER JOIN",
    archetype: "relation",
    fields: [
      {
        key: "joinTable",
        label: "Join Table",
        type: "table-select",
        dataSource: "tables",
        validators: [{ type: "required", message: "Join table is required" }],
      },
      {
        key: "onColumn",
        label: "Left Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Join condition column required" },
        ],
      },
      {
        key: "onReferencedColumn",
        label: "Right Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Referenced column required" },
        ],
        dependsOn: ["joinTable"],
      },
    ],
    display: {
      joinTable: {
        showInSummary: true,
        priority: 1,
        format: (table: string) => table.split(".").pop() || table,
      },
      onColumn: {
        showInSummary: true,
        priority: 2,
        format: (col: string, context) => {
          const onRef = context?.onReferencedColumn;
          if (onRef) {
            return `${col.split(".").pop()} = ${onRef.split(".").pop()}`;
          }
          return "";
        },
      },
    },
  },

  JOIN: {
    keyword: "JOIN",
    archetype: "relation",
    fields: [
      {
        key: "joinTable",
        label: "Join Table",
        type: "table-select",
        dataSource: "tables",
        validators: [{ type: "required", message: "Join table is required" }],
      },
      {
        key: "onColumn",
        label: "Left Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Join condition column required" },
        ],
      },
      {
        key: "onReferencedColumn",
        label: "Right Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "Referenced column required" },
        ],
        dependsOn: ["joinTable"],
      },
    ],
    display: {
      joinTable: {
        showInSummary: true,
        priority: 1,
        format: (table: string) => table.split(".").pop() || table,
      },
      onColumn: {
        showInSummary: true,
        priority: 2,
        format: (col: string, context) => {
          const onRef = context?.onReferencedColumn;
          if (onRef) {
            return `${col.split(".").pop()} = ${onRef.split(".").pop()}`;
          }
          return "";
        },
      },
    },
  },

  "GROUP BY": {
    keyword: "GROUP BY",
    archetype: "clause",
    fields: [
      {
        key: "groupColumns",
        label: "Group By Columns",
        type: "column-multi-select",
        dataSource: "columns-from-context",
        validators: [
          { type: "required", message: "At least one column required" },
        ],
        helpText: "Non-aggregated SELECT columns must be listed here",
      },
    ],
    display: {
      groupColumns: {
        showInSummary: true,
        priority: 1,
        format: (cols: string[]) => {
          if (!cols || cols.length === 0) return "No columns";
          if (cols.length <= 2) {
            return cols.map((c) => c.split(".").pop()).join(", ");
          }
          return `${cols.length} columns`;
        },
      },
    },
  },

  "ORDER BY": {
    keyword: "ORDER BY",
    archetype: "clause",
    fields: [
      {
        key: "orderColumns",
        label: "Order By",
        type: "order-list",
        dataSource: "columns-from-context",
        defaultValue: [],
        validators: [
          { type: "required", message: "At least one column required" },
        ],
        helpText: "Specify columns and sort direction (ASC/DESC)",
      },
    ],
    display: {
      orderColumns: {
        showInSummary: true,
        priority: 1,
        format: (orders: Array<{ column: string; direction: string }>) => {
          if (!orders || orders.length === 0) return "No order";
          if (orders.length === 1) {
            return `${orders[0].column.split(".").pop()} ${
              orders[0].direction
            }`;
          }
          return `${orders.length} columns`;
        },
      },
    },
  },

  LIMIT: {
    keyword: "LIMIT",
    archetype: "simple",
    fields: [
      {
        key: "limitValue",
        label: "Limit",
        type: "number",
        placeholder: "Enter row limit",
        validators: [
          { type: "required", message: "Limit value required" },
          { type: "min", value: 1, message: "Must be at least 1" },
        ],
      },
    ],
    display: {
      limitValue: {
        showInSummary: true,
        priority: 1,
        format: (val: number) => String(val),
      },
    },
  },

  OFFSET: {
    keyword: "OFFSET",
    archetype: "simple",
    fields: [
      {
        key: "offsetValue",
        label: "Offset",
        type: "number",
        placeholder: "Enter offset",
        validators: [
          { type: "required", message: "Offset value required" },
          { type: "min", value: 0, message: "Must be 0 or greater" },
        ],
      },
    ],
    display: {
      offsetValue: {
        showInSummary: true,
        priority: 1,
        format: (val: number) => String(val),
      },
    },
  },

  COUNT: {
    keyword: "COUNT",
    archetype: "clause",
    fields: [
      {
        key: "aggregateColumn",
        label: "Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [{ type: "required", message: "Column required" }],
        helpText: "Use * to count all rows",
      },
      {
        key: "alias",
        label: "Alias",
        type: "text",
        placeholder: "count_result",
        helpText: "Optional alias for the result",
      },
    ],
    display: {
      aggregateColumn: {
        showInSummary: true,
        priority: 1,
        format: (col: string, context) => {
          const alias = context?.alias;
          return `COUNT(${col.split(".").pop()})${alias ? ` AS ${alias}` : ""}`;
        },
      },
    },
  },

  SUM: {
    keyword: "SUM",
    archetype: "clause",
    fields: [
      {
        key: "aggregateColumn",
        label: "Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [{ type: "required", message: "Column required" }],
      },
      {
        key: "alias",
        label: "Alias",
        type: "text",
        placeholder: "sum_result",
        helpText: "Optional alias for the result",
      },
    ],
    display: {
      aggregateColumn: {
        showInSummary: true,
        priority: 1,
        format: (col: string, context) => {
          const alias = context?.alias;
          return `SUM(${col.split(".").pop()})${alias ? ` AS ${alias}` : ""}`;
        },
      },
    },
  },

  AVG: {
    keyword: "AVG",
    archetype: "clause",
    fields: [
      {
        key: "aggregateColumn",
        label: "Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [{ type: "required", message: "Column required" }],
      },
      {
        key: "alias",
        label: "Alias",
        type: "text",
        placeholder: "avg_result",
        helpText: "Optional alias for the result",
      },
    ],
    display: {
      aggregateColumn: {
        showInSummary: true,
        priority: 1,
        format: (col: string, context) => {
          const alias = context?.alias;
          return `AVG(${col.split(".").pop()})${alias ? ` AS ${alias}` : ""}`;
        },
      },
    },
  },

  MIN: {
    keyword: "MIN",
    archetype: "clause",
    fields: [
      {
        key: "aggregateColumn",
        label: "Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [{ type: "required", message: "Column required" }],
      },
      {
        key: "alias",
        label: "Alias",
        type: "text",
        placeholder: "min_result",
        helpText: "Optional alias for the result",
      },
    ],
    display: {
      aggregateColumn: {
        showInSummary: true,
        priority: 1,
        format: (col: string, context) => {
          const alias = context?.alias;
          return `MIN(${col.split(".").pop()})${alias ? ` AS ${alias}` : ""}`;
        },
      },
    },
  },

  MAX: {
    keyword: "MAX",
    archetype: "clause",
    fields: [
      {
        key: "aggregateColumn",
        label: "Column",
        type: "column-select",
        dataSource: "columns-from-context",
        validators: [{ type: "required", message: "Column required" }],
      },
      {
        key: "alias",
        label: "Alias",
        type: "text",
        placeholder: "max_result",
        helpText: "Optional alias for the result",
      },
    ],
    display: {
      aggregateColumn: {
        showInSummary: true,
        priority: 1,
        format: (col: string, context) => {
          const alias = context?.alias;
          return `MAX(${col.split(".").pop()})${alias ? ` AS ${alias}` : ""}`;
        },
      },
    },
  },

  DISTINCT: {
    keyword: "DISTINCT",
    archetype: "simple",
    fields: [],
    display: {},
  },

  TOP: {
    keyword: "TOP",
    archetype: "simple",
    fields: [
      {
        key: "topValue",
        label: "Top N",
        type: "number",
        placeholder: "Enter number of rows",
        validators: [
          { type: "required", message: "Value required" },
          { type: "min", value: 1, message: "Must be at least 1" },
        ],
      },
    ],
    display: {
      topValue: {
        showInSummary: true,
        priority: 1,
        format: (val: number) => String(val),
      },
    },
  },
};

/**
 * Get configuration for a specific keyword
 */
export function getNodeConfig(keyword: string): NodeConfig | undefined {
  return nodeConfigRegistry[keyword];
}

/**
 * Get all field configs for a keyword
 */
export function getFieldConfigs(keyword: string): FieldConfig[] {
  const config = getNodeConfig(keyword);
  return config?.fields || [];
}

/**
 * Get display config for a field
 */
export function getDisplayConfig(
  keyword: string,
  fieldKey: string
): DisplayConfig | undefined {
  const config = getNodeConfig(keyword);
  return config?.display[fieldKey];
}
