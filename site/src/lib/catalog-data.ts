import generatedCatalog from "../generated/sample-catalog.json";
import { parseCatalog } from "./catalog";

export const catalog = parseCatalog(generatedCatalog);
