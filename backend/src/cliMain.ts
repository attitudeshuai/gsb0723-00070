import * as path from "node:path";
import { Container } from "inversify";
import { buildContainer } from "./di/container";
import { DI_TYPES } from "./di/types";
import { ConfigParseError } from "./domain/errors";
import type {
  CheckResult,
  CliOptions,
  Config,
  ErrorRecord,
  MissingResource,
  OutputFormat,
  ReportSummary,
  RunMode,
  RunOptions,
  RunResult,
} from "./domain/types";
import type { IConfigLoader } from "./infra/configLoader";
import type { IFileSystem } from "./infra/fileSystem";
import type { INodeValidator } from "./domain/validator";
import type { IRunnerService } from "./application/runnerService";
import type { IStructureChecker } from "./application/structureChecker";
import type { IOutputFormatter, FormatContext } from "./presentation/outputFormatter";
import type { IReportRenderer } from "./presentation/reportRenderer";

export interface CliDeps {
  container?: Container;
  loader?: IConfigLoader;
  validator?: INodeValidator;
  fileSystem?: IFileSystem;
  stdout?: { write: (s: string) => void };
  stderr?: { write: (s: string) => void };
}

export interface CliRunOutput {
  exitCode: number;
  errors?: ErrorRecord[];
  report?: ReportSummary;
}

interface Writer {
  write: (s: string) => void;
}

function getArgValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1];
  return undefined;
}

function usageText(): string {
  return [
    "用法：node dist/cli.js --config <path/to/config.json> [options]",
    "",
    "选项：",
    "  --config <path>                 配置文件路径（必填）",
    "  --mode <preview|execute|check>  运行模式，默认 preview（仅预览，不写盘）",
    "  --format <text|json|markdown>   输出格式，默认 text",
    "  --skip <true|false>             目标已存在时跳过，默认 true",
    "  --overwrite <true|false>        覆盖已存在目标，默认 false（优先于 --skip）",
    "  --report <path|->               将汇总报告写入文件，或使用 - 输出到 stdout（默认 stdout）",
    "",
  ].join("\n");
}

function parseMode(v: string | undefined): RunMode {
  if (v == null) return "preview";
  if (v === "preview" || v === "execute" || v === "check") return v;
  throw new Error(`无效的 --mode 值：${v}（应为 preview、execute 或 check）`);
}

function parseFormat(v: string | undefined): OutputFormat {
  if (v == null) return "text";
  if (v === "text" || v === "json" || v === "markdown") return v;
  throw new Error(`无效的 --format 值：${v}（应为 text、json 或 markdown）`);
}

function parseBool(v: string | undefined, def: boolean, flagName: string): boolean {
  if (v == null) return def;
  const s = v.trim().toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  throw new Error(`无效的 --${flagName} 值：${v}（应为 true 或 false）`);
}

class UsageError extends Error {}

function parseArgs(argv: string[]): { configPath: string; options: CliOptions } {
  const configPath = getArgValue(argv, "--config");
  if (!configPath) {
    throw new UsageError(usageText());
  }
  const options: CliOptions = {
    mode: parseMode(getArgValue(argv, "--mode")),
    format: parseFormat(getArgValue(argv, "--format")),
    skipIfExists: parseBool(getArgValue(argv, "--skip"), true, "skip"),
    overwrite: parseBool(getArgValue(argv, "--overwrite"), false, "overwrite"),
  };
  const reportPath = getArgValue(argv, "--report");
  if (reportPath !== undefined) {
    options.reportPath = reportPath;
  }
  return { configPath, options };
}

function buildRuntimeContainer(deps?: Partial<CliDeps>): Container {
  if (deps?.container) return deps.container;
  const c = buildContainer();
  if (deps?.loader) {
    c.rebindSync<IConfigLoader>(DI_TYPES.ConfigLoader).toConstantValue(deps.loader);
  }
  if (deps?.validator) {
    c.rebindSync<INodeValidator>(DI_TYPES.NodeValidator).toConstantValue(deps.validator);
  }
  if (deps?.fileSystem) {
    c.rebindSync<IFileSystem>(DI_TYPES.FileSystem).toConstantValue(deps.fileSystem);
  }
  return c;
}

function workspaceOf(config: Config | null): string {
  return config?.workspace?.replace(/[/\\]+$/, "") ?? "";
}

function buildSummary(
  mode: RunMode,
  format: OutputFormat,
  config: Config | null,
  input: {
    validationErrors: ErrorRecord[];
    checkResult?: CheckResult;
    runResult?: RunResult;
    elapsedMs: number;
  },
): ReportSummary {
  const { runResult, checkResult, validationErrors, elapsedMs } = input;
  const errorList: ErrorRecord[] = [];
  const missingList: MissingResource[] = [];
  let created = 0;
  let copied = 0;
  let skipped = 0;
  let overwritten = 0;
  let missing = 0;
  let errors = 0;

  if (runResult) {
    created = runResult.createdDirectories.length;
    copied = runResult.copiedFiles.length;
    skipped = runResult.skippedFiles.length;
    overwritten = runResult.overwrittenFiles.length;
    missing = runResult.missingResources.length;
    errors = runResult.errors.length;
    errorList.push(...runResult.errors);
    missingList.push(...runResult.missingResources);
  } else if (checkResult) {
    errors = checkResult.validationErrors.length;
    missing = checkResult.missingResources.length;
    errorList.push(...checkResult.validationErrors);
    missingList.push(...checkResult.missingResources);
  } else {
    errors = validationErrors.length;
    errorList.push(...validationErrors);
  }

  return {
    mode,
    format,
    workspace: workspaceOf(config),
    createdDirectories: created,
    copiedFiles: copied,
    skippedFiles: skipped,
    overwrittenFiles: overwritten,
    missingResources: missing,
    errors,
    elapsedMs,
    errorList,
    missingList,
  };
}

function exitCodeFor(summary: ReportSummary): number {
  if (summary.errors > 0 || summary.missingResources > 0) return 1;
  return 0;
}

export async function runCli(argv: string[], deps?: Partial<CliDeps>): Promise<CliRunOutput> {
  const stdout: Writer = deps?.stdout ?? process.stdout;
  const stderr: Writer = deps?.stderr ?? process.stderr;

  let configPath: string;
  let options: CliOptions;
  try {
    ({ configPath, options } = parseArgs(argv));
  } catch (e) {
    if (e instanceof UsageError) {
      stderr.write(e.message + "\n");
    } else {
      stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    }
    return { exitCode: 1 };
  }

  const container = buildRuntimeContainer(deps);
  const loader = deps?.loader ?? container.get<IConfigLoader>(DI_TYPES.ConfigLoader);
  const validator =
    deps?.validator ?? container.get<INodeValidator>(DI_TYPES.NodeValidator);
  const runner = container.get<IRunnerService>(DI_TYPES.RunnerService);
  const checker = container.get<IStructureChecker>(DI_TYPES.StructureChecker);
  const fileSystem = container.get<IFileSystem>(DI_TYPES.FileSystem);
  const formatter = container.get<IOutputFormatter>(DI_TYPES.OutputFormatter, { name: options.format });
  const reporter = container.get<IReportRenderer>(DI_TYPES.ReportRenderer, { name: options.format });

  const startedAt = Date.now();
  let config: Config | null = null;
  let validationErrors: ErrorRecord[] = [];
  let checkResult: CheckResult | undefined;
  let runResult: RunResult | undefined;

  try {
    config = await loader.loadFromFile(configPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    stderr.write(msg + "\n");
    if (e instanceof ConfigParseError) return { exitCode: 1 };
    return { exitCode: 1 };
  }

  if (options.mode === "check") {
    checkResult = await checker.check(config);
    validationErrors = checkResult.validationErrors;
  } else {
    validationErrors = validator.validate(config);
  }

  if (options.mode === "execute" && validationErrors.length === 0) {
    const runOptions: RunOptions = {
      skipIfExists: options.skipIfExists,
      overwrite: options.overwrite,
    };
    runResult = await runner.runWithConfig(config, runOptions);
    validationErrors = [];
  }

  const elapsedMs = Date.now() - startedAt;

  const ctx: FormatContext = {
    mode: options.mode,
    config,
    validationErrors,
  };
  if (checkResult !== undefined) {
    ctx.checkResult = checkResult;
  }
  if (runResult !== undefined) {
    ctx.runResult = runResult;
  }
  const primary = formatter.format(ctx);
  if (primary.length > 0) {
    stdout.write(primary);
  }

  const summaryInput: {
    validationErrors: ErrorRecord[];
    checkResult?: CheckResult;
    runResult?: RunResult;
    elapsedMs: number;
  } = { validationErrors, elapsedMs };
  if (checkResult !== undefined) {
    summaryInput.checkResult = checkResult;
  }
  if (runResult !== undefined) {
    summaryInput.runResult = runResult;
  }
  const summary = buildSummary(options.mode, options.format, config, summaryInput);
  const reportText = reporter.render(summary);

  if (options.reportPath && options.reportPath !== "-") {
    const dir = path.dirname(options.reportPath);
    await fileSystem.mkdirp(dir);
    await fileSystem.writeFile(options.reportPath, reportText);
  } else {
    stdout.write(reportText);
  }

  return { exitCode: exitCodeFor(summary), errors: validationErrors, report: summary };
}
