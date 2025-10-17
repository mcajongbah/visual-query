import type { Edge, Node } from "@xyflow/react";
import { create } from "zustand";
import type { SqlKeywordMeta } from "../src/constants/keywords";
import { getNodeConfig } from "../src/lib/node-configs";
import { executeNodeEffects } from "../src/lib/node-effects";

type Dialect = "postgres" | "mysql";

type Column = {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  ordinalPosition: number;
};

type PrimaryKey = {
  name: string | null;
  columns: string[];
};

type ForeignKey = {
  name: string | null;
  columns: string[];
  referencedTable: string;
  referencedSchema?: string;
  referencedColumns: string[];
  onDelete?: string | null;
  onUpdate?: string | null;
};

type Index = {
  name: string;
  columns: string[];
  isUnique: boolean;
  definition?: string | null;
};

type Table = {
  schema: string;
  name: string;
  columns: Column[];
  primaryKey?: PrimaryKey | null;
  foreignKeys: ForeignKey[];
  indexes: Index[];
};

type DatabaseSchema = {
  dialect: Dialect;
  database: string;
  tables: Table[];
};

type ConnectionInfo = {
  dialect: Dialect;
  connectionString: string;
  isConnected: boolean;
  sessionId?: string; // Backend session ID
};

type QueryResults = {
  columns: { id: string; header: string; dataType?: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
};

export type SqlNodeData = {
  label: string;
  kind: SqlKeywordMeta["kind"];
  meta: SqlKeywordMeta;
  config?: {
    // For SELECT: selected columns
    selectedColumns?: string[];
    // For FROM: selected table
    selectedTable?: string;
    // For WHERE/HAVING: condition
    column?: string;
    operator?: string;
    value?: string;
    // For JOIN: table and condition
    joinTable?: string;
    onColumn?: string;
    onReferencedColumn?: string;
    // For aggregate functions
    aggregateColumn?: string;
    alias?: string;
    // For ORDER BY
    orderColumns?: Array<{ column: string; direction: "ASC" | "DESC" }>;
    // For GROUP BY
    groupColumns?: string[];
    // For LIMIT
    limitValue?: number;
    offsetValue?: number;
  };
};

type QueryStore = {
  // Connection state
  connectionInfo: ConnectionInfo | null;
  schema: DatabaseSchema | null;
  connectionError: string | null;

  // Canvas state
  nodes: Node<SqlNodeData>[];
  edges: Edge[];

  // Query state
  generatedSQL: string;
  queryResults: QueryResults | null;
  queryError: string | null;
  isExecuting: boolean;

  // Actions
  setConnection: (info: ConnectionInfo, schema: DatabaseSchema) => void;
  disconnect: () => void;
  setConnectionError: (error: string | null) => void;

  setNodes: (nodes: Node<SqlNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (
    keyword: SqlKeywordMeta,
    position: { x: number; y: number }
  ) => void;
  updateNodeData: (nodeId: string, config: SqlNodeData["config"]) => void;
  removeNode: (nodeId: string) => void;

  setGeneratedSQL: (sql: string) => void;
  setQueryResults: (results: QueryResults | null) => void;
  setQueryError: (error: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
};

let nodeIdCounter = 0;

export const useQueryStore = create<QueryStore>((set) => ({
  // Initial state
  connectionInfo: null,
  schema: null,
  connectionError: null,

  nodes: [],
  edges: [],

  generatedSQL: "",
  queryResults: null,
  queryError: null,
  isExecuting: false,

  // Actions
  setConnection: (info, schema) =>
    set({
      connectionInfo: info,
      schema,
      connectionError: null,
    }),

  disconnect: () =>
    set({
      connectionInfo: null,
      schema: null,
      nodes: [],
      edges: [],
      generatedSQL: "",
      queryResults: null,
      queryError: null,
      connectionError: null,
    }),

  setConnectionError: (error) => set({ connectionError: error }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (keyword, position) =>
    set((state) => {
      // Get node config to determine archetype
      const config = getNodeConfig(keyword.value);

      // Map to archetype-based node type
      let nodeType = keyword.kind;
      if (config?.archetype === "predicate") {
        nodeType = "predicate" as SqlKeywordMeta["kind"];
      } else if (config?.archetype === "relation") {
        nodeType = "relation" as SqlKeywordMeta["kind"];
      } else if (config?.archetype === "clause") {
        nodeType = "configurable-clause" as SqlKeywordMeta["kind"];
      } else if (config?.archetype === "simple") {
        nodeType = "configurable-clause" as SqlKeywordMeta["kind"];
      } else {
        // Fallback to old mapping for keywords without config
        if (keyword.value === "SELECT")
          nodeType = "configurable-clause" as SqlKeywordMeta["kind"];
        else if (keyword.value === "FROM")
          nodeType = "configurable-clause" as SqlKeywordMeta["kind"];
        else if (keyword.value === "WHERE")
          nodeType = "predicate" as SqlKeywordMeta["kind"];
        else if (keyword.value === "HAVING")
          nodeType = "predicate" as SqlKeywordMeta["kind"];
        else if (keyword.value === "ORDER BY")
          nodeType = "configurable-clause" as SqlKeywordMeta["kind"];
        else if (keyword.value.includes("JOIN"))
          nodeType = "relation" as SqlKeywordMeta["kind"];
      }

      // Initialize config with default values from field configs
      let initialConfig: SqlNodeData["config"] = {};
      if (config?.fields) {
        for (const field of config.fields) {
          if (field.defaultValue !== undefined) {
            initialConfig[field.key] = field.defaultValue;
          }
        }
      }

      const newNode: Node<SqlNodeData> = {
        id: `node-${++nodeIdCounter}`,
        type: nodeType,
        position,
        data: {
          label: keyword.value,
          kind: keyword.kind,
          meta: keyword,
          config: initialConfig,
        },
      };
      return { nodes: [...state.nodes, newNode] };
    }),

  updateNodeData: (nodeId, config) =>
    set((state) => {
      // Update the target node
      let updatedNodes = state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config: { ...node.data.config, ...config },
              },
            }
          : node
      );

      // Execute cascading effects for each changed config key
      const triggerNode = updatedNodes.find((n) => n.id === nodeId);
      if (triggerNode) {
        for (const changedKey of Object.keys(config)) {
          const result = executeNodeEffects(triggerNode, changedKey, {
            nodes: updatedNodes,
            edges: state.edges,
            schema: state.schema,
            triggerNodeId: nodeId,
            changedConfig: config,
          });

          if (result.shouldRegenerate) {
            updatedNodes = result.updatedNodes;
          }
        }
      }

      return { nodes: updatedNodes };
    }),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      ),
    })),

  setGeneratedSQL: (sql) => set({ generatedSQL: sql }),
  setQueryResults: (results) => set({ queryResults: results }),
  setQueryError: (error) => set({ queryError: error }),
  setIsExecuting: (isExecuting) => set({ isExecuting }),
}));
