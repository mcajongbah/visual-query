import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { DatabaseIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryStore } from "store/query-store";
import * as z from "zod";
import { sqlKeywords } from "../constants/keywords";
import { connectToDatabase } from "../lib/api-client";
import { Button } from "./ui/button";
import {
  Dialog,
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
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

// Zod schema for URL validation
const urlSchema = z.object({
  url: z.url("Please enter a valid URL").refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.protocol === "postgresql:" || parsed.protocol === "mysql:"
        );
      } catch {
        return false;
      }
    },
    { message: "URL must be a valid PostgreSQL or MySQL connection string" }
  ),
});

type UrlFormData = z.infer<typeof urlSchema>;

type ConnectionFormData = {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
};

export default function ConnectionModal() {
  const [step, setStep] = useState<1 | 2>(1);
  const [dialect, setDialect] = useState<"postgres" | "mysql" | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const closeInnerDialogRef = useRef<HTMLButtonElement>(null);

  const {
    setConnection,
    setConnectionError,
    connectionError,
    addNode,
    setEdges,
  } = useQueryStore();

  // URL import form
  const urlForm = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: { url: "" },
  });

  // Connection form
  const [formData, setFormData] = useState<ConnectionFormData>({
    host: "localhost",
    port: "5432",
    database: "",
    username: "",
    password: "",
  });

  const handleDialectSelect = (selectedDialect: "postgres" | "mysql") => {
    setDialect(selectedDialect);
    setFormData({
      ...formData,
      port: selectedDialect === "postgres" ? "5432" : "3306",
    });
    setStep(2);
  };

  const parseConnectionUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const newDialect =
        parsed.protocol === "postgresql:" ? "postgres" : "mysql";

      setDialect(newDialect);
      setFormData({
        host: parsed.hostname || "localhost",
        port: parsed.port || (newDialect === "postgres" ? "5432" : "3306"),
        database: parsed.pathname.slice(1) || "",
        username: parsed.username || "",
        password: parsed.password || "",
      });
      urlForm.reset();
    } catch (error) {
      console.error("Failed to parse URL:", error);
    }
  };

  const onUrlSubmit = (data: UrlFormData) => {
    parseConnectionUrl(data.url);
    // Close the inner dialog programmatically
    closeInnerDialogRef.current?.click();
  };

  const buildConnectionString = () => {
    if (dialect === "postgres") {
      return `postgresql://${formData.username}:${formData.password}@${formData.host}:${formData.port}/${formData.database}`;
    } else {
      return `mysql://${formData.username}:${formData.password}@${formData.host}:${formData.port}/${formData.database}`;
    }
  };

  const handleConnect = async () => {
    if (!dialect) return;

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
    <div className="flex items-center justify-center h-screen w-full">
      <Dialog>
        <DialogTrigger asChild>
          <Button>Connect to Database</Button>
        </DialogTrigger>
        <DialogContent className="p-0 shadow-xs">
          <LayoutGroup>
            <DialogHeader className="border-b p-4">
              <DialogTitle className="flex items-center">
                <DatabaseIcon className="size-6 mr-2" />
                Connect to Database
              </DialogTitle>
              <DialogDescription asChild>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={step}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.1 }}
                  >
                    {step === 1
                      ? "Select your database type to get started"
                      : "Enter your database credentials to complete the connection"}
                  </motion.p>
                </AnimatePresence>
              </DialogDescription>
            </DialogHeader>

            <motion.div
              className="flex flex-col gap-4 p-4 overflow-hidden"
              layout
              transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {/* Step 1: Database Selection */}
                {step === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.1, ease: "easeInOut" }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-center gap-4">
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                        onClick={() => handleDialectSelect("postgres")}
                        className="flex flex-col min-w-32 items-center justify-center gap-3 p-6 border rounded-lg hover:border-primary hover:bg-accent transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img
                          src="/icons/pgsql.svg"
                          alt="PostgreSQL"
                          className="size-12"
                        />
                        <div className="text-center">
                          <h3 className="font-semibold">PostgreSQL</h3>
                        </div>
                      </motion.button>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2, duration: 0.2 }}
                        onClick={() => handleDialectSelect("mysql")}
                        className="flex flex-col min-w-32 items-center justify-center gap-3 p-6 border rounded-lg hover:border-primary hover:bg-accent transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img
                          src="/icons/mysql.svg"
                          alt="MySQL"
                          className="size-12"
                        />
                        <div className="text-center">
                          <h3 className="font-semibold">MySQL</h3>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Connection Form */}
                {step === 2 && dialect && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.1, ease: "easeInOut" }}
                    className="space-y-4"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05, duration: 0.1 }}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="space-y-2">
                        <Label htmlFor="host">Host</Label>
                        <Input
                          id="host"
                          type="text"
                          value={formData.host}
                          onChange={(e) =>
                            setFormData({ ...formData, host: e.target.value })
                          }
                          placeholder="localhost"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          type="text"
                          value={formData.port}
                          onChange={(e) =>
                            setFormData({ ...formData, port: e.target.value })
                          }
                          placeholder={dialect === "postgres" ? "5432" : "3306"}
                        />
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.2 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="database">Database</Label>
                      <Input
                        id="database"
                        type="text"
                        value={formData.database}
                        onChange={(e) =>
                          setFormData({ ...formData, database: e.target.value })
                        }
                        placeholder="Enter database name"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.1 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        type="text"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value })
                        }
                        placeholder="Enter username"
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.2 }}
                      className="space-y-2"
                    >
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="Enter password"
                      />
                    </motion.div>

                    {/* Error message */}
                    {connectionError && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                        <p className="text-sm text-destructive">
                          {connectionError}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              layout
              transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
            >
              <DialogFooter className="flex flex-col items-center justify-between space-y-2 px-4 py-3 sm:flex-row sm:space-y-0">
                <AnimatePresence mode="wait">
                  {step === 2 && (
                    <motion.div
                      key="inner-dialog"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <InnerDialog>
                        <InnerDialogTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                          >
                            Import from URL
                          </Button>
                        </InnerDialogTrigger>
                        <InnerDialogContent className="-mt-6 p-0 sm:-mt-1 shadow-xs">
                          <InnerDialogHeader className="border-b p-4">
                            <InnerDialogTitle>Import from URL</InnerDialogTitle>
                            <InnerDialogDescription>
                              Import your database credentials from a connection
                              URL
                            </InnerDialogDescription>
                          </InnerDialogHeader>

                          <form onSubmit={urlForm.handleSubmit(onUrlSubmit)}>
                            <div className="flex flex-col gap-4 p-4">
                              <div className="space-y-2">
                                <Label htmlFor="url">Connection URL</Label>
                                <Input
                                  id="url"
                                  placeholder="postgresql://user:password@localhost:5432/database"
                                  {...urlForm.register("url")}
                                  aria-invalid={!!urlForm.formState.errors.url}
                                />
                                {urlForm.formState.errors.url && (
                                  <p className="text-sm text-destructive">
                                    {urlForm.formState.errors.url.message}
                                  </p>
                                )}
                              </div>
                            </div>

                            <InnerDialogFooter className="flex flex-col items-center justify-between space-y-2 border-t px-4 py-2 sm:flex-row sm:space-x-2 sm:space-y-0">
                              <InnerDialogClose asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="w-full sm:w-auto"
                                  ref={closeInnerDialogRef}
                                >
                                  Cancel
                                </Button>
                              </InnerDialogClose>
                              <Button
                                type="submit"
                                className="w-full sm:w-auto"
                              >
                                Import
                              </Button>
                            </InnerDialogFooter>
                          </form>
                        </InnerDialogContent>
                      </InnerDialog>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence mode="wait">
                  {step === 2 && (
                    <motion.div
                      key="action-buttons"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setStep(1)}
                      >
                        Back
                      </Button>
                      <Button
                        className="w-full sm:w-auto"
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </DialogFooter>
            </motion.div>
          </LayoutGroup>
        </DialogContent>
      </Dialog>
    </div>
  );
}
