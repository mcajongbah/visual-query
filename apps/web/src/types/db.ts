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
