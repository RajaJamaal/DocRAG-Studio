import { z } from "zod";
import { StateGraph, END } from "langgraph";
import { loadDocuments } from "../ingestion/loaders.js";
import { splitDocuments } from "../ingestion/splitters.js";
import { generateEmbeddings } from "../ingestion/embeddings.js";
import { storeEmbeddings } from "../ingestion/store.js";
import type { Document } from "@langchain/core/documents";

// Zod schema for the graph state
const graphStateSchema = z.object({
  filePaths: z.array(z.string()),
  documents: z.array(z.any()).optional(),
  chunks: z.array(z.any()).optional(),
  processedChunks: z.number().optional(),
});

type GraphState = z.infer<typeof graphStateSchema>;

async function load(state: GraphState): Promise<Partial<GraphState>> {
  console.log("---LOADING DOCUMENTS---");
  const documents = await loadDocuments(state.filePaths);
  return { documents };
}

async function split(state: GraphState): Promise<Partial<GraphState>> {
  console.log("---SPLITTING DOCUMENTS---");
  const chunks = await splitDocuments(state.documents as Document[]);
  return { chunks };
}

async function embed(state: GraphState): Promise<Partial<GraphState>> {
  console.log("---GENERATING EMBEDDINGS---");
  const chunksWithEmbeddings = await generateEmbeddings(state.chunks as Document[]);
  return { chunks: chunksWithEmbeddings };
}

async function store(state: GraphState): Promise<Partial<GraphState>> {
  console.log("---STORING EMBEDDINGS---");
  await storeEmbeddings(state.chunks as Document[]);
  return { processedChunks: state.chunks?.length };
}

export function buildIngestionGraph() {
  const workflow = new StateGraph<GraphState>({
    schema: graphStateSchema,
  });

  workflow.addNode("load", load);
  workflow.addNode("split", split);
  workflow.addNode("embed", embed);
  workflow.addNode("store", store);

  workflow.setEntryPoint("load");
  workflow.addEdge("load", "split");
  workflow.addEdge("split", "embed");
  workflow.addEdge("embed", "store");
  workflow.addEdge("store", END);

  return workflow.compile();
}
