export type SqlNodeKind =
  | "clause" // SELECT, FROM, WHERE, GROUP BY, HAVING, WINDOW, ORDER BY, LIMIT/OFFSET
  | "join" // INNER/LEFT/RIGHT/FULL
  | "operator" // =, <>, >, <, BETWEEN, IN, LIKE, AND, OR, NOT, IS NULL
  | "aggregate" // COUNT, SUM, AVG, MIN, MAX
  | "modifier" // DISTINCT, TOP
  | "set-op" // UNION, UNION ALL (between full queries)
  | "pager" // LIMIT/OFFSET, FETCH/NEXT
  | "literal" // constants, column refs, expressions (optional)
  | "order-by"; // ORDER BY

export type Cardinality = "0..1" | "0..N" | "1" | "0..*" | "1..N";

export interface SqlKeywordMeta {
  id: number;
  value: string; // label
  tooltip: string;
  icon: string; // lucide-react name (kebab-case)
  kind: SqlNodeKind;
  stage?: number; // relative clause order for SELECT pipeline (lower = earlier)
  cardinality?: Cardinality;
  canStart?: boolean; // can this be the first clause of a query pipeline?
  allowedNextKinds?: SqlNodeKind[]; // which kinds may follow this node in a pipeline
  allowedParentKinds?: SqlNodeKind[]; // where this node may appear as a child (for operators/functions)
  requires?: Array<
    | { anyOf: string[] } // any of these values/kinds must exist upstream
    | { allOf: string[] } // all must exist upstream
  >;
  notes?: string;
}

export const sqlKeywords: Record<string, SqlKeywordMeta[]> = {
  "Retrieving Data": [
    {
      id: 1,
      value: "SELECT",
      tooltip: "Choose which columns/expressions to return.",
      icon: "mouse-pointer",
      kind: "clause",
      stage: 10,
      cardinality: "1",
      canStart: true,
      allowedNextKinds: ["modifier", "clause", "join", "pager", "set-op"],
      notes:
        "Start of a query pipeline. Projection depends on FROM unless selecting literals.",
    },
    {
      id: 4,
      value: "DISTINCT",
      tooltip: "Remove duplicate rows from the result.",
      icon: "sparkles",
      kind: "modifier",
      stage: 11,
      cardinality: "0..1",
      allowedParentKinds: ["clause"], // inside SELECT
      notes: "Modifier of SELECT; appears syntactically as SELECT DISTINCT ...",
    },
    {
      id: 2,
      value: "FROM",
      tooltip: "Source tables or subqueries.",
      icon: "table",
      kind: "clause",
      stage: 20,
      cardinality: "0..1",
      allowedNextKinds: ["join", "clause", "pager", "set-op"],
      requires: [{ anyOf: ["SELECT"] }],
      notes: "Optional if selecting literals; otherwise typical.",
    },
    {
      id: 3,
      value: "WHERE",
      tooltip: "Filter rows before grouping.",
      icon: "filter",
      kind: "clause",
      stage: 30,
      cardinality: "0..1",
      allowedNextKinds: ["clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM", "JOIN"] }],
      notes: "Contains a predicate tree using operators and expressions.",
    },
    {
      id: 8,
      value: "GROUP BY",
      tooltip: "Aggregate rows with same grouping expressions.",
      icon: "columns-3",
      kind: "clause",
      stage: 40,
      cardinality: "0..1",
      allowedNextKinds: ["clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM", "JOIN"] }],
      notes: "Non-aggregated select items must be listed in GROUP BY.",
    },
    {
      id: 9,
      value: "HAVING",
      tooltip: "Filter groups after aggregation.",
      icon: "list-checks",
      kind: "clause",
      stage: 50,
      cardinality: "0..1",
      allowedNextKinds: ["clause", "pager", "set-op"],
      requires: [{ anyOf: ["GROUP BY", "AggregatePresent"] }],
      notes: "Allow if grouped OR select list has aggregates.",
    },
    {
      id: 100,
      value: "WINDOW",
      tooltip: "Define named windows for OVER().",
      icon: "app-window",
      kind: "clause",
      stage: 55,
      cardinality: "0..1",
      allowedNextKinds: ["clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM", "JOIN"] }],
      notes: "Optional; window functions computed before ORDER BY.",
    },
    {
      id: 7,
      value: "ORDER BY",
      tooltip: "Sort final result set.",
      icon: "arrow-up-down",
      kind: "clause",
      stage: 60,
      cardinality: "0..1",
      allowedNextKinds: ["pager", "set-op"],
      notes: "Can reference select-list aliases (dialect rules apply).",
    },
    {
      id: 5,
      value: "LIMIT",
      tooltip: "Restrict row count (Postgres/MySQL/SQLite).",
      icon: "crop",
      kind: "pager",
      stage: 70,
      cardinality: "0..1",
      allowedNextKinds: ["set-op"],
      notes: "Paging terminal for many dialects. Pair with OFFSET optionally.",
    },
    {
      id: 6,
      value: "TOP",
      tooltip: "Return first N rows (SQL Server).",
      icon: "crop",
      kind: "modifier",
      stage: 12,
      cardinality: "0..1",
      allowedParentKinds: ["clause"], // inside SELECT HEAD
      notes: "SQL Server alternative to LIMIT/FETCH.",
    },
  ],

  "Combining Data": [
    {
      id: 10,
      value: "JOIN",
      tooltip: "Generic join (use specific type).",
      icon: "link",
      kind: "join",
      stage: 21,
      cardinality: "0..N",
      allowedParentKinds: ["clause", "join"], // attaches after FROM or prior JOIN
      allowedNextKinds: ["join", "clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM"] }],
      notes: "Typically needs an ON condition unless CROSS/NATURAL.",
    },
    {
      id: 11,
      value: "INNER JOIN",
      tooltip: "Rows matching on ON condition.",
      icon: "git-merge",
      kind: "join",
      stage: 21,
      cardinality: "0..N",
      allowedParentKinds: ["clause", "join"],
      allowedNextKinds: ["join", "clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM"] }],
    },
    {
      id: 12,
      value: "LEFT JOIN",
      tooltip: "All left rows, matched right.",
      icon: "panel-left",
      kind: "join",
      stage: 21,
      cardinality: "0..N",
      allowedParentKinds: ["clause", "join"],
      allowedNextKinds: ["join", "clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM"] }],
    },
    {
      id: 13,
      value: "RIGHT JOIN",
      tooltip: "All right rows, matched left.",
      icon: "panel-right",
      kind: "join",
      stage: 21,
      cardinality: "0..N",
      allowedParentKinds: ["clause", "join"],
      allowedNextKinds: ["join", "clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM"] }],
    },
    {
      id: 14,
      value: "FULL OUTER JOIN",
      tooltip: "All rows both sides.",
      icon: "layers",
      kind: "join",
      stage: 21,
      cardinality: "0..N",
      allowedParentKinds: ["clause", "join"],
      allowedNextKinds: ["join", "clause", "pager", "set-op"],
      requires: [{ anyOf: ["FROM"] }],
    },
    {
      id: 15,
      value: "ON",
      tooltip: "Join condition.",
      icon: "link-2",
      kind: "operator", // treated as predicate context
      allowedParentKinds: ["join"], // specifically attaches to a Join node
      notes: "Predicate tree just like WHERE/HAVING. Use same operator set.",
    },
    {
      id: 16,
      value: "UNION",
      tooltip: "Combine results, remove duplicates.",
      icon: "layers",
      kind: "set-op",
      stage: 80,
      cardinality: "0..N",
      allowedParentKinds: [],
      allowedNextKinds: ["clause", "set-op", "order-by", "pager"],
      notes: "Connects FULL query outputs, not clause nodes.",
    },
    {
      id: 17,
      value: "UNION ALL",
      tooltip: "Combine results, keep duplicates.",
      icon: "layers",
      kind: "set-op",
      stage: 80,
      cardinality: "0..N",
      allowedParentKinds: [],
      allowedNextKinds: ["clause", "set-op", "order-by", "pager"],
    },
  ],

  "Aggregating and Calculating": [
    {
      id: 18,
      value: "COUNT",
      tooltip: "Count rows or non-NULLs.",
      icon: "calculator",
      kind: "aggregate",
      allowedParentKinds: ["clause"],
      notes:
        "If present, may require GROUP BY unless only aggregates are selected.",
    },
    {
      id: 19,
      value: "SUM",
      tooltip: "Sum numeric values.",
      icon: "sigma",
      kind: "aggregate",
      allowedParentKinds: ["clause"],
    },
    {
      id: 20,
      value: "AVG",
      tooltip: "Average of numeric values.",
      icon: "gauge",
      kind: "aggregate",
      allowedParentKinds: ["clause"],
    },
    {
      id: 21,
      value: "MIN",
      tooltip: "Smallest value.",
      icon: "arrow-down",
      kind: "aggregate",
      allowedParentKinds: ["clause"],
    },
    {
      id: 22,
      value: "MAX",
      tooltip: "Largest value.",
      icon: "arrow-up",
      kind: "aggregate",
      allowedParentKinds: ["clause"],
    },
    {
      id: 23,
      value: "AS",
      tooltip: "Alias column/expression.",
      icon: "tag",
      kind: "modifier",
      allowedParentKinds: ["clause"],
    },
  ],

  "Filtering Logic": [
    {
      id: 36,
      value: "AND",
      tooltip: "All conditions must be true.",
      icon: "ampersand",
      kind: "operator",
      allowedParentKinds: ["operator", "clause", "join"],
      notes: "Boolean connective in WHERE/HAVING/ON.",
    },
    {
      id: 37,
      value: "OR",
      tooltip: "Any condition may be true.",
      icon: "git-branch",
      kind: "operator",
      allowedParentKinds: ["operator", "clause", "join"],
    },
    {
      id: 38,
      value: "NOT",
      tooltip: "Negate a condition.",
      icon: "ban",
      kind: "operator",
      allowedParentKinds: ["operator", "clause", "join"],
    },

    {
      id: 24,
      value: "=",
      tooltip: "Equality comparison.",
      icon: "equal",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 25,
      value: "<>",
      tooltip: "Not equal (standard).",
      icon: "not-equal",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 26,
      value: "!=",
      tooltip: "Not equal (alt).",
      icon: "not-equal",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 27,
      value: ">",
      tooltip: "Greater-than.",
      icon: "greater-than",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 28,
      value: "<",
      tooltip: "Less-than.",
      icon: "less-than",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 29,
      value: ">=",
      tooltip: "Greater-or-equal.",
      icon: "greater-than",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 30,
      value: "<=",
      tooltip: "Less-or-equal.",
      icon: "less-than",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 31,
      value: "BETWEEN",
      tooltip: "Inclusive range test.",
      icon: "stretch-horizontal",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
      notes: "Two operands: lower and upper.",
    },
    {
      id: 32,
      value: "IN",
      tooltip: "Match any in list/subquery.",
      icon: "list",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 33,
      value: "LIKE",
      tooltip: "Pattern match with % and _.",
      icon: "regex",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 34,
      value: "IS NULL",
      tooltip: "Value is NULL.",
      icon: "circle-off",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
    {
      id: 35,
      value: "IS NOT NULL",
      tooltip: "Value is not NULL.",
      icon: "circle-slash-2",
      kind: "operator",
      allowedParentKinds: ["clause", "join", "operator"],
    },
  ],

  "Modifying and Managing Data": [
    // keep for completeness; typically disable in a SELECT query builder canvas
    {
      id: 39,
      value: "INSERT INTO",
      tooltip: "Add new rows.",
      icon: "plus-circle",
      kind: "clause",
    },
    {
      id: 40,
      value: "UPDATE",
      tooltip: "Modify rows.",
      icon: "edit-3",
      kind: "clause",
    },
    {
      id: 41,
      value: "DELETE",
      tooltip: "Remove rows.",
      icon: "trash-2",
      kind: "clause",
    },
    {
      id: 42,
      value: "CREATE TABLE",
      tooltip: "Define table.",
      icon: "table",
      kind: "clause",
    },
    {
      id: 43,
      value: "DROP TABLE",
      tooltip: "Remove table.",
      icon: "minus",
      kind: "clause",
    },
    {
      id: 44,
      value: "ALTER TABLE",
      tooltip: "Change schema.",
      icon: "wrench",
      kind: "clause",
    },
    {
      id: 45,
      value: "TRUNCATE",
      tooltip: "Delete all rows.",
      icon: "scissors",
      kind: "clause",
    },
  ],
};

type NodeRef = { value: string; kind: SqlNodeKind; stage?: number };

const KIND_GRAPH: Record<SqlNodeKind, SqlNodeKind[]> = {
  clause: ["join", "clause", "pager", "set-op", "modifier"], // SELECT → FROM/WHERE/...
  join: ["join", "clause", "pager", "set-op"], // FROM → JOIN* → WHERE/...
  operator: ["operator", "literal"], // predicates are trees
  aggregate: ["modifier", "operator", "literal"], // appears in SELECT exprs
  modifier: ["clause", "join", "pager", "set-op", "operator"], // DISTINCT, TOP, AS
  "set-op": ["clause", "set-op", "pager"], // UNION chains full queries
  pager: ["set-op"], // LIMIT/OFFSET → UNION (optional)
  literal: ["operator", "modifier"], // numbers, strings, columns
  "order-by": ["pager"], // ORDER BY → LIMIT/OFFSET
};

export function allowedEdge(from: NodeRef, to: NodeRef): boolean {
  const allowedKinds = KIND_GRAPH[from.kind] ?? [];
  if (!allowedKinds.includes(to.kind)) return false;

  // stage ordering for clauses/pager/set-op (ignore predicate internals)
  const staged =
    ["clause", "pager", "set-op"].includes(from.kind) ||
    ["clause", "pager", "set-op"].includes(to.kind);
  if (staged) {
    // allow same stage for modifiers like DISTINCT at SELECT head
    if (typeof from.stage === "number" && typeof to.stage === "number") {
      if (to.kind !== "modifier" && to.stage < from.stage) return false;
    }
  }
  return true;
}

export function checkRequires(
  node: SqlKeywordMeta,
  upstreamValues: Set<string>,
  context: { aggregatePresent: boolean }
): boolean {
  if (!node.requires) return true;
  return node.requires.every((rule) => {
    if ("anyOf" in rule) {
      return rule.anyOf.some((v) =>
        v === "AggregatePresent"
          ? context.aggregatePresent
          : upstreamValues.has(v)
      );
    }
    if ("allOf" in rule) {
      return rule.allOf.every((v) =>
        v === "AggregatePresent"
          ? context.aggregatePresent
          : upstreamValues.has(v)
      );
    }
    return true;
  });
}
