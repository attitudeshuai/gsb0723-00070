import "reflect-metadata";
import { Container } from "inversify";
import { runCli } from "../src/cliMain";
import type { IConfigLoader } from "../src/infra/configLoader";
import type { INodeValidator } from "../src/domain/validator";
import type { IRunnerService } from "../src/application/runnerService";
import type { IFormatter } from "../src/domain/formatter";
import type { IReportRenderer } from "../src/domain/reporter";
import type { Config, ErrorRecord, RunResult } from "../src/domain/types";
import { TextFormatter } from "../src/infra/formatters/textFormatter";
import { JsonFormatter } from "../src/infra/formatters/jsonFormatter";
import { MarkdownFormatter } from "../src/infra/formatters/markdownFormatter";
import { TextReportRenderer } from "../src/infra/reportRenderer";
import { DI_TYPES } from "../src/di/types";

class FakeLoader implements IConfigLoader {
  constructor(private readonly config: Config) {}
  async loadFromFile(): Promise<Config> {
    return this.config;
  }
}

class FakeValidator implements INodeValidator {
  constructor(private readonly errors: ErrorRecord[]) {}
  validate(): ErrorRecord[] {
    return this.errors;
  }
}

class FakeRunner implements IRunnerService {
  public lastOptions: unknown;
  public runCalled = false;
  public checkCalled = false;

  constructor(private readonly runResult: RunResult, private readonly checkResult: RunResult) {}

  async loadAndRun() { return this.runResult; }
  async runWithConfig(_config: Config, options?: unknown) {
    this.runCalled = true;
    this.lastOptions = options;
    return this.runResult;
  }
  async loadAndCheck() { return this.checkResult; }
  async checkWithConfig() {
    this.checkCalled = true;
    return this.checkResult;
  }
}

function makeWriter() {
  let out = "";
  return {
    writer: { write: (s: string) => (out += s) },
    get: () => out,
  };
}

function makeFileWriter() {
  const files = new Map<string, string>();
  return {
    writer: async (p: string, c: string) => { files.set(p, c); },
    files,
  };
}

function successResult(): RunResult {
  return {
    createdDirectories: ["/ws", "/ws/A"],
    copiedFiles: [{ src: "/src/a", dst: "/ws/A/a" }],
    overwrittenFiles: [],
    skippedFiles: [],
    missingResources: [],
    errors: [],
  };
}

const validConfig: Config = {
  workspace: "D:/workspace",
  structure: [
    {
      type: "category",
      name: "CategoryA",
      children: [
        { type: "material", name: "c.tcad", resource: "d:/tcad/c.tcad" },
      ],
    },
  ],
};

describe("CLI", () => {
  test("缺少 --config 应输出用法并退出 1", async () => {
    const stdout = makeWriter();
    const stderr = makeWriter();
    const out = await runCli(["node", "cli.js"], {
      stdout: stdout.writer,
      stderr: stderr.writer,
    });
    expect(out.exitCode).toBe(1);
    expect(stderr.get()).toContain("用法：");
  });

  test("--help 应输出帮助并退出 0", async () => {
    const stdout = makeWriter();
    const out = await runCli(["node", "cli.js", "--help"], {
      stdout: stdout.writer,
    });
    expect(out.exitCode).toBe(0);
    expect(stdout.get()).toContain("--execute");
    expect(stdout.get()).toContain("--check");
  });

  test("预览模式：errors 为空应退出 0 并输出目录树文本（不创建目录、不拷贝文件）", async () => {
    const stdout = makeWriter();
    const stderr = makeWriter();
    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], {
      loader: new FakeLoader(validConfig),
      validator: new FakeValidator([]),
      stdout: stdout.writer,
      stderr: stderr.writer,
    });
    expect(out.exitCode).toBe(0);
    expect(stderr.get()).toBe("");
    expect(stdout.get()).toContain("D:/workspace/");
    expect(stdout.get()).toContain("CategoryA/");
    expect(stdout.get()).toContain("c.tcad");
    expect(stdout.get()).toContain("c.tcad从d:/tcad/c.tcad拷贝");
  });

  test("预览模式：errors 非空应退出 1", async () => {
    const stdout = makeWriter();
    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], {
      loader: new FakeLoader({ workspace: "/ws", structure: [] }),
      validator: new FakeValidator([{ code: "X", message: "bad" }]),
      stdout: stdout.writer,
    });
    expect(out.exitCode).toBe(1);
    expect(stdout.get()).toContain("\"errors\"");
  });

  test("执行模式：--execute 应调用 runner.runWithConfig 并输出报告", async () => {
    const stdout = makeWriter();
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
      },
    );
    expect(out.exitCode).toBe(0);
    expect(runner.runCalled).toBe(true);
    expect(runner.checkCalled).toBe(false);
    expect(stdout.get()).toContain("执行报告");
    expect(stdout.get()).toContain("创建目录数：2");
    expect(stdout.get()).toContain("拷贝文件数：1");
  });

  test("执行模式：默认 skipIfExists=true, overwrite=false", async () => {
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: { write: () => {} },
      },
    );
    expect(runner.lastOptions).toEqual({ overwrite: false });
  });

  test("执行模式：--overwrite 应设置 overwrite=true", async () => {
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--overwrite"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: { write: () => {} },
      },
    );
    expect(runner.lastOptions).toEqual({ overwrite: true });
  });

  test("执行模式：--no-skip 应设置 skipIfExists=false", async () => {
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--no-skip"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: { write: () => {} },
      },
    );
    expect(runner.lastOptions).toEqual({ skipIfExists: false, overwrite: false });
  });

  test("检查模式：--check 应调用 runner.checkWithConfig 并报告缺失资源", async () => {
    const stdout = makeWriter();
    const checkRes: RunResult = {
      createdDirectories: [],
      copiedFiles: [],
      overwrittenFiles: [],
      skippedFiles: [],
      missingResources: ["d:/missing/file.tcad"],
      errors: [],
    };
    const runner = new FakeRunner(successResult(), checkRes);

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--check"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
      },
    );
    expect(out.exitCode).toBe(1);
    expect(runner.checkCalled).toBe(true);
    expect(runner.runCalled).toBe(false);
    expect(stdout.get()).toContain("检查报告");
    expect(stdout.get()).toContain("缺失资源数：1");
    expect(stdout.get()).toContain("d:/missing/file.tcad");
  });

  test("检查模式：配置校验错误应退出 1", async () => {
    const checkRes: RunResult = {
      createdDirectories: [],
      copiedFiles: [],
      overwrittenFiles: [],
      skippedFiles: [],
      missingResources: [],
      errors: [{ code: "ConfigValidationError", message: "bad", nodePath: "workspace" }],
    };
    const runner = new FakeRunner(successResult(), checkRes);

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    const stdout = makeWriter();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--check"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
      },
    );
    expect(out.exitCode).toBe(1);
    expect(stdout.get()).toContain("错误数：1");
  });

  test("JSON 格式输出：--format json 应输出 JSON", async () => {
    const stdout = makeWriter();
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--format", "json"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
      },
    );
    const parsed = JSON.parse(stdout.get());
    expect(parsed.workspace).toBe("D:/workspace");
    expect(parsed.report).toBeDefined();
    expect(parsed.report.createdDirectories).toBe(2);
    expect(parsed.report.copiedFiles).toBe(1);
  });

  test("Markdown 格式输出：--format markdown 应包含表格", async () => {
    const stdout = makeWriter();
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--format", "markdown"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
      },
    );
    expect(stdout.get()).toContain("# 目录结构");
    expect(stdout.get()).toContain("## 拷贝说明");
    expect(stdout.get()).toContain("| 目标文件名 |");
    expect(stdout.get()).toContain("## 执行报告");
  });

  test("--report 应将报告写入指定文件", async () => {
    const stdout = makeWriter();
    const fw = makeFileWriter();
    const runRes = successResult();
    const runner = new FakeRunner(runRes, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--report", "/tmp/report.txt"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
        fileWriter: fw.writer,
      },
    );
    expect(fw.files.has("/tmp/report.txt")).toBe(true);
    expect(fw.files.get("/tmp/report.txt")).toContain("执行报告");
    expect(stdout.get()).not.toContain("===== 执行报告 =====");
  });

  test("未传 --execute 或 --check 时绝不调用 runner（不写盘）", async () => {
    const runner = new FakeRunner(successResult(), {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    await runCli(
      ["node", "cli.js", "--config", "/cfg.json"],
      {
        loader: new FakeLoader(validConfig),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: { write: () => {} },
      },
    );
    expect(runner.runCalled).toBe(false);
    expect(runner.checkCalled).toBe(false);
  });

  test("配置校验错误时不执行文件操作（--execute 模式）", async () => {
    const stdout = makeWriter();
    const errResult: RunResult = {
      createdDirectories: [],
      copiedFiles: [],
      overwrittenFiles: [],
      skippedFiles: [],
      missingResources: [],
      errors: [{ code: "ConfigValidationError", message: "workspace 必须为非空字符串", nodePath: "workspace" }],
    };
    const runner = new FakeRunner(errResult, {
      createdDirectories: [], copiedFiles: [], overwrittenFiles: [], skippedFiles: [], missingResources: [], errors: [],
    });

    const c = new Container();
    c.bind(DI_TYPES.TextFormatter).to(TextFormatter);
    c.bind(DI_TYPES.JsonFormatter).to(JsonFormatter);
    c.bind(DI_TYPES.MarkdownFormatter).to(MarkdownFormatter);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute"],
      {
        loader: new FakeLoader({ workspace: "", structure: [] }),
        validator: new FakeValidator([]),
        runner,
        reportRenderer: new TextReportRenderer(),
        formatters: {
          text: c.get<IFormatter>(DI_TYPES.TextFormatter),
          json: c.get<IFormatter>(DI_TYPES.JsonFormatter),
          markdown: c.get<IFormatter>(DI_TYPES.MarkdownFormatter),
        },
        stdout: stdout.writer,
      },
    );
    expect(out.exitCode).toBe(1);
    expect(runner.runCalled).toBe(true);
    expect(out.errors).toHaveLength(1);
    expect(out.errors![0]!.code).toBe("ConfigValidationError");
  });
});
