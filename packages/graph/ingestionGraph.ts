type GraphState = {
  filePaths: string[];
  chunksProcessed?: number;
  vectorsAdded?: number;
};

export function buildIngestionGraph() {
  const checkpoint = {
    async save(state: GraphState) {
      const fs = await import("fs/promises");
      await fs.mkdir("./data/checkpoints", { recursive: true });
      await fs.writeFile(
        "./data/checkpoints/ingestion.json",
        JSON.stringify(state, null, 2)
      );
    },
    async load(): Promise<GraphState | null> {
      try {
        const fs = await import("fs/promises");
        const data = await fs.readFile("./data/checkpoints/ingestion.json", "utf-8");
        return JSON.parse(data);
      } catch (err) {
        if ((err as any).code === "ENOENT") return null;
        throw err;
      }
    }
  };

  return {
    async invoke(input: GraphState) {
      // Try to load checkpoint
      const saved = await checkpoint.load();
      if (saved?.chunksProcessed) {
        console.log("Resuming from checkpoint:", saved);
        return saved;
      }

      // Run ingestion
      const { ingestDocuments } = await import("../ingestion/index.js");
      const result = await ingestDocuments(input.filePaths);
      
      // Save checkpoint and return
      const state = { ...input, ...result };
      await checkpoint.save(state);
      return state;
    }
  };
}
