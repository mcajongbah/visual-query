import { DatabaseIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useQueryStore } from "store/query-store";
import { sqlKeywords } from "../constants/keywords";
import { connectToDatabase } from "../lib/api-client";
import { Button } from "./ui/button";

type InputMode = "connection-string" | "individual";

export default function ConnectionModal() {
  const [dialect, setDialect] = useState<"postgres" | "mysql">("postgres");
  const [inputMode, setInputMode] = useState<InputMode>("connection-string");
  const [isConnecting, setIsConnecting] = useState(false);

  // Connection string mode
  const [connectionString, setConnectionString] = useState("");

  // Individual fields mode
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const {
    setConnection,
    setConnectionError,
    connectionError,
    addNode,
    setEdges,
  } = useQueryStore();

  const handleDialectChange = (newDialect: "postgres" | "mysql") => {
    setDialect(newDialect);
    // Update default port
    if (newDialect === "postgres") {
      setPort("5432");
    } else {
      setPort("3306");
    }
  };

  const buildConnectionString = () => {
    if (inputMode === "connection-string") {
      return connectionString;
    }

    // Build from individual fields
    if (dialect === "postgres") {
      return `postgresql://${username}:${password}@${host}:${port}/${database}`;
    } else {
      return `mysql://${username}:${password}@${host}:${port}/${database}`;
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const connString = buildConnectionString();
      const result = await connectToDatabase({
        dialect,
        connectionString: connString,
      });

      setConnection(
        {
          dialect,
          connectionString: connString,
          isConnected: true,
          sessionId: result.sessionId,
        },
        result.schema
      );

      // Add default SELECT and FROM nodes
      const selectKeyword = sqlKeywords["Retrieving Data"].find(
        (k) => k.value === "SELECT"
      );
      const fromKeyword = sqlKeywords["Retrieving Data"].find(
        (k) => k.value === "FROM"
      );

      if (selectKeyword && fromKeyword && result.schema.tables.length > 0) {
        const firstTable = result.schema.tables[0];

        // Get all columns from first table
        const allColumns = firstTable.columns.map(
          (col) => `${firstTable.schema}.${firstTable.name}.${col.name}`
        );

        // Add SELECT node at position (100, 100)
        addNode(selectKeyword, { x: 100, y: 100 });

        // Add FROM node at position (400, 100)
        addNode(fromKeyword, { x: 400, y: 100 });

        // Wait a tick for nodes to be added to store
        setTimeout(() => {
          // Get the store state to access the newly added nodes
          const state = useQueryStore.getState();
          const nodes = state.nodes;

          if (nodes.length >= 2) {
            const selectNode = nodes[0];
            const fromNode = nodes[1];

            // Configure SELECT node with all columns
            state.updateNodeData(selectNode.id, {
              selectedColumns: allColumns,
            });

            // Configure FROM node with first table
            state.updateNodeData(fromNode.id, {
              selectedTable: `${firstTable.schema}.${firstTable.name}`,
            });

            // Connect the nodes
            setEdges([
              {
                id: `${selectNode.id}-${fromNode.id}`,
                source: selectNode.id,
                target: fromNode.id,
              },
            ]);
          }
        }, 0);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to connect to database";
      setConnectionError(message);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <DatabaseIcon className="size-6" />
          <div>
            <h2 className="text-xl font-semibold">Connect to Database</h2>
            <p className="text-sm text-muted-foreground">
              Connect to start building your query
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Dialect selector */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Database Type
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={dialect === "postgres" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleDialectChange("postgres")}
              >
                PostgreSQL
              </Button>
              <Button
                type="button"
                variant={dialect === "mysql" ? "default" : "outline"}
                className="flex-1"
                onClick={() => handleDialectChange("mysql")}
              >
                MySQL
              </Button>
            </div>
          </div>

          {/* Input mode toggle */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Connection Mode
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={
                  inputMode === "connection-string" ? "default" : "outline"
                }
                className="flex-1"
                size="sm"
                onClick={() => setInputMode("connection-string")}
              >
                Connection String
              </Button>
              <Button
                type="button"
                variant={inputMode === "individual" ? "default" : "outline"}
                className="flex-1"
                size="sm"
                onClick={() => setInputMode("individual")}
              >
                Individual Fields
              </Button>
            </div>
          </div>

          {/* Connection string input */}
          {inputMode === "connection-string" && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                Connection String
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded-md text-sm"
                placeholder={
                  dialect === "postgres"
                    ? "postgresql://user:password@localhost:5432/database"
                    : "mysql://user:password@localhost:3306/database"
                }
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
              />
            </div>
          )}

          {/* Individual fields */}
          {inputMode === "individual" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Host</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Port</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Database
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Username
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {connectionError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
              <p className="text-sm text-destructive">{connectionError}</p>
            </div>
          )}

          {/* Connect button */}
          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2Icon className="size-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
