import { runCli } from "../src/cliMain";
import type { IConfigLoader } from "../src/infra/configLoader";
import type { INodeValidator } from "../src/domain/validator";
import type { Config, ErrorRecord } from "../src/domain/types";

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

const sampleConfig: Config = {
  workspace: "D:/workspace",
  structure: [
    {
      type: "category",
      name: "CategoryA",
      children: [
        { type: "category", name: "CategoryB", children: [] },
        { type: "material", name: "c.tcad", resource: "d:/tcad/c.tcad" },
        { type: "material", name: "c.pdf", resource: "d:/pdf/c.pdf" },
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
    expect(stderr.get()).toContain("用法：node dist/cli.js --config");
  });

  test("errors 为空应退出 0 并输出目录树文本（不创建目录、不拷贝文件）", async () => {
    const stdout = makeWriter();
    const stderr = makeWriter();
    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], {
      loader: new FakeLoader(sampleConfig),
      validator: new FakeValidator([]),
      stdout: stdout.writer,
      stderr: stderr.writer,
    });
    expect(out.exitCode).toBe(0);
    expect(stderr.get()).toBe("");
    expect(stdout.get()).toContain("D:/workspace/");
    expect(stdout.get()).toContain("CategoryA/");
    expect(stdout.get()).toContain("CategoryB/");
    expect(stdout.get()).toContain("c.tcad");
    expect(stdout.get()).toContain("c.pdf");
    expect(stdout.get()).toContain("c.tcad从d:/tcad/c.tcad拷贝");
    expect(stdout.get()).toContain("c.pdf从d:/pdf/c.pdf拷贝");
  });

  test("errors 非空应退出 1", async () => {
    const stdout = makeWriter();
    const stderr = makeWriter();
    const out = await runCli(["node", "cli.js", "--config", "/cfg.json"], {
      loader: new FakeLoader({ workspace: "/ws", structure: [] }),
      validator: new FakeValidator([{ code: "X", message: "bad" }]),
      stdout: stdout.writer,
      stderr: stderr.writer,
    });
    expect(out.exitCode).toBe(1);
    expect(stdout.get()).toContain("\"errors\"");
  });
});
