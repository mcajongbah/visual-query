import { executeQuery as executeQueryAPI } from "./api-client";

type QueryResults = {
  columns: { id: string; header: string; dataType?: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
};

export async function executeQuery(
  sql: string,
  sessionId: string
): Promise<QueryResults> {
  return executeQueryAPI({ sql, sessionId });
}
