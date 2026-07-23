import { injectable } from "inversify";
import type { Config, TreeNode } from "../domain/types";
import type { FormatContext, IOutputFormatter } from "./outputFormatter";
import { walkTree } from "./treeWalker";

interface JsonNode {
  type: "category" | "material";
  name: string;
  children?: JsonNode[];
  resource?: string;
  destination?: string;
  description?: string;
}

function toJsonNode(node: TreeNode): JsonNode {
  if (node.type === "category") {
    return {
      type: "category",
      name: node.name,
      children: node.children.map(toJsonNode),
    };
  }
  const out: JsonNode = {
    type: "material",
    name: node.name,
    resource: node.resource,
  };
  if (node.description !== undefined) {
    out.description = node.description;
  }
  return out;
}

@injectable()
export class JsonStructureFormatter implements IOutputFormatter {
  format(ctx: FormatContext): string {
    if (ctx.validationErrors.length > 0) {
      return JSON.stringify({ errors: ctx.validationErrors }, null, 2) + "\n";
    }

    if (ctx.mode === "check" && ctx.checkResult) {
      return (
        JSON.stringify(
          {
            validationErrors: ctx.checkResult.validationErrors,
            missingResources: ctx.checkResult.missingResources,
          },
          null,
          2,
        ) + "\n"
      );
    }

    if (!ctx.config) {
      return JSON.stringify({}) + "\n";
    }

    const cfg: Config = ctx.config;
    const copies = walkTree(cfg, {}).map((r) => ({
      name: r.name,
      resource: r.resource,
      destination: r.destination,
    }));

    const payload = {
      workspace: cfg.workspace,
      description: cfg.description,
      structure: cfg.structure.map(toJsonNode),
      copies,
    };
    return JSON.stringify(payload, null, 2) + "\n";
  }
}
