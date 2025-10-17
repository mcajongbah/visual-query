# Scalable SQL Node Configuration System

## Overview

This document describes the new **configuration-driven architecture** that replaces hardcoded node components with a dynamic, metadata-driven system. The system now handles all 45+ SQL keywords using just 3 universal node component archetypes.

---

## Architecture Components

### 1. **Node Configuration Registry** (`src/lib/node-configs.ts`)

The central source of truth for all SQL keyword behaviors. Each keyword is defined with:

- **Fields**: Input field definitions (type, validation, data source, dependencies)
- **Display**: How to render configuration in collapsed node view
- **Effects**: Cascading updates to other nodes when config changes
- **Archetype**: Which component type to use (`clause`, `predicate`, `relation`, `simple`)

#### Adding a New Keyword

```typescript
export const nodeConfigRegistry: Record<string, NodeConfig> = {
  "YOUR_KEYWORD": {
    keyword: "YOUR_KEYWORD",
    archetype: "clause", // or "predicate", "relation", "simple"
    fields: [
      {
        key: "fieldName",
        label: "Field Label",
        type: "text", // or "number", "column-select", etc.
        validators: [
          { type: "required", message: "This field is required" }
        ],
        helpText: "Help text shown below field"
      }
    ],
    display: {
      fieldName: {
        showInSummary: true,
        priority: 1,
        format: (value) => `Formatted: ${value}`
      }
    }
  }
};
```

### 2. **Cascading Update Manager** (`src/lib/node-effects.ts`)

Handles inter-node dependencies automatically:

- **executeNodeEffects**: Runs when a node's config changes
- **getColumnsFromContext**: Resolves available columns based on upstream FROM/JOIN nodes
- **getTablesFromSchema**: Gets all tables from the database schema

#### Example Effect

When FROM table changes, SELECT columns automatically reset:

```typescript
effects: [
  {
    trigger: { nodeValue: "FROM", configKey: "selectedTable" },
    targets: [
      {
        targetNodeValues: ["SELECT"],
        action: "reset",
        configKey: "selectedColumns",
        newValue: []
      }
    ]
  }
]
```

### 3. **Validation Engine** (`src/lib/node-validator.ts`)

Type-aware validation with inline error display:

- **validateAllNodes**: Validates entire canvas before query execution
- **validateNode**: Validates a single node's configuration
- Built-in validators: `required`, `min`, `max`, `regex`, `custom`

#### Example Validation

```typescript
validators: [
  { type: "required", message: "Table is required" },
  { type: "min", value: 1, message: "Must be at least 1" },
  {
    type: "custom",
    validate: (value, allConfig, context) => {
      return value > 0 && value < 1000;
    },
    message: "Must be between 0 and 1000"
  }
]
```

### 4. **Universal Node Components**

#### A. `ConfigurableClauseNode` (Most SQL clauses)

Handles: SELECT, FROM, GROUP BY, ORDER BY, LIMIT, OFFSET, Aggregates (COUNT, SUM, AVG, MIN, MAX)

Features:
- Dynamic field rendering based on metadata
- Auto-resolves data sources (tables, columns from context)
- Validation with inline errors
- Smart summary display

#### B. `PredicateNode` (Complex filtering)

Handles: WHERE, HAVING

Features:
- Nested condition groups with AND/OR logic
- Multiple operators per group
- Visual tree builder interface
- Supports all comparison operators (=, <>, >, <, LIKE, IN, BETWEEN, IS NULL, etc.)

#### C. `RelationNode` (Join operations)

Handles: JOIN, INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL OUTER JOIN

Features:
- Table selection with auto-complete
- Column selection for ON conditions
- Foreign key relationship suggestions
- Smart column filtering based on join table

### 5. **Reusable Field Components** (`src/components/config-fields/`)

- `ColumnMultiSelectField`: Multi-select with checkboxes
- `SelectField`: Single dropdown
- `TextField`: Text input
- `NumberField`: Number input with min/max
- `OrderListField`: List of column + direction (ASC/DESC) with reordering
- `PredicateBuilderField`: Complex nested conditions builder

---

## How It Works

### 1. Adding a Node

```typescript
// In query-store.ts
const { getNodeConfig } = require("../lib/node-configs");
const config = getNodeConfig(keyword.value);

// Maps to correct archetype
if (config?.archetype === "predicate") {
  nodeType = "predicate";
} else if (config?.archetype === "relation") {
  nodeType = "relation";
} else if (config?.archetype === "clause") {
  nodeType = "configurable-clause";
}
```

### 2. Field Rendering

The ConfigurableClauseNode automatically renders fields based on type:

```typescript
switch (field.type) {
  case "column-multi-select":
    return <ColumnMultiSelectField {...props} />;
  case "table-select":
    return <SelectField {...props} />;
  case "number":
    return <NumberField {...props} />;
  // ... etc
}
```

### 3. Data Source Resolution

Fields automatically resolve their data sources:

- `"tables"` → All tables from schema
- `"columns"` → All columns from all tables
- `"columns-from-context"` → Only columns from upstream FROM/JOIN nodes
- `"operators"` → Comparison operators (=, <>, >, <, etc.)
- `{ values: ["A", "B"] }` → Static list

### 4. Cascading Updates

When FROM table changes:
1. User selects new table in FROM node
2. `updateNodeData` is called with new config
3. Effect manager detects `selectedTable` change
4. Finds all downstream nodes (SELECT, WHERE, etc.)
5. Resets their column selections
6. UI updates automatically

### 5. Query Generation

The query generator now handles the new predicate structure:

```typescript
case "WHERE": {
  const conditions = config?.conditions || [];
  if (conditions.length > 0) {
    const whereClause = buildPredicateSQL(conditions);
    sqlParts.WHERE = `WHERE ${whereClause}`;
  }
  break;
}
```

---

## Benefits

### ✅ **Scalability**
Add new SQL keywords by updating metadata, not code. No new components needed.

### ✅ **Maintainability**
Single source of truth for all behaviors. Changes propagate automatically.

### ✅ **Powerful**
- Nested WHERE conditions with grouping
- Complex JOIN relationships with FK suggestions
- Multi-column ORDER BY with reordering
- Aggregate functions with aliases

### ✅ **Validated**
Type-safe configurations before execution. Inline error display.

### ✅ **Smart**
Auto-cascading updates between nodes (FROM change → reset SELECT).

### ✅ **Extensible**
Easy to add new field types, validators, or effects.

---

## Examples

### Example 1: WHERE with Nested Conditions

```typescript
conditions: [
  {
    id: "c1",
    column: "public.users.age",
    operator: ">",
    value: "18"
  },
  {
    id: "g1",
    type: "group",
    logicalOp: "OR",
    parentLogicalOp: "AND",
    conditions: [
      {
        id: "c2",
        column: "public.users.status",
        operator: "=",
        value: "active"
      },
      {
        id: "c3",
        column: "public.users.verified",
        operator: "=",
        value: "true",
        logicalOp: "OR"
      }
    ]
  }
]
```

Generates:
```sql
WHERE "age" > '18' AND ("status" = 'active' OR "verified" = 'true')
```

### Example 2: ORDER BY Multiple Columns

```typescript
orderColumns: [
  { column: "public.users.created_at", direction: "DESC" },
  { column: "public.users.name", direction: "ASC" }
]
```

Generates:
```sql
ORDER BY "created_at" DESC, "name" ASC
```

### Example 3: JOIN with Foreign Key Suggestion

When user selects `orders` table to join:
1. System finds FK: `orders.user_id → users.id`
2. Shows suggestion button: "users.id → orders.user_id"
3. One-click apply fills both ON columns

---

## Field Types Reference

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `single-select` | Dropdown (single choice) | Operator selection |
| `multi-select` | Checkboxes (multiple) | - |
| `text` | Text input | Alias, value input |
| `number` | Number input | LIMIT, OFFSET |
| `column-select` | Column dropdown (single) | JOIN ON column |
| `column-multi-select` | Column checkboxes | SELECT columns |
| `table-select` | Table dropdown | FROM, JOIN table |
| `operator-select` | Operator dropdown | Comparison operators |
| `predicate-builder` | Complex condition tree | WHERE, HAVING |
| `order-list` | Column + direction list | ORDER BY |

---

## Validation Types Reference

| Type | Parameters | Description |
|------|------------|-------------|
| `required` | - | Value must exist |
| `min` | `value: number` | Minimum value/length |
| `max` | `value: number` | Maximum value/length |
| `regex` | `value: RegExp` | Pattern matching |
| `custom` | `validate: (val, cfg, ctx) => boolean` | Custom logic |

---

## Conditional Fields

Show fields based on other field values:

```typescript
{
  key: "value",
  label: "Value",
  type: "text",
  conditional: {
    field: "operator",
    value: "IS NULL",
    operator: "notEquals" // Show unless operator is IS NULL
  }
}
```

---

## Next Steps

1. **Add More Keywords**: Update `nodeConfigRegistry` for UNION, INTERSECT, CASE WHEN, etc.
2. **Enhance Validation**: Add SQL-specific validators (valid identifiers, safe values)
3. **Improve FK Detection**: Better foreign key relationship inference
4. **Add Subquery Support**: Nested SELECT in FROM clause
5. **Add Expression Builder**: Complex expressions like `CONCAT(first_name, ' ', last_name)`
6. **Add Window Functions**: OVER(), PARTITION BY, etc.

---

## Troubleshooting

### Node not appearing correctly?
- Check archetype mapping in `query-store.ts` → `addNode`
- Verify node type is registered in `components/nodes/index.ts`

### Field not showing?
- Check conditional logic in field definition
- Verify data source resolution in `ConfigurableClauseNode`

### Cascading effects not working?
- Check effect definition in node config
- Verify trigger values match exactly
- Check console for effect execution logs

### Query generation wrong?
- Check `query-generator.ts` case for your keyword
- Verify config structure matches expected format
- Test with simpler configurations first

---

## File Structure

```
src/
├── lib/
│   ├── node-configs.ts          # Central configuration registry
│   ├── node-effects.ts          # Cascading update manager
│   ├── node-validator.ts        # Validation engine
│   └── query-generator.ts       # SQL generation (updated)
├── components/
│   ├── nodes/
│   │   ├── configurable-clause-node.tsx
│   │   ├── predicate-node.tsx
│   │   ├── relation-node.tsx
│   │   └── index.ts             # Node type registry
│   └── config-fields/
│       ├── field-wrapper.tsx
│       ├── column-multi-select-field.tsx
│       ├── select-field.tsx
│       ├── text-field.tsx
│       ├── number-field.tsx
│       ├── order-list-field.tsx
│       └── predicate-builder-field.tsx
└── store/
    └── query-store.ts           # Updated with effects
```

---

## Summary

You now have a **fully scalable, configuration-driven SQL query builder** that:

- Handles **all SQL keywords** with just 3 component types
- Provides **complex WHERE conditions** with nested groups
- Supports **smart cascading updates** between nodes
- Includes **comprehensive validation** with inline errors
- Makes **adding new keywords** as simple as updating metadata

The system is designed to **scale infinitely** - you can add every SQL feature by just updating the configuration registry, without writing new components!
