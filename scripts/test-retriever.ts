import util from "util";

async function main(){
  try {
    const mod = await import("../packages/retrieval/vectorStoreLoader.ts");
    const loadVectorStore = mod.loadVectorStore as () => Promise<any>;
    const retriever = await loadVectorStore();
    const res = await retriever.similaritySearch("What is DocRAG Studio?", 3);
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error(util.inspect(err, { depth: null }));
    process.exit(1);
  }
}

main();
