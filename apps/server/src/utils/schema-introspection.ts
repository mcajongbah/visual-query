/* eslint-disable @typescript-eslint/no-explicit-any */
import mysql from "mysql2/promise";
import { Client as PgClient } from "pg";

export type Dialect = "postgres" | "mysql";

export type Column = {
  name: string;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  ordinalPosition: number;
};

export type PrimaryKey = {
  name: string | null;
  columns: string[];
};

export type ForeignKey = {
  name: string | null;
  columns: string[];
  referencedTable: string;
  referencedSchema?: string;
  referencedColumns: string[];
  onDelete?: string | null;
  onUpdate?: string | null;
};

export type Index = {
  name: string;
  columns: string[];
  isUnique: boolean;
  definition?: string | null; // engine-specific
};

export type Table = {
  schema: string;
  name: string;
  columns: Column[];
  primaryKey?: PrimaryKey | null;
  foreignKeys: ForeignKey[];
  indexes: Index[];
};

export type DatabaseSchema = {
  dialect: Dialect;
  database: string;
  tables: Table[];
};

export async function getSchema(
  dialect: Dialect,
  connectionString: string,
  opts?: { includeSystemSchemas?: boolean; schemas?: string[] }
): Promise<DatabaseSchema> {
  if (dialect === "postgres") {
    return getPostgresSchema(connectionString, opts);
  }
  if (dialect === "mysql") {
    return getMySqlSchema(connectionString, opts);
  }
  throw new Error(`Unsupported dialect: ${dialect}`);
}

// ----------------------- POSTGRES -----------------------
async function getPostgresSchema(
  connectionString: string,
  opts?: { includeSystemSchemas?: boolean; schemas?: string[] }
): Promise<DatabaseSchema> {
  const client = new PgClient({ connectionString });
  await client.connect();

  const includeSystem = opts?.includeSystemSchemas ?? false;
  const userSchemasFilter =
    opts?.schemas && opts.schemas.length ? `AND t.table_schema = ANY($1)` : "";

  const systemExclusion = includeSystem
    ? ""
    : "AND t.table_schema NOT IN ('pg_catalog','information_schema')";

  const params: any[] = [];
  if (userSchemasFilter) params.push(opts!.schemas);

  const dbNameRes = await client.query<{ current_database: string }>(
    "SELECT current_database()"
  );
  const dbName = dbNameRes?.rows[0].current_database;

  // Tables
  const tablesRes = await client.query<{
    table_schema: string;
    table_name: string;
  }>(
    `
    SELECT t.table_schema, t.table_name
    FROM information_schema.tables t
    WHERE t.table_type = 'BASE TABLE'
      ${systemExclusion}
      ${userSchemasFilter}
    ORDER BY t.table_schema, t.table_name
    `,
    params
  );

  // Columns
  const colsRes = await client.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: "YES" | "NO";
    column_default: string | null;
    ordinal_position: number;
  }>(
    `
    SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE 1=1
      ${systemExclusion.replace("t.table_schema", "table_schema")}
      ${userSchemasFilter.replace("t.table_schema", "table_schema")}
    ORDER BY table_schema, table_name, ordinal_position
    `,
    params
  );

  // Primary keys (via pg_catalog for reliable ordering)
  const pksRes = await client.query<{
    schema: string;
    table: string;
    pk_name: string;
    column_name: string;
    position: number;
  }>(
    `
    SELECT
      n.nspname AS schema,
      c.relname AS table,
      con.conname AS pk_name,
      a.attname AS column_name,
      a.attnum AS position
    FROM pg_constraint con
    JOIN pg_class c        ON c.oid = con.conrelid
    JOIN pg_namespace n    ON n.oid = c.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN pg_attribute a    ON a.attrelid = c.oid AND a.attnum = cols.attnum
    WHERE con.contype = 'p'
      ${
        includeSystem
          ? ""
          : "AND n.nspname NOT IN ('pg_catalog','information_schema')"
      }
      ${opts?.schemas && opts.schemas.length ? "AND n.nspname = ANY($1)" : ""}
    ORDER BY n.nspname, c.relname, cols.ord
    `,
    params
  );

  // Foreign keys
  const fksRes = await client.query<{
    schema: string;
    table: string;
    fk_name: string;
    column_name: string;
    ref_schema: string;
    ref_table: string;
    ref_column_name: string;
    on_update: string | null;
    on_delete: string | null;
    position: number;
  }>(
    `
    SELECT
      ns.nspname AS schema,
      rel.relname AS table,
      con.conname AS fk_name,
      a.attname AS column_name,
      ns2.nspname AS ref_schema,
      rel2.relname AS ref_table,
      a2.attname AS ref_column_name,
      pg_catalog.pg_get_constraintdef(con.oid, true) AS def,
      con.confupdtype::text AS on_update,
      con.confdeltype::text AS on_delete,
      cols.ord as position
    FROM pg_constraint con
      JOIN pg_class rel      ON rel.oid = con.conrelid
      JOIN pg_namespace ns   ON ns.oid  = rel.relnamespace
      JOIN pg_class rel2     ON rel2.oid = con.confrelid
      JOIN pg_namespace ns2  ON ns2.oid  = rel2.relnamespace
      JOIN unnest(con.conkey)  WITH ORDINALITY AS cols(attnum, ord) ON true
      JOIN unnest(con.confkey) WITH ORDINALITY AS cols2(attnum, ord) ON cols.ord = cols2.ord
      JOIN pg_attribute a   ON a.attrelid = rel.oid  AND a.attnum  = cols.attnum
      JOIN pg_attribute a2  ON a2.attrelid = rel2.oid AND a2.attnum = cols2.attnum
    WHERE con.contype = 'f'
      ${
        includeSystem
          ? ""
          : "AND ns.nspname NOT IN ('pg_catalog','information_schema')"
      }
      ${opts?.schemas && opts.schemas.length ? "AND ns.nspname = ANY($1)" : ""}
    ORDER BY ns.nspname, rel.relname, fk_name, position
    `,
    params
  );

  // Indexes
  const idxRes = await client.query<{
    schemaname: string;
    tablename: string;
    indexname: string;
    indexdef: string | null;
  }>(
    `
    SELECT schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE 1=1
      ${
        includeSystem
          ? ""
          : "AND schemaname NOT IN ('pg_catalog','information_schema')"
      }
      ${opts?.schemas && opts.schemas.length ? "AND schemaname = ANY($1)" : ""}
    ORDER BY schemaname, tablename, indexname
    `,
    params
  );

  await client.end();

  // Assemble
  const tablesMap = new Map<string, Table>();
  for (const t of tablesRes.rows) {
    const key = `${t.table_schema}.${t.table_name}`;
    tablesMap.set(key, {
      schema: t.table_schema,
      name: t.table_name,
      columns: [],
      primaryKey: null,
      foreignKeys: [],
      indexes: [],
    });
  }

  for (const c of colsRes.rows) {
    const key = `${c.table_schema}.${c.table_name}`;
    const table = tablesMap.get(key);
    if (!table) continue;
    table.columns.push({
      name: c.column_name,
      dataType: c.data_type,
      isNullable: c.is_nullable === "YES",
      defaultValue: c.column_default,
      ordinalPosition: c.ordinal_position,
    });
  }

  // Primary keys
  const pkGroup = new Map<string, { name: string | null; cols: string[] }>();
  for (const p of pksRes.rows) {
    const key = `${p.schema}.${p.table}`;
    const g = pkGroup.get(key) || { name: p.pk_name ?? null, cols: [] };
    g.cols.push(p.column_name);
    pkGroup.set(key, g);
  }
  for (const [key, pk] of pkGroup) {
    const t = tablesMap.get(key);
    if (t) t.primaryKey = { name: pk.name, columns: pk.cols };
  }

  // Foreign keys (group by fk name)
  type FKKey = `${string}.${string}.${string}`;
  const fkGroup = new Map<
    FKKey,
    {
      name: string | null;
      cols: string[];
      refSchema: string;
      refTable: string;
      refCols: string[];
      onDelete: string | null;
      onUpdate: string | null;
    }
  >();

  for (const f of fksRes.rows) {
    const composite: FKKey = `${f.schema}.${f.table}.${f.fk_name}`;
    const g = fkGroup.get(composite) || {
      name: f.fk_name ?? null,
      cols: [],
      refSchema: f.ref_schema,
      refTable: f.ref_table,
      refCols: [],
      onDelete: f.on_delete,
      onUpdate: f.on_update,
    };
    g.cols.push(f.column_name);
    g.refCols.push(f.ref_column_name);
    fkGroup.set(composite, g);
  }

  for (const [fkKey, fk] of fkGroup) {
    const [schema, table] = fkKey.split(".").slice(0, 2);
    const t = tablesMap.get(`${schema}.${table}`);
    if (!t) continue;
    t.foreignKeys.push({
      name: fk.name,
      columns: fk.cols,
      referencedSchema: fk.refSchema,
      referencedTable: fk.refTable,
      referencedColumns: fk.refCols,
      onDelete: fk.onDelete,
      onUpdate: fk.onUpdate,
    });
  }

  // Indexes
  for (const idx of idxRes.rows) {
    const key = `${idx.schemaname}.${idx.tablename}`;
    const t = tablesMap.get(key);
    if (!t) continue;

    // Attempt to parse columns & uniqueness from indexdef
    let isUnique = false;
    let columns: string[] = [];
    if (idx.indexdef) {
      isUnique = /\bUNIQUE\b/i.test(idx.indexdef);
      const m = idx.indexdef.match(/\((.*?)\)/);
      if (m && m[1]) {
        columns = m[1]
          .split(",")
          .map((s) => s.trim().replace(/"/g, "").split(" ")[0]);
      }
    }
    t.indexes.push({
      name: idx.indexname,
      columns,
      isUnique,
      definition: idx.indexdef,
    });
  }

  return {
    dialect: "postgres",
    database: dbName,
    tables: Array.from(tablesMap.values()).map((t) => ({
      ...t,
      columns: t.columns.sort((a, b) => a.ordinalPosition - b.ordinalPosition),
    })),
  };
}

// ----------------------- MYSQL -----------------------
async function getMySqlSchema(
  connectionString: string,
  opts?: { schemas?: string[] } // schemas -> databases in MySQL context
): Promise<DatabaseSchema> {
  const conn = await mysql.createConnection({ uri: connectionString });

  // Current DB
  const [dbRows] = await conn.query<any[]>("SELECT DATABASE() AS db");
  const dbName = dbRows[0]?.db;

  const dbFilter = opts?.schemas?.length
    ? `AND t.table_schema IN (${opts.schemas.map(() => "?").join(",")})`
    : "AND t.table_schema = DATABASE()";
  const params: any[] = opts?.schemas?.length ? opts.schemas : [];

  // Tables
  const [tables] = await conn.query<any[]>(
    `
    SELECT t.table_schema, t.table_name
    FROM information_schema.tables t
    WHERE t.table_type='BASE TABLE'
      ${dbFilter}
    ORDER BY t.table_schema, t.table_name
    `,
    params
  );

  // Columns
  const [cols] = await conn.query<any[]>(
    `
    SELECT table_schema, table_name, column_name, data_type,
           is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE 1=1
      ${dbFilter.replace(/t\.table_schema/g, "table_schema")}
    ORDER BY table_schema, table_name, ordinal_position
    `,
    params
  );

  // Primary Keys (from key_column_usage + table_constraints)
  const [pks] = await conn.query<any[]>(
    `
    SELECT k.table_schema, k.table_name, tc.constraint_name, k.column_name, k.ordinal_position
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage k
      ON k.constraint_name = tc.constraint_name
      AND k.table_schema = tc.table_schema
      AND k.table_name = tc.table_name
    WHERE tc.constraint_type='PRIMARY KEY'
      ${dbFilter.replace(/t\.table_schema/g, "tc.table_schema")}
    ORDER BY k.table_schema, k.table_name, k.ordinal_position
    `,
    params
  );

  // Foreign Keys
  const [fks] = await conn.query<any[]>(
    `
    SELECT
      kcu.table_schema,
      kcu.table_name,
      kcu.constraint_name,
      kcu.column_name,
      kcu.referenced_table_schema,
      kcu.referenced_table_name,
      kcu.referenced_column_name,
      rc.update_rule,
      rc.delete_rule,
      kcu.position_in_unique_constraint AS position
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_schema = kcu.table_schema
     AND rc.constraint_name  = kcu.constraint_name
    WHERE kcu.referenced_table_name IS NOT NULL
      ${dbFilter.replace(/t\.table_schema/g, "kcu.table_schema")}
    ORDER BY kcu.table_schema, kcu.table_name, kcu.constraint_name, kcu.ordinal_position
    `,
    params
  );

  // Indexes
  const [idx] = await conn.query<any[]>(
    `
    SELECT
      s.table_schema, s.table_name, s.index_name, s.non_unique,
      s.seq_in_index, s.column_name
    FROM information_schema.statistics s
    WHERE 1=1
      ${dbFilter.replace(/t\.table_schema/g, "s.table_schema")}
    ORDER BY s.table_schema, s.table_name, s.index_name, s.seq_in_index
    `,
    params
  );

  await conn.end();

  const tablesMap = new Map<string, Table>();
  for (const t of tables) {
    const key = `${t.table_schema}.${t.table_name}`;
    tablesMap.set(key, {
      schema: t.table_schema,
      name: t.table_name,
      columns: [],
      primaryKey: null,
      foreignKeys: [],
      indexes: [],
    });
  }

  for (const c of cols) {
    const key = `${c.table_schema}.${c.table_name}`;
    const t = tablesMap.get(key);
    if (!t) continue;
    t.columns.push({
      name: c.column_name,
      dataType: c.data_type,
      isNullable: c.is_nullable === "YES",
      defaultValue: c.column_default,
      ordinalPosition: c.ordinal_position,
    });
  }

  // PKs
  const pkGroup = new Map<string, { name: string | null; cols: string[] }>();
  for (const p of pks) {
    const key = `${p.table_schema}.${p.table_name}`;
    const g = pkGroup.get(key) || {
      name: p.constraint_name ?? null,
      cols: [] as string[],
    };
    g.cols.push(p.column_name);
    pkGroup.set(key, g);
  }
  for (const [key, pk] of pkGroup) {
    const t = tablesMap.get(key);
    if (t) t.primaryKey = { name: pk.name, columns: pk.cols };
  }

  // FKs
  type FKKey = `${string}.${string}.${string}`;
  const fkGroup = new Map<
    FKKey,
    {
      name: string | null;
      cols: string[];
      refSchema: string;
      refTable: string;
      refCols: string[];
      onDelete: string | null;
      onUpdate: string | null;
    }
  >();

  for (const f of fks) {
    const composite: FKKey = `${f.table_schema}.${f.table_name}.${f.constraint_name}`;
    const g = fkGroup.get(composite) || {
      name: f.constraint_name ?? null,
      cols: [] as string[],
      refSchema: f.referenced_table_schema,
      refTable: f.referenced_table_name,
      refCols: [] as string[],
      onDelete: f.delete_rule,
      onUpdate: f.update_rule,
    };
    g.cols.push(f.column_name);
    g.refCols.push(f.referenced_column_name);
    fkGroup.set(composite, g);
  }
  for (const [fkKey, fk] of fkGroup) {
    const [schema, table] = fkKey.split(".").slice(0, 2);
    const t = tablesMap.get(`${schema}.${table}`);
    if (!t) continue;
    t.foreignKeys.push({
      name: fk.name,
      columns: fk.cols,
      referencedSchema: fk.refSchema,
      referencedTable: fk.refTable,
      referencedColumns: fk.refCols,
      onDelete: fk.onDelete,
      onUpdate: fk.onUpdate,
    });
  }

  // Indexes
  const idxGroup = new Map<string, Index>();
  for (const i of idx) {
    const key = `${i.table_schema}.${i.table_name}`;
    const t = tablesMap.get(key);
    if (!t) continue;

    const idxKey = `${i.index_name}`;
    let index = idxGroup.get(idxKey);
    if (!index) {
      index = {
        name: i.index_name,
        columns: [],
        isUnique: i.non_unique === 0,
      };
      idxGroup.set(idxKey, index);
      t.indexes.push(index);
    }
    index.columns.push(i.column_name);
  }

  return {
    dialect: "mysql",
    database: dbName,
    tables: Array.from(tablesMap.values()).map((t) => ({
      ...t,
      columns: t.columns.sort((a, b) => a.ordinalPosition - b.ordinalPosition),
    })),
  };
}
