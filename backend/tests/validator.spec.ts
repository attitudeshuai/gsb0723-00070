import { NodeValidator } from "../src/domain/validator";
import type { Config } from "../src/domain/types";

describe("NodeValidator", () => {
  test("应收集字段类型错误", () => {
    const v = new NodeValidator();
    const bad = { workspace: "", structure: "x" } as unknown as Config;
    const errors = v.validate(bad);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.map((e) => e.nodePath)).toEqual(expect.arrayContaining(["workspace", "structure"]));
  });

  test("同一层级 material 重名应报错", () => {
    const v = new NodeValidator();
    const cfg: Config = {
      workspace: "/tmp/ws",
      structure: [
        {
          type: "category",
          name: "A",
          children: [
            { type: "material", name: "x.pdf", resource: "/r/x.pdf" },
            { type: "material", name: "x.pdf", resource: "/r2/x.pdf" },
          ],
        },
      ],
    };
    const errors = v.validate(cfg);
    expect(errors.some((e) => e.code === "ConfigValidationError")).toBe(true);
  });

  test("同一层级 material 与 category 重名应报错", () => {
    const v = new NodeValidator();
    const cfg: Config = {
      workspace: "/tmp/ws",
      structure: [
        {
          type: "category",
          name: "A",
          children: [
            { type: "category", name: "B", children: [] },
            { type: "material", name: "B", resource: "/r/B" },
          ],
        },
      ],
    };
    const errors = v.validate(cfg);
    expect(errors.some((e) => e.code === "ConfigValidationError")).toBe(true);
  });
});

