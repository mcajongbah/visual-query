import ConnectionModal from "@/components/connection-modal";
import QueryCanvas from "@/components/query-canvas";
import QueryResults from "@/components/query-results";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { DatabaseIcon, LogOutIcon } from "lucide-react";
import { useQueryStore } from "store/query-store";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const { connectionInfo, disconnect, schema } = useQueryStore();

  if (!connectionInfo?.isConnected) {
    return (
      <div className="w-full h-screen overflow-hidden flex flex-col">
        <ConnectionModal />
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DatabaseIcon className="size-5" />
          <div>
            <h1 className="text-sm font-semibold">SQL Query Builder</h1>
            <p className="text-xs text-muted-foreground">
              Connected to {schema?.database} ({connectionInfo.dialect})
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={disconnect}>
          <LogOutIcon className="size-4 mr-2" />
          Disconnect
        </Button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[320px] min-h-full overflow-auto border-r">
          <Sidebar />
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <QueryCanvas />
        </div>
        <div className="w-[480px] min-h-full overflow-auto border-l px-4 py-10">
          <QueryResults />
        </div>
      </div>
    </div>
  );
}
