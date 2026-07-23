import { buildContainer } from "./di/container";
import { DI_TYPES } from "./di/types";
import { ConfigParseError } from "./domain/errors";
import type {
  Config,
  ErrorRecord,
  OutputFormat,
  RunOptions,
  RunReport,
} from "./domain/types";
import type { IConfigLoader } from "./infra/configLoader";
import type { INodeValidator } from "./domain/validator";
import type { IFileSystem } from "./infra/fileSystem";
import type { IGenerateStructureUseCase } from "./application/generateStructureUseCase";
import type { ICheckResourcesUseCase } from "./application/checkResourcesUseCase";
import type { IStructureRenderer } from "./presentation/structureRenderer";
import type { IReporter } from "./presentation/reporter";

export interface CliDeps {
  loader: IConfigLoader;
  validator: INodeValidator;
  fileSystem: IFileSystem;
  generator: IGenerateStructureUseCase;
  checker: ICheckResourcesUseCase;
  renderer: IStructureRenderer;
  reporter: IReporter;
  stdout: { write: (s: string) => void };
  stderr: { write: (s: string) => void };
}

export interface CliRunOutput {
  exitCode: number;
  errors?: ErrorRecord[];
  report?: RunReport;
}

type Mode = "preview" | "execute" | "check";

function getArgValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1];
  return undefined;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.indexOf(name) >= 0;
}

function usageText(): string {
  return [
    "用法：node dist/cli.js --config <path/to/config.json> [选项]",
    "",
    "模式（默认仅预览，不写文件系统）：",
    "  --execute              真正创建目录并拷贝文件",
    "  --check                仅校验配置与资源是否存在，不写文件系统",
    "",
    "选项：",
    "  --format <text|json|markdown>   预览输出格式（默认 text）",
    "  --strategy <skip|overwrite>     执行策略（默认 skip；overwrite 优先）",
    "  --report-file <path>            将汇总报告写入文件（默认输出到 stdout）",
    "",
  ].join("\n") + "\n";
}

function resolveMode(argv: string[]): Mode {
  if (hasFlag(argv, "--check")) return "check";
  if (hasFlag(argv, "--execute")) return "execute";
  return "preview";
}

function resolveOptions(argv: string[]): RunOptions {
  const strategy = getArgValue(argv, "--strategy");
  if (strategy === "overwrite") {
    return { overwrite: true };
  }
  // 未指定或 skip：与 RunOptions 默认值保持一致（skipIfExists=true, overwrite=false）
  return { skipIfExists: true, overwrite: false };
}

function resolveDeps(deps?: Partial<CliDeps>): CliDeps {
  const needsContainer =
    !deps?.loader ||
    !deps?.validator ||
    !deps?.fileSystem ||
    !deps?.generator ||
    !deps?.checker ||
    !deps?.renderer ||
    !deps?.reporter;
  const container = needsContainer ? buildContainer() : undefined;

  return {
    loader: deps?.loader ?? container!.get<IConfigLoader>(DI_TYPES.ConfigLoader),
    validator: deps?.validator ?? container!.get<INodeValidator>(DI_TYPES.NodeValidator),
    fileSystem: deps?.fileSystem ?? container!.get<IFileSystem>(DI_TYPES.FileSystem),
    generator: deps?.generator ?? container!.get<IGenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase),
    checker: deps?.checker ?? container!.get<ICheckResourcesUseCase>(DI_TYPES.CheckResourcesUseCase),
    renderer: deps?.renderer ?? container!.get<IStructureRenderer>(DI_TYPES.StructureRenderer),
    reporter: deps?.reporter ?? container!.get<IReporter>(DI_TYPES.Reporter),
    stdout: deps?.stdout ?? process.stdout,
    stderr: deps?.stderr ?? process.stderr,
  };
}

async function emitReport(
  d: CliDeps,
  report: RunReport,
  reportFile: string | undefined,
): Promise<void> {
  const text = d.reporter.format(report);
  if (reportFile) {
    await d.fileSystem.writeFile(reportFile, text);
  } else {
    d.stdout.write(text);
  }
}

export async function runCli(argv: string[], deps?: Partial<CliDeps>): Promise<CliRunOutput> {
  const configPath = getArgValue(argv, "--config");
  if (!configPath) {
    (deps?.stderr ?? process.stderr).write(usageText());
    return { exitCode: 1 };
  }

  const format = (getArgValue(argv, "--format") ?? "text") as string;
  const reportFile = getArgValue(argv, "--report-file");
  const mode = resolveMode(argv);

  const d = resolveDeps(deps);

  if (!d.renderer.supports(format)) {
    d.stderr.write(`不支持的输出格式：${format}\n`);
    return { exitCode: 1 };
  }
  const outputFormat: OutputFormat = format;

  let config: Config;
  try {
    config = await d.loader.loadFromFile(configPath);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    d.stderr.write(msg + "\n");
    if (e instanceof ConfigParseError) return { exitCode: 1 };
    return { exitCode: 1 };
  }

  if (mode === "check") {
    return runCheck(d, config, reportFile);
  }
  if (mode === "execute") {
    return runExecute(d, config, resolveOptions(argv), reportFile);
  }
  return runPreview(d, config, outputFormat, reportFile);
}

async function runPreview(
  d: CliDeps,
  config: Config,
  format: OutputFormat,
  reportFile: string | undefined,
): Promise<CliRunOutput> {
  // 预览模式仍先做配置校验；配置非法时输出错误、绝不写盘。
  const errors = d.validator.validate(config);
  if (errors.length > 0) {
    d.stdout.write(JSON.stringify({ errors }, null, 2) + "\n");
    return { exitCode: 1, errors };
  }

  d.stdout.write(d.renderer.render(config, format));

  const report: RunReport = {
    mode: "preview",
    createdDirectories: 0,
    copiedFiles: 0,
    skippedFiles: 0,
    overwrittenFiles: 0,
    errors: 0,
    missingResources: 0,
  };
  await emitReport(d, report, reportFile);
  return { exitCode: 0, report };
}

async function runExecute(
  d: CliDeps,
  config: Config,
  options: RunOptions,
  reportFile: string | undefined,
): Promise<CliRunOutput> {
  // GenerateStructureUseCase 内部会先做校验，配置非法时不会执行任何文件操作。
  const result = await d.generator.run(config, options);
  const report = d.reporter.fromRunResult(result);

  if (result.errors.length > 0) {
    d.stderr.write(JSON.stringify({ errors: result.errors }, null, 2) + "\n");
  }
  await emitReport(d, report, reportFile);
  return {
    exitCode: result.errors.length > 0 ? 1 : 0,
    errors: result.errors,
    report,
  };
}

async function runCheck(
  d: CliDeps,
  config: Config,
  reportFile: string | undefined,
): Promise<CliRunOutput> {
  const result = await d.checker.check(config);
  const report = d.reporter.fromCheckResult(result);

  if (result.validationErrors.length > 0 || result.missingResources.length > 0) {
    d.stdout.write(
      JSON.stringify(
        {
          validationErrors: result.validationErrors,
          missingResources: result.missingResources,
        },
        null,
        2,
      ) + "\n",
    );
  }
  await emitReport(d, report, reportFile);
  const failed =
    result.validationErrors.length > 0 || result.missingResources.length > 0;
  return {
    exitCode: failed ? 1 : 0,
    errors: result.validationErrors,
    report,
  };
}
