import "reflect-metadata";
import * as path from "node:path";
import { Container } from "inversify";
import { GenerateStructureUseCase } from "../src/application/generateStructureUseCase";
import { NodeValidator } from "../src/domain/validator";
import type { Config } from "../src/domain/types";
import { DI_TYPES } from "../src/di/types";
import { InMemoryFileSystem } from "./inMemoryFileSystem";

function buildTestContainer(fs?: InMemoryFileSystem): Container {
  const c = new Container({ defaultScope: "Singleton" });
  c.bind(DI_TYPES.NodeValidator).to(NodeValidator);
  c.bind(DI_TYPES.FileSystem).toConstantValue(fs ?? new InMemoryFileSystem());
  c.bind(DI_TYPES.GenerateStructureUseCase).to(GenerateStructureUseCase);
  return c;
}

describe("GenerateStructureUseCase", () => {
  test("配置有效时应返回空错误列表并创建目录、拷贝文件", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/c.tcad", "content-tcad");
    fs.files.set("/src/c.pdf", "content-pdf");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "CategoryA",
          children: [
            { type: "category", name: "CategoryB", children: [] },
            { type: "material", name: "c.tcad", description: "A sample", resource: "/src/c.tcad" },
            { type: "material", name: "c.pdf", description: "A sample", resource: "/src/c.pdf" },
          ],
        },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<GenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase);
    const result = await uc.run(cfg);

    expect(result.errors).toHaveLength(0);
    expect(result.createdDirectories).toContain(path.normalize("/ws"));
    expect(result.createdDirectories).toContain(path.join("/ws", "CategoryA"));
    expect(result.createdDirectories).toContain(path.join("/ws", "CategoryA", "CategoryB"));
    expect(result.copiedFiles).toHaveLength(2);
    const copySrcDst = result.copiedFiles.map((e) => ({ src: e.src, dst: e.dst }));
    expect(copySrcDst).toContainEqual({ src: "/src/c.tcad", dst: path.join("/ws", "CategoryA", "c.tcad") });
    expect(copySrcDst).toContainEqual({ src: "/src/c.pdf", dst: path.join("/ws", "CategoryA", "c.pdf") });
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.tcad"))).toBe("content-tcad");
    expect(fs.files.get(path.join("/ws", "CategoryA", "c.pdf"))).toBe("content-pdf");
  });

  test("配置无效时应返回校验错误", async () => {
    const c = buildTestContainer();
    const uc = c.get<GenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase);
    const cfg: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "CategoryA",
          children: [
            { type: "material", name: "dup", resource: "/src/a" },
            { type: "material", name: "dup", resource: "/src/b" },
          ],
        },
      ],
    };
    const result = await uc.run(cfg);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "ConfigValidationError")).toBe(true);
  });

  test("skipIfExists 为 true 时已存在目标文件应记录到 skippedFiles", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/a", "content-a");
    fs.files.set(path.join("/ws", "CategoryA", "a"), "already-exists");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "CategoryA",
          children: [{ type: "material", name: "a", resource: "/src/a" }],
        },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<GenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase);
    const result = await uc.run(cfg, { skipIfExists: true });

    expect(result.errors).toHaveLength(0);
    expect(result.skippedFiles).toHaveLength(1);
    expect(result.skippedFiles[0]!.reason).toBe("目标文件已存在");
    expect(result.copiedFiles).toHaveLength(0);
  });

  test("overwrite 为 true 时应覆盖已存在文件", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/a", "new-content");
    const dstKey = path.join("/ws", "CategoryA", "a");
    fs.files.set(dstKey, "old-content");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "CategoryA",
          children: [{ type: "material", name: "a", resource: "/src/a" }],
        },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<GenerateStructureUseCase>(DI_TYPES.GenerateStructureUseCase);
    const result = await uc.run(cfg, { overwrite: true });

    expect(result.errors).toHaveLength(0);
    expect(result.copiedFiles).toHaveLength(1);
    expect(fs.files.get(dstKey)).toBe("new-content");
  });
});

