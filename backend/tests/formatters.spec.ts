import "reflect-metadata";
import { TextFormatter } from "../src/infra/formatters/textFormatter";
import { JsonFormatter } from "../src/infra/formatters/jsonFormatter";
import { MarkdownFormatter } from "../src/infra/formatters/markdownFormatter";
import type { Config, RunResult } from "../src/domain/types";

const testConfig: Config = {
  description: "Test config",
  workspace: "/workspace",
  structure: [
    {
      type: "category",
      name: "FolderA",
      children: [
        { type: "material", name: "file.tcad", resource: "/res/file.tcad" },
      ],
    },
  ],
};

const testResult: RunResult = {
  createdDirectories: ["/workspace", "/workspace/FolderA"],
  copiedFiles: [{ src: "/res/file.tcad", dst: "/workspace/FolderA/file.tcad" }],
  overwrittenFiles: [],
  skippedFiles: [],
  missingResources: [],
  errors: [],
};

describe("TextFormatter", () => {
  test("预览模式（result=null）应输出文本目录树", () => {
    const f = new TextFormatter();
    const out = f.render(testConfig, null);
    expect(out).toContain("/workspace/");
    expect(out).toContain("FolderA/");
    expect(out).toContain("file.tcad");
    expect(out).toContain("file.tcad从/res/file.tcad拷贝");
  });

  test("format 属性应为 text", () => {
    expect(new TextFormatter().format).toBe("text");
  });
});

describe("JsonFormatter", () => {
  test("预览模式（result=null）应输出合法 JSON 包含 workspace 和 structure", () => {
    const f = new JsonFormatter();
    const out = f.render(testConfig, null);
    const parsed = JSON.parse(out);
    expect(parsed.workspace).toBe("/workspace");
    expect(parsed.structure).toHaveLength(1);
    expect(parsed.report).toBeUndefined();
  });

  test("执行模式应在 JSON 中包含 report 字段", () => {
    const f = new JsonFormatter();
    const out = f.render(testConfig, testResult);
    const parsed = JSON.parse(out);
    expect(parsed.report).toBeDefined();
    expect(parsed.report.createdDirectories).toBe(2);
    expect(parsed.report.copiedFiles).toBe(1);
    expect(parsed.report.errors).toBe(0);
  });

  test("format 属性应为 json", () => {
    expect(new JsonFormatter().format).toBe("json");
  });
});

describe("MarkdownFormatter", () => {
  test("应输出 Markdown 标题和目录树代码块", () => {
    const f = new MarkdownFormatter();
    const out = f.render(testConfig, null);
    expect(out).toContain("# 目录结构：/workspace/");
    expect(out).toContain("```");
    expect(out).toContain("FolderA/");
  });

  test("应包含拷贝说明表格", () => {
    const f = new MarkdownFormatter();
    const out = f.render(testConfig, null);
    expect(out).toContain("## 拷贝说明");
    expect(out).toContain("| 目标文件名 | 来源路径 | 说明 |");
    expect(out).toContain("| file.tcad | /res/file.tcad |  |");
  });

  test("有 result 时应包含执行报告章节", () => {
    const f = new MarkdownFormatter();
    const out = f.render(testConfig, testResult);
    expect(out).toContain("## 执行报告");
    expect(out).toContain("- 创建目录数：2");
    expect(out).toContain("- 拷贝文件数：1");
  });

  test("format 属性应为 markdown", () => {
    expect(new MarkdownFormatter().format).toBe("markdown");
  });
});
