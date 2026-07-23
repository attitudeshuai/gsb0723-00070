import * as fs from "node:fs/promises";
import { buildContainer } from "./di/container";
import { DI_TYPES } from "./di/types";
import { ConfigParseError } from "./domain/errors";
import type { CliMode, ErrorRecord, OutputFormat, RunOptions, RunResult } from "./domain/types";
import type { IConfigLoader } from "./infra/configLoader";
import type { INodeValidator } from "./domain/validator";
import type { IRunnerService } from "./application/runnerService";
import type { IFormatter } from "./domain/formatter";
import type { IReportRenderer } from "./domain/reporter";

export interface CliDeps {
  runner?: IRunnerService;
  loader?: IConfigLoader;
  validator?: INodeValidator;
  formatters?: Record<OutputFormat, IFormatter>;
  reportRenderer?: IReportRenderer;
  stdout?: { write: (s: string) => void };
  stderr?: { write: (s: string) => void };
  fileWriter?: (path: string, content: string) => Promise<void>;
}

export interface CliRunOutput {
  exitCode: number;
  errors?: ErrorRecord[];
  result?: RunResult;
}

interface ParsedArgs {
  configPath: string | undefined;
  mode: CliMode;
  format: OutputFormat;
  options: RunOptions;
  reportPath: string | undefined;
}

function getArgValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1];
  return undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function parseArgs(argv: string[]): ParsedArgs {
  const configPath = getArgValue(argv, "--config");
  const execute = hasFlag(argv, "--execute");
  const check = hasFlag(argv, "--check");
  const format = (getArgValue(argv, "--format") ?? "text") as OutputFormat;
  const reportPath = getArgValue(argv, "--report");

  const overwrite = hasFlag(argv, "--overwrite");
  const skipFlag = hasFlag(argv, "--skip");
  const noSkipFlag = hasFlag(argv, "--no-skip");

  let skipIfExists: boolean | undefined;
  if (noSkipFlag) {
    skipIfExists = false;
  } else if (skipFlag) {
    skipIfExists = true;
  }

  let mode: CliMode = "preview";
  if (execute) mode = "execute";
  else if (check) mode = "check";

  const options: RunOptions = { overwrite };
  if (skipIfExists !== undefined) {
    options.skipIfExists = skipIfExists;
  }

  return {
    configPath,
    mode,
    format: format === "json" || format === "markdown" || format === "text" ? format : "text",
    options,
    reportPath,
  };
}

function usageText(): string {
  return [
    "用法：node dist/cli.js --config <path/to/config.json> [options]",
    "",
    "选项：",
    "  --config <path>        配置文件路径（必填）",
    "  --execute              执行模式：创建目录并拷贝文件",
    "  --check                检查模式：仅验证配置和资源文件，不写盘",
    "  --format <text|json|markdown>  输出格式（默认：text）",
    "  --skip                 目标文件已存在时跳过（默认）",
    "  --no-skip              目标文件已存在时不跳过",
    "  --overwrite            覆盖已存在的目标文件（优先于 --skip）",
    "  --report <path>        将报告写入指定文件",
    "  -h, --help             显示此帮助信息",
    "",
  ].join("\n");
}

export async function runCli(argv: string[], deps?: Partial<CliDeps>): Promise<CliRunOutput> {
  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    (deps?.stdout ?? process.stdout).write(usageText());
    return { exitCode: 0 };
  }

  const args = parseArgs(argv);

  if (!args.configPath) {
    (deps?.stderr ?? process.stderr).write(usageText());
    return { exitCode: 1 };
  }

  const container = buildContainer();
  const runner = deps?.runner ?? container.get<IRunnerService>(DI_TYPES.RunnerService);
  const loader = deps?.loader ?? container.get<IConfigLoader>(DI_TYPES.ConfigLoader);
  const validator = deps?.validator ?? container.get<INodeValidator>(DI_TYPES.NodeValidator);
  const reportRenderer = deps?.reportRenderer ?? container.get<IReportRenderer>(DI_TYPES.ReportRenderer);

  const formatters: Record<OutputFormat, IFormatter> = deps?.formatters ?? {
    text: container.get<IFormatter>(DI_TYPES.TextFormatter),
    json: container.get<IFormatter>(DI_TYPES.JsonFormatter),
    markdown: container.get<IFormatter>(DI_TYPES.MarkdownFormatter),
  };

  const stdout = deps?.stdout ?? process.stdout;
  const stderr = deps?.stderr ?? process.stderr;
  const fileWriter = deps?.fileWriter ?? ((p: string, c: string) => fs.writeFile(p, c, "utf-8"));

  try {
    const config = await loader.loadFromFile(args.configPath);
    const formatter = formatters[args.format];

    if (args.mode === "preview") {
      const validationErrors = validator.validate(config);
      if (validationErrors.length > 0) {
        stdout.write(JSON.stringify({ errors: validationErrors }, null, 2) + "\n");
        return { exitCode: 1, errors: validationErrors };
      }
      stdout.write(formatter.render(config, null));
      return { exitCode: 0 };
    }

    let result: RunResult;
    if (args.mode === "execute") {
      result = await runner.runWithConfig(config, args.options);
    } else {
      result = await runner.checkWithConfig(config);
    }

    const rendered = formatter.render(config, result);
    stdout.write(rendered);

    const hasIssues = result.errors.length > 0 || result.missingResources.length > 0;
    const reportText = args.format === "text" ? reportRenderer.render(args.mode, result) : "";

    if (reportText) {
      if (args.reportPath) {
        await fileWriter(args.reportPath, reportText);
      } else {
        stdout.write(reportText);
      }
    } else if (args.reportPath) {
      const reportForFile = reportRenderer.render(args.mode, result);
      await fileWriter(args.reportPath, reportForFile);
    }

    const exitCode = hasIssues ? 1 : 0;
    return { exitCode, errors: result.errors, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stderr.write(msg + "\n");
    if (e instanceof ConfigParseError) return { exitCode: 1 };
    return { exitCode: 1 };
  }
}
