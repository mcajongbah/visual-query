import type { Node, Edge } from "@xyflow/react";
import type { SqlNodeData } from "store/query-store";
import { nodeConfigRegistry, type NodeEffect } from "./node-configs";

/**
 * Context for effect execution
 */
export interface EffectContext {
  nodes: Node<SqlNodeData>[];
  edges: Edge[];
  schema: any;
  triggerNodeId: string;
  changedConfig: Record<string, any>;
}

/**
 * Result of effect execution
 */
export interface EffectResult {
  updatedNodes: Node<SqlNodeData>[];
  shouldRegenerate: boolean;
}

/**
 * Execute cascading effects when a node's config changes
 */
export function executeNodeEffects(
  triggerNode: Node<SqlNodeData>,
  changedConfigKey: string,
  context: EffectContext
): EffectResult {
  const config = nodeConfigRegistry[triggerNode.data.label];
  if (!config?.effects) {
    return { updatedNodes: context.nodes, shouldRegenerate: false };
  }

  let updatedNodes = [...context.nodes];
  let hasChanges = false;

  // Find relevant effects
  const relevantEffects = config.effects.filter(
    (effect) =>
      effect.trigger.nodeValue === triggerNode.data.label &&
      effect.trigger.configKey === changedConfigKey
  );

  // Execute each effect
  for (const effect of relevantEffects) {
    for (const target of effect.targets) {
      // Find target nodes
      const targetNodes = updatedNodes.filter((node) =>
        target.targetNodeValues.includes(node.data.label)
      );

      for (const targetNode of targetNodes) {
        const updatedNode = applyEffect(
          triggerNode,
          targetNode,
          target,
          context
        );
        if (updatedNode) {
          updatedNodes = updatedNodes.map((n) =>
            n.id === updatedNode.id ? updatedNode : n
          );
          hasChanges = true;
        }
      }
    }
  }

  return { updatedNodes, shouldRegenerate: hasChanges };
}

/**
 * Apply a single effect to a target node
 */
function applyEffect(
  triggerNode: Node<SqlNodeData>,
  targetNode: Node<SqlNodeData>,
  target: NodeEffect["targets"][0],
  context: EffectContext
): Node<SqlNodeData> | null {
  const { action, configKey, newValue, customHandler } = target;

  switch (action) {
    case "reset":
      if (configKey) {
        const valueToSet =
          typeof newValue === "function"
            ? newValue(targetNode.data.config?.[configKey], context)
            : newValue;

        return {
          ...targetNode,
          data: {
            ...targetNode.data,
            config: {
              ...targetNode.data.config,
              [configKey]: valueToSet,
            },
          },
        };
      }
      break;

    case "update":
      if (configKey && newValue !== undefined) {
        const valueToSet =
          typeof newValue === "function"
            ? newValue(targetNode.data.config?.[configKey], context)
            : newValue;

        return {
          ...targetNode,
          data: {
            ...targetNode.data,
            config: {
              ...targetNode.data.config,
              [configKey]: valueToSet,
            },
          },
        };
      }
      break;

    case "validate":
      // Validation is handled separately by the validation engine
      // This just marks that validation should be re-run
      return targetNode;

    case "custom":
      if (customHandler) {
        const updates = customHandler(triggerNode, targetNode, context);
        return {
          ...targetNode,
          data: {
            ...targetNode.data,
            config: {
              ...targetNode.data.config,
              ...updates,
            },
          },
        };
      }
      break;
  }

  return null;
}

/**
 * Get available columns based on FROM and JOIN nodes connected to the target
 */
export function getColumnsFromContext(
  targetNodeId: string,
  nodes: Node<SqlNodeData>[],
  edges: Edge[],
  schema: any
): Array<{ label: string; value: string; tableName: string }> {
  // Build graph to find upstream FROM/JOIN nodes
  const upstreamNodes = getUpstreamNodes(targetNodeId, nodes, edges);

  // Extract tables from FROM and JOIN nodes
  const tables: Set<string> = new Set();

  for (const node of upstreamNodes) {
    if (node.data.label === "FROM") {
      const table = node.data.config?.selectedTable;
      if (table) tables.add(table);
    } else if (node.data.label.includes("JOIN")) {
      const joinTable = node.data.config?.joinTable;
      if (joinTable) tables.add(joinTable);
    }
  }

  // Get columns from these tables
  const columns: Array<{ label: string; value: string; tableName: string }> =
    [];

  for (const tableFullPath of tables) {
    const tableParts = tableFullPath.split(".");
    const schemaName = tableParts[0];
    const tableName = tableParts[1] || tableParts[0];

    const tableInfo = schema?.tables?.find(
      (t: any) =>
        t.name === tableName &&
        (schemaName ? t.schema === schemaName : true)
    );

    if (tableInfo) {
      for (const col of tableInfo.columns) {
        columns.push({
          label: col.name,
          value: `${tableInfo.schema}.${tableInfo.name}.${col.name}`,
          tableName: tableInfo.name,
        });
      }
    }
  }

  return columns;
}

/**
 * Get all upstream nodes (nodes that feed into the target)
 */
function getUpstreamNodes(
  targetNodeId: string,
  nodes: Node<SqlNodeData>[],
  edges: Edge[]
): Node<SqlNodeData>[] {
  const upstream: Node<SqlNodeData>[] = [];
  const visited = new Set<string>();

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Find edges that target this node
    const incomingEdges = edges.filter((e) => e.target === nodeId);

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode) {
        upstream.push(sourceNode);
        traverse(sourceNode.id);
      }
    }
  }

  traverse(targetNodeId);
  return upstream;
}

/**
 * Get all tables from schema
 */
export function getTablesFromSchema(
  schema: any
): Array<{ label: string; value: string }> {
  if (!schema?.tables) return [];

  return schema.tables.map((t: any) => ({
    label: t.name,
    value: `${t.schema}.${t.name}`,
  }));
}

/**
 * Check if a node has any validation errors
 */
export function hasValidationErrors(
  node: Node<SqlNodeData>,
  context: EffectContext
): boolean {
  const config = nodeConfigRegistry[node.data.label];
  if (!config?.fields) return false;

  for (const field of config.fields) {
    if (field.validators) {
      const value = node.data.config?.[field.key];
      for (const validator of field.validators) {
        if (validator.type === "required" && !value) {
          return true;
        }
        if (validator.type === "min" && typeof value === "number") {
          if (value < (validator.value || 0)) return true;
        }
        if (validator.type === "max" && typeof value === "number") {
          if (value > (validator.value || Infinity)) return true;
        }
        if (validator.validate) {
          if (!validator.validate(value, node.data.config, context)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Get all downstream nodes (nodes that depend on the source)
 */
export function getDownstreamNodes(
  sourceNodeId: string,
  nodes: Node<SqlNodeData>[],
  edges: Edge[]
): Node<SqlNodeData>[] {
  const downstream: Node<SqlNodeData>[] = [];
  const visited = new Set<string>();

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    // Find edges that originate from this node
    const outgoingEdges = edges.filter((e) => e.source === nodeId);

    for (const edge of outgoingEdges) {
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (targetNode) {
        downstream.push(targetNode);
        traverse(targetNode.id);
      }
    }
  }

  traverse(sourceNodeId);
  return downstream;
}

/**
 * Get operators based on context
 */
export function getOperators(context?: "comparison" | "logical"): string[] {
  if (context === "logical") {
    return ["AND", "OR", "NOT"];
  }

  return [
    "=",
    "<>",
    "!=",
    ">",
    "<",
    ">=",
    "<=",
    "LIKE",
    "IN",
    "BETWEEN",
    "IS NULL",
    "IS NOT NULL",
  ];
}
