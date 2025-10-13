import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CopyIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { useMemo } from "react";
import { useQueryStore } from "store/query-store";
import { Button } from "./ui/button";
import { exportToCSV } from "@/lib/export-csv";

const QueryResults = () => {
  const { generatedSQL, queryResults, queryError, isExecuting } =
    useQueryStore();

  const handleCopySQL = () => {
    if (generatedSQL) {
      navigator.clipboard.writeText(generatedSQL);
    }
  };

  const handleExportCSV = () => {
    if (queryResults && queryResults.rows.length > 0) {
      try {
        exportToCSV(queryResults.columns, queryResults.rows);
      } catch (error) {
        console.error("Failed to export CSV:", error);
      }
    }
  };

  // Build TanStack Table columns dynamically
  const columns = useMemo(() => {
    if (!queryResults?.columns) return [];

    const columnHelper = createColumnHelper<Record<string, unknown>>();
    return queryResults.columns.map((col) =>
      columnHelper.accessor(col.id, {
        header: col.header,
        cell: (info) => {
          const value = info.getValue();
          if (value === null || value === undefined) {
            return <span className="text-muted-foreground italic">NULL</span>;
          }
          return String(value);
        },
      })
    );
  }, [queryResults?.columns]);

  const table = useReactTable({
    data: queryResults?.rows || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full h-full flex flex-col gap-6">
      <div>
        <h4 className="text-base font-semibold">Query Results</h4>
        <p className="text-sm text-muted-foreground">
          Generated SQL and execution results
        </p>
      </div>

      {/* Generated SQL */}
      <div className="border rounded-md">
        <div className="px-3 py-2 border-b flex justify-between items-center">
          <h5 className="font-medium text-sm">Generated SQL</h5>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySQL}
            disabled={!generatedSQL}
          >
            <CopyIcon className="size-3 mr-1" />
            Copy
          </Button>
        </div>

        <div className="p-3 bg-muted">
          {generatedSQL ? (
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {generatedSQL}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add nodes to the canvas to build your query
            </p>
          )}
        </div>
      </div>

      {/* Execution Results */}
      <div className="border rounded-md flex-1 flex flex-col min-h-0">
        <div className="px-3 py-2 border-b flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <h5 className="font-medium text-sm">Results</h5>
            {isExecuting && <Loader2Icon className="size-3 animate-spin" />}
          </div>
          {queryResults && queryResults.rows.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {queryResults.rowCount} rows •{" "}
                {queryResults.executionTime.toFixed(1)}ms
              </span>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <DownloadIcon className="size-3 mr-1" />
                CSV
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {queryError && (
            <div className="p-3 bg-destructive/10 border-destructive/30">
              <p className="text-xs text-destructive">{queryError}</p>
            </div>
          )}

          {!queryError && queryResults && queryResults.rows.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="px-3 py-2 text-left font-semibold border-b"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!queryError &&
            !isExecuting &&
            queryResults &&
            queryResults.rows.length === 0 && (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Query returned no results
              </div>
            )}

          {!queryError && !isExecuting && !queryResults && generatedSQL && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Waiting for query execution...
            </div>
          )}

          {!generatedSQL && !isExecuting && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Build your query to see results
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryResults;
