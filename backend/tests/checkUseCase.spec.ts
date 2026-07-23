import "reflect-metadata";
import { Container } from "inversify";
import { CheckStructureUseCase } from "../src/application/checkStructureUseCase";
import { NodeValidator } from "../src/domain/validator";
import { ResourceChecker } from "../src/infra/resourceChecker";
import type { Config } from "../src/domain/types";
import { DI_TYPES } from "../src/di/types";
import { InMemoryFileSystem } from "./inMemoryFileSystem";

function buildTestContainer(fs: InMemoryFileSystem): Container {
  const c = new Container({ defaultScope: "Singleton" });
  c.bind(DI_TYPES.NodeValidator).to(NodeValidator);
  c.bind(DI_TYPES.FileSystem).toConstantValue(fs);
  c.bind(DI_TYPES.ResourceChecker).to(ResourceChecker);
  c.bind(DI_TYPES.CheckStructureUseCase).to(CheckStructureUseCase);
  return c;
}

describe("CheckStructureUseCase", () => {
  test("配置有效且资源文件存在时应返回空错误和空缺失列表", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/c.tcad", "content");
    fs.files.set("/src/c.pdf", "content2");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "CategoryA",
          children: [
            { type: "material", name: "c.tcad", resource: "/src/c.tcad" },
            { type: "material", name: "c.pdf", resource: "/src/c.pdf" },
          ],
        },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<CheckStructureUseCase>(DI_TYPES.CheckStructureUseCase);
    const result = await uc.run(cfg);

    expect(result.errors).toHaveLength(0);
    expect(result.missingResources).toHaveLength(0);
    expect(result.createdDirectories).toHaveLength(0);
    expect(result.copiedFiles).toHaveLength(0);
  });

  test("资源文件不存在时应报告缺失资源", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/exists.tcad", "content");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        {
          type: "category",
          name: "CategoryA",
          children: [
            { type: "material", name: "exists.tcad", resource: "/src/exists.tcad" },
            { type: "material", name: "missing.pdf", resource: "/src/missing.pdf" },
          ],
        },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<CheckStructureUseCase>(DI_TYPES.CheckStructureUseCase);
    const result = await uc.run(cfg);

    expect(result.errors).toHaveLength(0);
    expect(result.missingResources).toHaveLength(1);
    expect(result.missingResources).toContain("/src/missing.pdf");
  });

  test("目录路径不应被视为可读文件", async () => {
    const fs = new InMemoryFileSystem();
    fs.dirs.add("/src/adir");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        { type: "material", name: "x", resource: "/src/adir" },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<CheckStructureUseCase>(DI_TYPES.CheckStructureUseCase);
    const result = await uc.run(cfg);

    expect(result.missingResources).toContain("/src/adir");
  });

  test("配置无效时应返回校验错误", async () => {
    const fs = new InMemoryFileSystem();
    const cfg: Config = {
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

    const c = buildTestContainer(fs);
    const uc = c.get<CheckStructureUseCase>(DI_TYPES.CheckStructureUseCase);
    const result = await uc.run(cfg);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.code === "ConfigValidationError")).toBe(true);
  });

  test("检查模式不应创建目录或拷贝文件（只读）", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/a", "content");

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
    const uc = c.get<CheckStructureUseCase>(DI_TYPES.CheckStructureUseCase);
    await uc.run(cfg);

    expect(fs.dirs.size).toBe(0);
    expect(fs.files.has("/ws/CategoryA/a")).toBe(false);
  });

  test("嵌套目录中所有层级的缺失资源都应被发现", async () => {
    const fs = new InMemoryFileSystem();
    fs.files.set("/src/top.tcad", "ok");

    const cfg: Config = {
      workspace: "/ws",
      structure: [
        { type: "material", name: "top.tcad", resource: "/src/top.tcad" },
        {
          type: "category",
          name: "Sub",
          children: [
            { type: "material", name: "deep.pdf", resource: "/src/deep.pdf" },
            {
              type: "category",
              name: "Deeper",
              children: [
                { type: "material", name: "verydeep.doc", resource: "/src/verydeep.doc" },
              ],
            },
          ],
        },
      ],
    };

    const c = buildTestContainer(fs);
    const uc = c.get<CheckStructureUseCase>(DI_TYPES.CheckStructureUseCase);
    const result = await uc.run(cfg);

    expect(result.missingResources).toHaveLength(2);
    expect(result.missingResources).toContain("/src/deep.pdf");
    expect(result.missingResources).toContain("/src/verydeep.doc");
  });
});
