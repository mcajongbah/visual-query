import { FromNode } from "./from-node";
import { JoinNode } from "./join-node";
import { OrderByNode } from "./order-by-node";
import { SelectNode } from "./select-node";
import { SqlNode } from "./sql-node";
import { WhereNode } from "./where-node";

// Map node kinds to their custom components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: any = {
  // Main clause nodes
  clause: SqlNode,
  // Specific custom implementations
  select: SelectNode,
  from: FromNode,
  where: WhereNode,
  orderby: OrderByNode,
  // Join nodes
  join: JoinNode,
  // Generic fallback for other kinds
  operator: SqlNode,
  aggregate: SqlNode,
  modifier: SqlNode,
  "set-op": SqlNode,
  pager: SqlNode,
  literal: SqlNode,
  "order-by": SqlNode,
};
