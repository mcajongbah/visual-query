import ConnectionModal from "@/components/connection-modal";
import QueryCanvas from "@/components/query-canvas";
import QueryResults from "@/components/query-results";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  InnerDialog,
  InnerDialogClose,
  InnerDialogContent,
  InnerDialogDescription,
  InnerDialogFooter,
  InnerDialogHeader,
  InnerDialogTitle,
  InnerDialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
      <div className="flex items-center justify-center h-screen w-full relative">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Connect to Database</Button>
          </DialogTrigger>
          <DialogContent className="p-0">
            <DialogHeader className="border-b p-4">
              <DialogTitle className="flex items-center">
                <DatabaseIcon className="size-6 mr-2" />
                Connect to Database
              </DialogTitle>
              <DialogDescription>
                Please enter your database credentials below to complete the
                connection process.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 p-4">
              <ConnectionModal />
            </div>
            <DialogFooter className="flex flex-col items-center justify-between space-y-2 px-4 py-2 sm:flex-row sm:space-y-0">
              <InnerDialog>
                <InnerDialogTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Import from url
                  </Button>
                </InnerDialogTrigger>
                <InnerDialogContent className="-mt-6 p-0 sm:-mt-1">
                  <InnerDialogHeader className="border-b p-4">
                    <InnerDialogTitle>Import from url</InnerDialogTitle>
                    <InnerDialogDescription>
                      Import your database credentials from a url
                    </InnerDialogDescription>
                  </InnerDialogHeader>

                  <div className="flex flex-col gap-4 p-4">
                    <Input placeholder="Enter url" />
                  </div>

                  <InnerDialogFooter className="flex flex-col items-center justify-between space-y-2 border-t px-4 py-2 sm:flex-row sm:space-x-2 sm:space-y-0">
                    <InnerDialogClose asChild>
                      <Button variant="outline" className="w-full sm:w-auto">
                        Cancel
                      </Button>
                    </InnerDialogClose>
                    <Button className="w-full sm:w-auto">Import</Button>
                  </InnerDialogFooter>
                </InnerDialogContent>
              </InnerDialog>
              <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
                <DialogClose asChild>
                  <Button variant="outline" className="w-full sm:w-auto">
                    Cancel
                  </Button>
                </DialogClose>
                <Button className="w-full sm:w-auto">Connect</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
