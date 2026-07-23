import "reflect-metadata";
import * as path from "node:path";
import { runCli } from "../src/cliMain";
import type { CliDeps } from "../src/cliMain";
import type { Config, ErrorRecord } from "../src/domain/types";
import type { IConfigLoader } from "../src/infra/configLoader";
import type { INodeValidator } from "../src/domain/validator";
import { NodeValidator } from "../src/domain/validator";
import { GenerateStructureUseCase } from "../src/application/generateStructureUseCase";
import { CheckResourcesUseCase } from "../src/application/checkResourcesUseCase";
import {
  JsonStructureFormatter,
  MarkdownStructureFormatter,
  TextStructureFormatter,
} from "../src/presentation/structureFormatter";
import { StructureRenderer } from "../src/presentation/structureRenderer";
import { Reporter } from "../src/presentation/reporter";
import { InMemoryFileSystem } from "./inMemoryFileSystem";

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

function makeWriter() {
  let out = "";
  return {
    writer: { write: (s: string) => (out += s) },
    get: () => out,
  };
}

/** 使用真实用例 + 内存文件系统组装完整的 CLI 依赖。 */
function buildDeps(
  config: Config,
  fs: InMemoryFileSystem,
  overrides?: Partial<CliDeps>,
): { deps: Partial<CliDeps>; stdout: () => string; stderr: () => string } {
  const validator = new NodeValidator();
  const stdout = makeWriter();
  const stderr = makeWriter();
  const renderer = new StructureRenderer([
    new TextStructureFormatter(),
    new JsonStructureFormatter(),
    new MarkdownStructureFormatter(),
  ]);
  const deps: Partial<CliDeps> = {
    loader: new FakeLoader(config),
    validator,
    fileSystem: fs,
    generator: new GenerateStructureUseCase(validator, fs),
    checker: new CheckResourcesUseCase(validator, fs),
    renderer,
    reporter: new Reporter(),
    stdout: stdout.writer,
    stderr: stderr.writer,
    ...overrides,
  };
  return { deps, stdout: stdout.get, stderr: stderr.get };
}

const validConfig: Config = {
  workspace: "/ws",
  structure: [
    {
      type: "category",
      name: "CategoryA",
      children: [
        { type: "category", name: "CategoryB", children: [] },
        { type: "material", name: "c.tcad", resource: "/src/c.tcad" },
        { type: "material", name: "c.pdf", resource: "/src/c.pdf" },
      ],
    },
  ],
};

function seedResources(fs: InMemoryFileSystem): void {
  fs.files.set("/src/c.tcad", "content-tcad");
  fs.files.set("/src/c.pdf", "content-pdf");
}

describe("CLI 执行模式 (--execute)", () => {
  test("成功创建目录并拷贝文件，报告统计正确", async () => {
    const fs = new InMemoryFileSystem();
    seedResources(fs);
    const { deps, stdout, stderr } = buildDeps(validConfig, fs);

    const out = await runCli(["node", "cli.js", "--config", "/cfg.json", "--execute"], deps);

    expect(out.exitCode).toBe(0);
    expect(stderr()).toBe("");
    // 真正写盘
    expect(fs.dirs.has(path.normalize("/ws"))).toBe(true);
    expect(fs.dirs.has(path.join("/ws", "CategoryA"))).toBe(true);
    expect(fs.dirs.has(path.join("/ws", "CategoryA", "CategoryB"))).toBe(true);
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.tcad"))).toBe("content-tcad");
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.pdf"))).toBe("content-pdf");
    // 报告
    expect(out.report?.mode).toBe("execute");
    expect(out.report?.copiedFiles).toBe(2);
    expect(out.report?.createdDirectories).toBe(3);
    expect(out.report?.errors).toBe(0);
    expect(stdout()).toContain("拷贝文件数：2");
  });

  test("默认策略为 skip：已存在目标应跳过，不覆盖", async () => {
    const fs = new InMemoryFileSystem();
    seedResources(fs);
    fs.files.set(path.join("/ws", "CategoryA", "c.tcad"), "old");
    const { deps } = buildDeps(validConfig, fs);

    const out = await runCli(["node", "cli.js", "--config", "/cfg.json", "--execute"], deps);

    expect(out.exitCode).toBe(0);
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.tcad"))).toBe("old");
    expect(out.report?.skippedFiles).toBe(1);
    expect(out.report?.overwrittenFiles).toBe(0);
    expect(out.report?.copiedFiles).toBe(1);
  });

  test("--strategy overwrite 应覆盖已存在目标并计入覆盖数", async () => {
    const fs = new InMemoryFileSystem();
    seedResources(fs);
    fs.files.set(path.join("/ws", "CategoryA", "c.tcad"), "old");
    const { deps } = buildDeps(validConfig, fs);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--strategy", "overwrite"],
      deps,
    );

    expect(out.exitCode).toBe(0);
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.tcad"))).toBe("content-tcad");
    expect(out.report?.overwrittenFiles).toBe(1);
    expect(out.report?.skippedFiles).toBe(0);
    expect(out.report?.copiedFiles).toBe(2);
  });

  test("错误配置下不执行任何文件操作", async () => {
    const fs = new InMemoryFileSystem();
    const badConfig: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "A",
          children: [
            { type: "material", name: "dup", resource: "/src/a" },
            { type: "material", name: "dup", resource: "/src/b" },
          ],
        },
      ],
    };
    const { deps } = buildDeps(badConfig, fs);

    const out = await runCli(["node", "cli.js", "--config", "/cfg.json", "--execute"], deps);

    expect(out.exitCode).toBe(1);
    expect(fs.dirs.size).toBe(0);
    expect(fs.files.size).toBe(0);
    expect(out.report?.errors).toBeGreaterThan(0);
    expect(out.report?.copiedFiles).toBe(0);
  });
});

describe("CLI 检查模式 (--check)", () => {
  test("资源齐全时通过且不写盘", async () => {
    const fs = new InMemoryFileSystem();
    seedResources(fs);
    const { deps, stdout } = buildDeps(validConfig, fs);

    const out = await runCli(["node", "cli.js", "--config", "/cfg.json", "--check"], deps);

    expect(out.exitCode).toBe(0);
    expect(fs.dirs.size).toBe(0);
    expect(fs.files.size).toBe(2); // 仅初始资源，未新增
    expect(out.report?.mode).toBe("check");
    expect(out.report?.missingResources).toBe(0);
    expect(stdout()).toContain("缺失资源数：0");
  });

  test("发现缺失/不可读资源时报告并退出 1，且不写盘", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/c.tcad", "content-tcad");
    // /src/c.pdf 缺失
    const { deps, stdout } = buildDeps(validConfig, fs);

    const out = await runCli(["node", "cli.js", "--config", "/cfg.json", "--check"], deps);

    expect(out.exitCode).toBe(1);
    expect(fs.dirs.size).toBe(0);
    expect(out.report?.missingResources).toBe(1);
    expect(stdout()).toContain("/src/c.pdf");
    expect(stdout()).toContain("缺失资源数：1");
  });
});

describe("CLI 输出格式切换", () => {
  test("--format json 输出 JSON 结构", async () => {
    const fs = new InMemoryFileSystem();
    const { deps, stdout } = buildDeps(validConfig, fs);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--format", "json"],
      deps,
    );

    expect(out.exitCode).toBe(0);
    const text = stdout();
    // JSON 应可被解析出结构树
    const jsonStart = text.indexOf("{");
    const parsed = JSON.parse(text.slice(jsonStart, text.indexOf("=====")).trim());
    expect(parsed.workspace).toBe("/ws");
    expect(Array.isArray(parsed.structure)).toBe(true);
  });

  test("--format markdown 输出目录树与拷贝表格", async () => {
    const fs = new InMemoryFileSystem();
    const { deps, stdout } = buildDeps(validConfig, fs);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--format", "markdown"],
      deps,
    );

    expect(out.exitCode).toBe(0);
    const text = stdout();
    expect(text).toContain("## 目录树");
    expect(text).toContain("## 拷贝说明");
    expect(text).toContain("| 文件 | 来源 |");
    expect(text).toContain("| c.tcad | /src/c.tcad |");
  });

  test("不支持的格式应退出 1", async () => {
    const fs = new InMemoryFileSystem();
    const { deps, stderr } = buildDeps(validConfig, fs);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--format", "xml"],
      deps,
    );

    expect(out.exitCode).toBe(1);
    expect(stderr()).toContain("不支持的输出格式");
  });
});

describe("CLI 默认预览模式绝不写盘", () => {
  test("未传执行参数时不创建目录、不拷贝文件", async () => {
    const fs = new InMemoryFileSystem();
    seedResources(fs);
    const { deps, stdout } = buildDeps(validConfig, fs);

    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], deps);

    expect(out.exitCode).toBe(0);
    expect(fs.dirs.size).toBe(0);
    expect(fs.files.size).toBe(2); // 未新增文件
    expect(out.report?.mode).toBe("preview");
    expect(stdout()).toContain("/ws/");
  });
});

describe("CLI 报告输出到文件", () => {
  test("--report-file 时报告写入文件而非 stdout", async () => {
    const fs = new InMemoryFileSystem();
    seedResources(fs);
    const { deps, stdout } = buildDeps(validConfig, fs);

    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--execute", "--report-file", "/out/report.txt"],
      deps,
    );

    expect(out.exitCode).toBe(0);
    const reportContent = fs.files.get("/out/report.txt");
    expect(reportContent).toContain("执行汇总");
    expect(reportContent).toContain("拷贝文件数：2");
    // stdout 不应包含汇总
    expect(stdout()).not.toContain("执行汇总");
  });
});
