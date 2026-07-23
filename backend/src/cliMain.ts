import { buildContainer } from "./di/container";
import { DI_TYPES } from "./di/types";
import { ConfigParseError } from "./domain/errors";
import type { Config, ErrorRecord } from "./domain/types";
import type { IConfigLoader } from "./infra/configLoader";
import type { INodeValidator } from "./domain/validator";

export interface CliDeps {
  loader: IConfigLoader;
  validator: INodeValidator;
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
}

export interface CliRunOutput {
  exitCode: number;
  errors?: ErrorRecord[];
}

function getArgValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1];
  return undefined;
}

function usageText(): string {
  return "用法：node dist/cli.js --config <path/to/config.json>\n";
}

function renderTree(config: Config): string {
  const lines: string[] = [];
  const copyNotes: string[] = [];
  const rootLabel = `${config.workspace.replace(/[/\\\\]+$/, "")}/`;
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
          // 子层级：这里开始使用常规树前缀
          walk(node.children, nextPrefix, false);
        }
      } else {
        const resourceFileName = node.resource.split(/[/\\\\]/).pop() || node.name;
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

export async function runCli(argv: string[], deps?: Partial<CliDeps>): Promise<CliRunOutput> {
  const configPath = getArgValue(argv, "--config");
  if (!configPath) {
    (deps?.stderr ?? process.stderr).write(usageText());
    return { exitCode: 1 };
  }

  const container = deps?.loader && deps?.validator ? undefined : buildContainer();
  const loader =
    deps?.loader ??
    container!.get<IConfigLoader>(DI_TYPES.ConfigLoader);
  const validator =
    deps?.validator ??
    container!.get<INodeValidator>(DI_TYPES.NodeValidator);

  const stdout = deps?.stdout ?? process.stdout;
  const stderr = deps?.stderr ?? process.stderr;

  try {
    const config = await loader.loadFromFile(configPath);
    const errors = validator.validate(config);

    if (errors.length > 0) {
      stdout.write(JSON.stringify({ errors }, null, 2) + "\n");
      return { exitCode: 1, errors };
    }

    // 仅预览目录结构，不创建目录、不拷贝文件
    stdout.write(renderTree(config));
    return { exitCode: 0 };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stderr.write(msg + "\n");
    if (e instanceof ConfigParseError) return { exitCode: 1 };
    return { exitCode: 1 };
  }
}

