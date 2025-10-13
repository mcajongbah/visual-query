import type { Node } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";
import { allowedEdge } from "../constants/keywords";
import { executeQuery } from "../lib/query-executor";
import { generateSQL } from "../lib/query-generator";
import { useQueryStore, type SqlNodeData } from "store/query-store";
import { nodeTypes } from "./nodes";

function QueryCanvasInner() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    connectionInfo,
    schema,
    setGeneratedSQL,
    setQueryResults,
    setQueryError,
    setIsExecuting,
  } = useQueryStore();

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      const updatedNodes = applyNodeChanges(
        changes,
        nodes
      ) as Node<SqlNodeData>[];
      setNodes(updatedNodes);
    },
    [nodes, setNodes]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      const updatedEdges = applyEdgeChanges(changes, edges);
      setEdges(updatedEdges);
    },
    [edges, setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      // Validate edge connection
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;

      const isAllowed = allowedEdge(
        {
          value: sourceNode.data.label,
          kind: sourceNode.data.kind,
          stage: sourceNode.data.meta.stage,
        },
        {
          value: targetNode.data.label,
          kind: targetNode.data.kind,
          stage: targetNode.data.meta.stage,
        }
      );

      if (!isAllowed) {
        setQueryError(
          `Cannot connect ${sourceNode.data.label} to ${targetNode.data.label}. Invalid edge based on SQL semantics.`
        );
        setTimeout(() => setQueryError(null), 3000);
        return;
      }

      setEdges(addEdge(connection, edges));
    },
    [nodes, edges, setEdges, setQueryError]
  );

  // Auto-generate and execute query when nodes/edges change
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (nodes.length === 0) {
        setGeneratedSQL("");
        setQueryResults(null);
        setQueryError(null);
        return;
      }

      try {
        // Generate SQL
        const sql = generateSQL(nodes, edges, schema);
        setGeneratedSQL(sql);

        // Execute if valid SQL and we have a session
        if (sql && connectionInfo?.sessionId) {
          setIsExecuting(true);
          setQueryError(null);
          const results = await executeQuery(sql);
          setQueryResults(results);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to generate/execute query";
        setQueryError(message);
        setQueryResults(null);
      } finally {
        setIsExecuting(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [
    nodes,
    edges,
    schema,
    connectionInfo,
    setGeneratedSQL,
    setQueryResults,
    setQueryError,
    setIsExecuting,
  ]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export default function QueryCanvas() {
  return (
    <ReactFlowProvider>
      <QueryCanvasInner />
    </ReactFlowProvider>
  );
}
