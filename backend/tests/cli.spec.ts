import * as path from "node:path";
import { runCli } from "../src/cliMain";
import type { IConfigLoader } from "../src/infra/configLoader";
import type { INodeValidator } from "../src/domain/validator";
import type { Config, ErrorRecord } from "../src/domain/types";
import { InMemoryFileSystem } from "./inMemoryFileSystem";

class FakeLoader implements IConfigLoader {
  constructor(private readonly config: Config) {}
  async loadFromFile(): Promise<Config> {
    return this.config;
  }
}

class ExplodingLoader implements IConfigLoader {
  async loadFromFile(): Promise<Config> {
    throw new Error("loader should not be called");
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

function validConfig(): Config {
  return {
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
}

function seededFs(): InMemoryFileSystem {
  const fs = new InMemoryFileSystem();
  fs.files.set("/src/c.tcad", "content-tcad");
  fs.files.set("/src/c.pdf", "content-pdf");
  return fs;
}

describe("CLI", () => {
  test("缺少 --config 应输出用法并退出 1", async () => {
    const stdout = makeWriter();
    const stderr = makeWriter();
    const out = await runCli(["node", "cli.js"], {
      stdout: stdout.writer,
      stderr: stderr.writer,
    });
    expect(out.exitCode).toBe(1);
    expect(stderr.get()).toContain("用法：node dist/cli.js --config");
  });

  test("无效的 --mode 值应退出 1 并在 stderr 给出原因", async () => {
    const stderr = makeWriter();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "bogus"],
      { stderr: stderr.writer, loader: new FakeLoader(validConfig()) },
    );
    expect(out.exitCode).toBe(1);
    expect(stderr.get()).toContain("无效的 --mode");
  });

  test("无效的 --skip 值应退出 1 并在 stderr 给出原因", async () => {
    const stderr = makeWriter();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--skip", "yes"],
      { stderr: stderr.writer, loader: new FakeLoader(validConfig()) },
    );
    expect(out.exitCode).toBe(1);
    expect(stderr.get()).toContain("无效的 --skip");
  });

  test("preview 模式（默认）：errors 为空应输出文本目录树并退出 0", async () => {
    const stdout = makeWriter();
    const stderr = makeWriter();
    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], {
      loader: new FakeLoader(validConfig()),
      stdout: stdout.writer,
      stderr: stderr.writer,
    });
    expect(out.exitCode).toBe(0);
    expect(stderr.get()).toBe("");
    expect(stdout.get()).toContain("/ws/");
    expect(stdout.get()).toContain("CategoryA/");
    expect(stdout.get()).toContain("CategoryB/");
    expect(stdout.get()).toContain("c.tcad");
    expect(stdout.get()).toContain("c.pdf");
    expect(stdout.get()).toContain("c.tcad从/src/c.tcad拷贝");
    expect(stdout.get()).toContain("c.pdf从/src/c.pdf拷贝");
    expect(stdout.get()).toContain("====");
  });

  test("preview 模式（默认）：errors 非空应输出文本错误信息并退出 1", async () => {
    const stdout = makeWriter();
    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], {
      loader: new FakeLoader({ workspace: "/ws", structure: [] }),
      validator: new FakeValidator([{ code: "X", message: "bad" }]),
      stdout: stdout.writer,
    });
    expect(out.exitCode).toBe(1);
    expect(stdout.get()).toContain("配置校验失败");
    expect(stdout.get()).toContain("[X]");
    expect(stdout.get()).toContain("bad");
  });

  test("--format json：校验通过时输出 JSON 结构", async () => {
    const stdout = makeWriter();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--format", "json"],
      { loader: new FakeLoader(validConfig()), stdout: stdout.writer },
    );
    expect(out.exitCode).toBe(0);
    expect(stdout.get()).toContain('"workspace"');
    expect(stdout.get()).toContain('"structure"');
    expect(stdout.get()).toContain('"copies"');
    expect(stdout.get()).toContain('"report"');
  });

  test("--format json：校验失败时输出 JSON errors", async () => {
    const stdout = makeWriter();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--format", "json"],
      {
        loader: new FakeLoader({ workspace: "/ws", structure: [] }),
        validator: new FakeValidator([{ code: "X", message: "bad" }]),
        stdout: stdout.writer,
      },
    );
    expect(out.exitCode).toBe(1);
    expect(stdout.get()).toContain('"errors"');
    expect(stdout.get()).toContain('"X"');
  });

  test("--format markdown：输出标题、目录树代码块与拷贝表格", async () => {
    const stdout = makeWriter();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--format", "markdown"],
      { loader: new FakeLoader(validConfig()), stdout: stdout.writer },
    );
    expect(out.exitCode).toBe(0);
    expect(stdout.get()).toContain("# 目录结构清单");
    expect(stdout.get()).toContain("```text");
    expect(stdout.get()).toContain("## 拷贝清单");
    expect(stdout.get()).toContain("| 名称 | 来源 | 目标 |");
    expect(stdout.get()).toContain("## 执行报告");
  });

  test("execute 模式：成功创建目录并拷贝文件，报告计数正确", async () => {
    const stdout = makeWriter();
    const fs = seededFs();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "execute"],
      {
        loader: new FakeLoader(validConfig()),
        fileSystem: fs,
        stdout: stdout.writer,
      },
    );
    expect(out.exitCode).toBe(0);
    expect(fs.dirs.has(path.normalize("/ws"))).toBe(true);
    expect(fs.dirs.has(path.join("/ws", "CategoryA"))).toBe(true);
    expect(fs.dirs.has(path.join("/ws", "CategoryA", "CategoryB"))).toBe(true);
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.tcad"))).toBe("content-tcad");
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.pdf"))).toBe("content-pdf");
    expect(out.report?.createdDirectories).toBe(3);
    expect(out.report?.copiedFiles).toBe(2);
    expect(out.report?.errors).toBe(0);
  });

  test("execute 模式：--overwrite true 覆盖已存在目标并计入 overwrittenFiles", async () => {
    const fs = seededFs();
    const dst = path.join("/ws", "CategoryA", "c.tcad");
    fs.files.set(dst, "old");
    const out = await runCli(
      [
        "node",
        "cli.js",
        "--config",
        "/cfg.json",
        "--mode",
        "execute",
        "--overwrite",
        "true",
      ],
      { loader: new FakeLoader(validConfig()), fileSystem: fs },
    );
    expect(out.exitCode).toBe(0);
    expect(out.report?.overwrittenFiles).toBe(1);
    expect(out.report?.copiedFiles).toBe(1);
    expect(fs.files.get(dst)).toBe("content-tcad");
  });

  test("execute 模式：默认 skipIfExists 下已存在目标应被跳过", async () => {
    const fs = seededFs();
    const dst = path.join("/ws", "CategoryA", "c.tcad");
    fs.files.set(dst, "keep-me");
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "execute"],
      { loader: new FakeLoader(validConfig()), fileSystem: fs },
    );
    expect(out.exitCode).toBe(0);
    expect(out.report?.skippedFiles).toBe(1);
    expect(fs.files.get(dst)).toBe("keep-me");
  });

  test("execute 模式：配置错误时绝不执行任何文件写操作", async () => {
    const fs = seededFs();
    const dirsBefore = fs.dirs.size;
    const writesBefore = fs.writeLog.length;
    const badConfig: Config = {
      workspace: "/ws",
      structure: [
        { type: "material", name: "dup", resource: "/src/c.tcad" },
        { type: "material", name: "dup", resource: "/src/c.pdf" },
      ],
    };
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "execute"],
      { loader: new FakeLoader(badConfig), fileSystem: fs },
    );
    expect(out.exitCode).toBe(1);
    expect(fs.dirs.size).toBe(dirsBefore);
    expect(fs.writeLog.length).toBe(writesBefore);
    expect(fs.files.get(path.join("/ws", "dup"))).toBeUndefined();
    expect(out.report?.errors).toBeGreaterThan(0);
  });

  test("check 模式：发现缺失资源并退出 1，且不执行写操作", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/c.tcad", "content-tcad");
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "check"],
      {
        loader: new FakeLoader(validConfig()),
        fileSystem: fs,
        stdout: makeWriter().writer,
      },
    );
    expect(out.exitCode).toBe(1);
    expect(out.report?.missingResources).toBe(1);
    expect(out.report?.createdDirectories).toBe(0);
    expect(out.report?.copiedFiles).toBe(0);
    expect(fs.dirs.size).toBe(0);
    expect(fs.writeLog).toHaveLength(0);
    expect(fs.files.has("/src/c.pdf")).toBe(false);
  });

  test("check 模式：全部资源存在时退出 0", async () => {
    const fs = seededFs();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "check"],
      { loader: new FakeLoader(validConfig()), fileSystem: fs },
    );
    expect(out.exitCode).toBe(0);
    expect(out.report?.missingResources).toBe(0);
    expect(out.report?.errors).toBe(0);
  });

  test("preview 模式：不写盘、不拷贝、不创建目录（即使传入 fileSystem）", async () => {
    const fs = seededFs();
    const dirsBefore = fs.dirs.size;
    const filesBefore = fs.files.size;
    const writesBefore = fs.writeLog.length;
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json"],
      { loader: new FakeLoader(validConfig()), fileSystem: fs, stdout: makeWriter().writer },
    );
    expect(out.exitCode).toBe(0);
    expect(fs.dirs.size).toBe(dirsBefore);
    expect(fs.files.size).toBe(filesBefore);
    expect(fs.writeLog.length).toBe(writesBefore);
  });

  test("--report <path>：报告写入指定文件而非 stdout", async () => {
    const stdout = makeWriter();
    const fs = seededFs();
    const out = await runCli(
      [
        "node",
        "cli.js",
        "--config",
        "/cfg.json",
        "--mode",
        "execute",
        "--report",
        "/out/report.txt",
      ],
      { loader: new FakeLoader(validConfig()), fileSystem: fs, stdout: stdout.writer },
    );
    expect(out.exitCode).toBe(0);
    expect(fs.writeLog.some((w) => w.path === "/out/report.txt")).toBe(true);
    const reportContent = fs.files.get("/out/report.txt") ?? "";
    expect(reportContent).toContain("====");
    expect(reportContent).toContain("模式: 执行");
    // stdout 只含主输出，不含报告分隔线
    expect(stdout.get()).not.toContain("====");
  });

  test("--report -：报告输出到 stdout", async () => {
    const stdout = makeWriter();
    const fs = seededFs();
    await runCli(
      [
        "node",
        "cli.js",
        "--config",
        "/cfg.json",
        "--mode",
        "execute",
        "--report",
        "-",
      ],
      { loader: new FakeLoader(validConfig()), fileSystem: fs, stdout: stdout.writer },
    );
    expect(stdout.get()).toContain("====");
    expect(fs.writeLog).toHaveLength(0);
  });

  test("execute 模式下 loader 失败应直接退出 1 且不触发任何用例", async () => {
    const fs = seededFs();
    const out = await runCli(
      ["node", "cli.js", "--config", "/cfg.json", "--mode", "execute"],
      { loader: new ExplodingLoader(), fileSystem: fs, stderr: makeWriter().writer },
    );
    expect(out.exitCode).toBe(1);
    expect(fs.dirs.size).toBe(0);
    expect(fs.writeLog).toHaveLength(0);
  });
});
