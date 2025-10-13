import { getSchema } from "@/utils/schema-introspection";
import { Hono } from "hono";
import mysql from "mysql2/promise";
import { Client as PgClient } from "pg";

const app = new Hono();

// TODO: Store active connections (in production, use a proper session store)
const connections = new Map<
  string,
  { dialect: string; connectionString: string }
>();

// Health check
app.get("/", (c) => {
  return c.json({ status: "ok", message: "SQL Query Builder API" });
});

// Test connection and get schema
app.post("/connect", async (c) => {
  try {
    const { dialect, connectionString } = await c.req.json();

    if (!dialect || !connectionString) {
      return c.json({ error: "Missing dialect or connectionString" }, 400);
    }

    // Test connection
    if (dialect === "postgres") {
      const client = new PgClient({ connectionString });
      await client.connect();
      await client.end();
    } else if (dialect === "mysql") {
      const conn = await mysql.createConnection({ uri: connectionString });
      await conn.end();
    } else {
      return c.json({ error: "Invalid dialect" }, 400);
    }

    // Generate a session ID
    const sessionId = Math.random().toString(36).substring(7);
    connections.set(sessionId, { dialect, connectionString });

    return c.json({ sessionId, status: "connected" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return c.json({ error: message }, 500);
  }
});

// Get database schema
app.post("/schema", async (c) => {
  try {
    const { sessionId } = await c.req.json();

    if (!sessionId || !connections.has(sessionId)) {
      return c.json({ error: "Invalid or expired session" }, 401);
    }

    const { dialect, connectionString } = connections.get(sessionId)!;

    // Import the getSchema function
    const schema = await getSchema(
      dialect as "postgres" | "mysql",
      connectionString
    );

    return c.json(schema);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Schema fetch failed";
    return c.json({ error: message }, 500);
  }
});

// Execute query
app.post("/query", async (c) => {
  try {
    const { sessionId, sql } = await c.req.json();

    if (!sessionId || !connections.has(sessionId)) {
      return c.json({ error: "Invalid or expired session" }, 401);
    }

    if (!sql) {
      return c.json({ error: "Missing SQL query" }, 400);
    }

    const { dialect, connectionString } = connections.get(sessionId)!;
    const startTime = performance.now();

    let results;

    if (dialect === "postgres") {
      const client = new PgClient({ connectionString });
      await client.connect();
      const result = await client.query(sql);
      await client.end();

      const columns =
        result.fields?.map((field) => ({
          id: field.name,
          header: field.name,
          dataType: field.dataTypeID ? String(field.dataTypeID) : undefined,
        })) || [];

      results = {
        columns,
        rows: result.rows || [],
        rowCount: result.rows?.length || 0,
        executionTime: performance.now() - startTime,
      };
    } else {
      const conn = await mysql.createConnection({ uri: connectionString });
      const [rows, fields] = await conn.query(sql);
      await conn.end();

      const columns =
        fields?.map((field) => ({
          id: field.name,
          header: field.name,
          dataType: field.type ? String(field.type) : undefined,
        })) || [];

      const rowData = Array.isArray(rows) ? rows : [];
      results = {
        columns,
        rows: rowData,
        rowCount: rowData.length,
        executionTime: performance.now() - startTime,
      };
    }

    return c.json(results);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Query execution failed";
    return c.json({ error: message }, 500);
  }
});

// Disconnect
app.post("/disconnect", async (c) => {
  try {
    const { sessionId } = await c.req.json();

    if (sessionId && connections.has(sessionId)) {
      connections.delete(sessionId);
    }

    return c.json({ status: "disconnected" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Disconnect failed";
    return c.json({ error: message }, 500);
  }
});

export default app;
