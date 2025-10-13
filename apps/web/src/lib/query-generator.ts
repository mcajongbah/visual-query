  import type { Edge, Node } from "@xyflow/react";
import type { SqlNodeData } from "store/query-store";

type DatabaseSchema = {
  dialect: string;
  database: string;
  tables: Array<{
    schema: string;
    name: string;
    columns: Array<{ name: string }>;
  }>;
};

export function generateSQL(
  nodes: Node<SqlNodeData>[],
  edges: Edge[],
  _schema: DatabaseSchema | null // eslint-disable-line @typescript-eslint/no-unused-vars
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

  for (const node of orderedNodes) {
    const { label, config } = node.data;

    switch (label) {
      case "SELECT": {
        const cols = config?.selectedColumns;
        if (!cols || cols.length === 0) {
          sqlParts.SELECT = "SELECT *";
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
        const { column, operator, value } = config || {};
        if (column && operator) {
          // Use just the column name (last part) with quotes
          const colName = `"${column.split(".").pop() || column}"`;
          let condition = "";
          if (operator === "IS NULL" || operator === "IS NOT NULL") {
            condition = `${colName} ${operator}`;
          } else if (operator === "LIKE") {
            condition = `${colName} LIKE '${value || ""}'`;
          } else if (operator === "IN") {
            condition = `${colName} IN (${value || ""})`;
          } else {
            condition = `${colName} ${operator} '${value || ""}'`;
          }
          sqlParts.WHERE = sqlParts.WHERE
            ? `${sqlParts.WHERE} AND ${condition}`
            : `WHERE ${condition}`;
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
        const { column, operator, value } = config || {};
        if (column && operator) {
          const colName = `"${column.split(".").pop() || column}"`;
          const condition = `${colName} ${operator} ${value || "?"}`;
          sqlParts.HAVING = `HAVING ${condition}`;
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
