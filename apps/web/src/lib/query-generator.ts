import type { Edge, Node } from "@xyflow/react";
import type { SqlNodeData } from "store/query-store";
import type {
  PredicateCondition,
  PredicateGroup,
} from "../components/config-fields/predicate-builder-field";

type DatabaseSchema = {
  dialect: string;
  database: string;
  tables: Array<{
    schema: string;
    name: string;
    columns: Array<{ name: string }>;
  }>;
};

/**
 * Build SQL for predicate conditions (WHERE/HAVING)
 */
function buildPredicateSQL(
  conditions: Array<PredicateCondition | PredicateGroup>
): string {
  if (conditions.length === 0) return "";

  const parts: string[] = [];

  for (const item of conditions) {
    if ("type" in item && item.type === "group") {
      // Handle group
      const groupSQL = buildPredicateSQL(item.conditions);
      if (groupSQL) {
        const prefix = item.parentLogicalOp
          ? `${item.parentLogicalOp} `
          : "";
        parts.push(`${prefix}(${groupSQL})`);
      }
    } else {
      // Handle condition
      const condition = item as PredicateCondition;
      if (!condition.column || !condition.operator) continue;

      const colName = `"${condition.column.split(".").pop() || condition.column}"`;
      let conditionSQL = "";

      if (
        condition.operator === "IS NULL" ||
        condition.operator === "IS NOT NULL"
      ) {
        conditionSQL = `${colName} ${condition.operator}`;
      } else if (condition.operator === "LIKE") {
        conditionSQL = `${colName} LIKE '${condition.value || ""}'`;
      } else if (condition.operator === "IN") {
        conditionSQL = `${colName} IN (${condition.value || ""})`;
      } else if (condition.operator === "BETWEEN") {
        const values = (condition.value || "").split(",");
        conditionSQL = `${colName} BETWEEN '${values[0] || ""}' AND '${values[1] || ""}'`;
      } else {
        conditionSQL = `${colName} ${condition.operator} '${condition.value || ""}'`;
      }

      const prefix = condition.logicalOp ? `${condition.logicalOp} ` : "";
      parts.push(`${prefix}${conditionSQL}`);
    }
  }

  return parts.join(" ");
}

export function generateSQL(
  nodes: Node<SqlNodeData>[],
  edges: Edge[],
  schema: DatabaseSchema | null
): string {
  if (nodes.length === 0) return "";

  // Find the SELECT node (start point)
  const selectNode = nodes.find(
    (n) => n.data.label === "SELECT" && n.data.kind === "clause"
  );

  if (!selectNode) {
    return "-- Add a SELECT node to start building your query";
  }

  // Build adjacency map for traversal
  const adjacencyMap = new Map<string, string[]>();
  edges.forEach((edge) => {
    const targets = adjacencyMap.get(edge.source) || [];
    targets.push(edge.target);
    adjacencyMap.set(edge.source, targets);
  });

  // Collect nodes in execution order by following edges
  const visitedNodes = new Set<string>();
  const orderedNodes: Node<SqlNodeData>[] = [];

  function traverse(nodeId: string) {
    if (visitedNodes.has(nodeId)) return;
    visitedNodes.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      orderedNodes.push(node);
    }

    const children = adjacencyMap.get(nodeId) || [];
    // Sort children by stage to maintain SQL clause order
    const sortedChildren = children
      .map((childId) => nodes.find((n) => n.id === childId))
      .filter((n): n is Node<SqlNodeData> => !!n)
      .sort((a, b) => (a.data.meta.stage || 0) - (b.data.meta.stage || 0));

    sortedChildren.forEach((child) => traverse(child.id));
  }

  traverse(selectNode.id);

  // Build SQL parts
  const sqlParts: Record<string, string> = {};

  // Get all available columns from schema for comparison
  const allAvailableColumns =
    schema?.tables.flatMap((table) =>
      table.columns.map((col) => `${table.schema}.${table.name}.${col.name}`)
    ) || [];

  for (const node of orderedNodes) {
    const { label, config } = node.data;

    switch (label) {
      case "SELECT": {
        const cols = config?.selectedColumns;
        // Use * if no columns selected OR if all available columns are selected
        if (
          !cols ||
          cols.length === 0 ||
          (allAvailableColumns.length > 0 &&
            cols.length === allAvailableColumns.length)
        ) {
          sqlParts.SELECT = "SELECT *";
          // Auto-detect FROM table from selected columns even when using *
          if (cols && cols.length > 0) {
            const firstCol = cols[0];
            const parts = firstCol.split(".");
            if (parts.length >= 3) {
              // Format: schema.table.column - use quoted table name
              const tableName = parts[1];
              sqlParts.FROM = `FROM "${tableName}"`;
            } else if (parts.length === 2) {
              // Format: table.column
              const tableName = parts[0];
              sqlParts.FROM = `FROM "${tableName}"`;
            }
          }
        } else {
          // Extract just column names (simplified, no table prefix)
          const colNames = cols.map((c) => {
            const parts = c.split(".");
            // Return just the column name (last part) with quotes for case sensitivity
            return `"${parts[parts.length - 1]}"`;
          });
          sqlParts.SELECT = `SELECT ${colNames.join(", ")}`;

          // Auto-detect FROM table from selected columns
          // Get table name from the first selected column
          if (cols.length > 0) {
            const firstCol = cols[0];
            const parts = firstCol.split(".");
            if (parts.length >= 3) {
              // Format: schema.table.column - use quoted table name
              const tableName = parts[1];
              sqlParts.FROM = `FROM "${tableName}"`;
            } else if (parts.length === 2) {
              // Format: table.column
              const tableName = parts[0];
              sqlParts.FROM = `FROM "${tableName}"`;
            }
          }
        }
        break;
      }

      case "DISTINCT":
        if (sqlParts.SELECT) {
          sqlParts.SELECT = sqlParts.SELECT.replace(
            "SELECT",
            "SELECT DISTINCT"
          );
        }
        break;

      case "FROM": {
        // Only use explicit FROM if no columns were selected in SELECT
        // (i.e., SELECT * case)
        if (!sqlParts.FROM) {
          const table = config?.selectedTable;
          if (table) {
            const parts = table.split(".");
            // Use just the table name (last part) with quotes for case sensitivity
            const tableName =
              parts.length >= 2 ? parts[parts.length - 1] : table;
            sqlParts.FROM = `FROM "${tableName}"`;
          }
        }
        break;
      }

      case "WHERE": {
        const conditions = config?.conditions || [];
        if (conditions.length > 0) {
          const whereClause = buildPredicateSQL(conditions);
          if (whereClause) {
            sqlParts.WHERE = `WHERE ${whereClause}`;
          }
        }
        break;
      }

      case "INNER JOIN":
      case "LEFT JOIN":
      case "RIGHT JOIN":
      case "FULL OUTER JOIN":
      case "JOIN": {
        const { joinTable, onColumn, onReferencedColumn } = config || {};
        if (joinTable) {
          const parts = joinTable.split(".");
          // Use just the table name (last part) with quotes for case sensitivity
          const tableName =
            parts.length >= 2 ? parts[parts.length - 1] : joinTable;

          let joinClause = `${label} "${tableName}"`;
          if (onColumn && onReferencedColumn) {
            // Use just column names (simplified) with quotes
            const col1 = `"${onColumn.split(".").pop() || onColumn}"`;
            const col2 = `"${
              onReferencedColumn.split(".").pop() || onReferencedColumn
            }"`;
            joinClause += ` ON ${col1} = ${col2}`;
          }
          sqlParts.JOIN = sqlParts.JOIN
            ? `${sqlParts.JOIN}\n  ${joinClause}`
            : joinClause;
        }
        break;
      }

      case "GROUP BY": {
        const cols = config?.groupColumns;
        if (cols && cols.length > 0) {
          const colNames = cols.map((c) => `"${c.split(".").pop() || c}"`);
          sqlParts.GROUP_BY = `GROUP BY ${colNames.join(", ")}`;
        }
        break;
      }

      case "HAVING": {
        const conditions = config?.conditions || [];
        if (conditions.length > 0) {
          const havingClause = buildPredicateSQL(conditions);
          if (havingClause) {
            sqlParts.HAVING = `HAVING ${havingClause}`;
          }
        }
        break;
      }

      case "ORDER BY": {
        const cols = config?.orderColumns;
        if (cols && cols.length > 0) {
          const orderParts = cols.map((o) => {
            const colName = `"${o.column.split(".").pop() || o.column}"`;
            return `${colName} ${o.direction}`;
          });
          sqlParts.ORDER_BY = `ORDER BY ${orderParts.join(", ")}`;
        }
        break;
      }

      case "LIMIT": {
        const limit = config?.limitValue;
        if (limit) {
          sqlParts.LIMIT = `LIMIT ${limit}`;
        }
        break;
      }

      case "OFFSET": {
        const offset = config?.offsetValue;
        if (offset) {
          sqlParts.OFFSET = `OFFSET ${offset}`;
        }
        break;
      }

      case "COUNT":
      case "SUM":
      case "AVG":
      case "MIN":
      case "MAX": {
        const col = config?.aggregateColumn;
        const alias = config?.alias;
        if (col) {
          const colName = `"${col.split(".").pop() || col}"`;
          const aggFunc = `${label}(${colName})${alias ? ` AS ${alias}` : ""}`;
          // Add to SELECT if present
          if (sqlParts.SELECT) {
            if (sqlParts.SELECT === "SELECT *") {
              sqlParts.SELECT = `SELECT ${aggFunc}`;
            } else {
              sqlParts.SELECT += `, ${aggFunc}`;
            }
          }
        }
        break;
      }
    }
  }

  // Assemble SQL in correct order
  const orderedParts = [
    sqlParts.SELECT,
    sqlParts.FROM,
    sqlParts.JOIN,
    sqlParts.WHERE,
    sqlParts.GROUP_BY,
    sqlParts.HAVING,
    sqlParts.ORDER_BY,
    sqlParts.LIMIT,
    sqlParts.OFFSET,
  ].filter(Boolean);

  return orderedParts.join("\n");
}
