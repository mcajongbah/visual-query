import { ConfigurableClauseNode } from "./configurable-clause-node";
import { PredicateNode } from "./predicate-node";
import { RelationNode } from "./relation-node";
import { SqlNode } from "./sql-node";

// Legacy imports for backward compatibility
import { FromNode } from "./from-node";
import { JoinNode } from "./join-node";
import { OrderByNode } from "./order-by-node";
import { SelectNode } from "./select-node";
import { WhereNode } from "./where-node";

// Map node kinds to their custom components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: any = {
  // New dynamic archetype-based components
  "configurable-clause": ConfigurableClauseNode,
  predicate: PredicateNode,
  relation: RelationNode,

  // Legacy support for old nodes (gradually migrate away from these)
  clause: SqlNode,
  select: SelectNode,
  from: FromNode,
  where: WhereNode,
  orderby: OrderByNode,
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
