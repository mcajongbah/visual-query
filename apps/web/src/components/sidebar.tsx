import * as Icons from "lucide-react";
import { sqlKeywords, type SqlKeywordMeta } from "../constants/keywords";
import { useQueryStore } from "store/query-store";

const Sidebar = () => {
  const { addNode, nodes } = useQueryStore();

  const handleAddNode = (keyword: SqlKeywordMeta) => {
    // Calculate position based on existing nodes
    // Place new nodes in a cascading pattern
    const baseX = 100;
    const baseY = 100;
    const offset = nodes.length * 30; // Cascade by 30px for each node

    const position = {
      x: baseX + offset,
      y: baseY + offset,
    };

    addNode(keyword, position);
  };

  return (
    <div className="w-full flex flex-col gap-4 px-4 py-10">
      <div>
        <h4 className="text-base font-semibold">SQL Keywords</h4>
        <p className="text-sm text-muted-foreground">
          Click on a keyword to add it to your query.
        </p>
      </div>
      <div className="space-y-6">
        {Object.entries(sqlKeywords).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-semibold opacity-70">{category}</h3>
            <div className="flex flex-wrap gap-2">
              {(items as SqlKeywordMeta[]).map((k) => {
                const Icon =
                  // @ts-expect-error - we are not using the types for this
                  Icons[
                    k.icon
                      .split("-")
                      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                      .join("")
                  ] || Icons.CircleHelp;

                return (
                  <button
                    key={k.id}
                    title={k.tooltip}
                    onClick={() => handleAddNode(k)}
                    className="inline-flex cursor-pointer items-center font-medium gap-1 rounded-2xl border px-3 py-1 text-xs hover:bg-accent transition-colors"
                  >
                    <Icon className="size-3" aria-hidden />
                    <span>{k.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
