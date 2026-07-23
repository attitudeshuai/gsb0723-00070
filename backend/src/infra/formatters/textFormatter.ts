import { injectable } from "inversify";
import type { Config, OutputFormat, RunResult } from "../../domain/types";
import type { IFormatter } from "../../domain/formatter";

@injectable()
export class TextFormatter implements IFormatter {
  readonly format: OutputFormat = "text";

  render(config: Config, result: RunResult | null): string {
    const lines: string[] = [];
    const copyNotes: string[] = [];
    const rootLabel = `${config.workspace.replace(/[/\\]+$/, "")}/`;
    lines.push(rootLabel);

    const walk = (nodes: Config["structure"], prefixParts: string, isRoot: boolean) => {
      const lastIdx = nodes.length - 1;
      nodes.forEach((node, idx) => {
        const isLast = idx === lastIdx;
        const branch = isRoot ? "└── " : isLast ? "└── " : "├── ";
        const nextPrefix = isRoot ? "" : prefixParts + (isLast ? "    " : "│   ");

        if (node.type === "category") {
          lines.push(`${prefixParts}${branch}${node.name}/`);
          if (node.children.length > 0) {
            walk(node.children, nextPrefix, false);
          }
        } else {
          const resourceFileName = node.resource.split(/[/\\]/).pop() || node.name;
          lines.push(`${prefixParts}${branch}${resourceFileName}`);
          copyNotes.push(`${resourceFileName}从${node.resource}拷贝`);
        }
      });
    };

    walk(config.structure, "", true);
    if (copyNotes.length > 0) {
      lines.push("");
      lines.push(copyNotes.join("，"));
    }
    return lines.join("\n") + "\n";
  }
}
