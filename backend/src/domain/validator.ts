import { injectable } from "inversify";
import type { Config, ErrorRecord, TreeNode } from "./types";

export interface INodeValidator {
  validate(config: Config): ErrorRecord[];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

@injectable()
export class NodeValidator implements INodeValidator {
  validate(config: Config): ErrorRecord[] {
    const errors: ErrorRecord[] = [];

    if (config == null || typeof config !== "object") {
      errors.push({
        code: "ConfigValidationError",
        message: "配置必须为对象",
        nodePath: "",
      });
      return errors;
    }

    if (!isNonEmptyString((config as Config).workspace)) {
      errors.push({
        code: "ConfigValidationError",
        message: "workspace 必须为非空字符串",
        nodePath: "workspace",
      });
    }

    const structure = (config as Config).structure as unknown;
    if (!Array.isArray(structure)) {
      errors.push({
        code: "ConfigValidationError",
        message: "structure 必须为数组",
        nodePath: "structure",
      });
      return errors;
    }

    // 根层级同名冲突校验
    this.validateLevel(structure as TreeNode[], "structure", errors);

    // 递归校验各节点
    for (let i = 0; i < structure.length; i++) {
      this.validateNode(structure[i] as unknown, `structure[${i}]`, errors);
    }

    return errors;
  }

  private validateNode(node: unknown, nodePath: string, errors: ErrorRecord[]): void {
    if (node == null || typeof node !== "object") {
      errors.push({
        code: "ConfigValidationError",
        message: "节点必须为对象",
        nodePath,
      });
      return;
    }

    const t = (node as { type?: unknown }).type;
    if (t !== "category" && t !== "material") {
      errors.push({
        code: "ConfigValidationError",
        message: `type 必须为 "category" 或 "material"`,
        nodePath: `${nodePath}.type`,
      });
      return;
    }

    const name = (node as { name?: unknown }).name;
    if (!isNonEmptyString(name)) {
      errors.push({
        code: "ConfigValidationError",
        message: "name 必须为非空字符串",
        nodePath: `${nodePath}.name`,
      });
    }

    if (t === "category") {
      const children = (node as { children?: unknown }).children;
      if (!Array.isArray(children)) {
        errors.push({
          code: "ConfigValidationError",
          message: "category.children 必须为数组",
          nodePath: `${nodePath}.children`,
        });
        return;
      }

      this.validateLevel(children as TreeNode[], `${nodePath}.children`, errors);

      for (let i = 0; i < children.length; i++) {
        this.validateNode(children[i] as unknown, `${nodePath}.children[${i}]`, errors);
      }
      return;
    }

    // material
    const resource = (node as { resource?: unknown }).resource;
    if (!isNonEmptyString(resource)) {
      errors.push({
        code: "ConfigValidationError",
        message: "material.resource 必须为非空字符串",
        nodePath: `${nodePath}.resource`,
      });
    }
  }

  /**
   * 同一目录层级的同名冲突校验：
   * - material.name 重名
   * - material.name 与 category.name 冲突
   *
   * 仅依赖 children 列表本身（不会跨层级比较）。
   */
  private validateLevel(nodes: TreeNode[], levelPath: string, errors: ErrorRecord[]): void {
    const categoryNames = new Set<string>();
    const materialNames = new Set<string>();

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i] as unknown as { type?: unknown; name?: unknown };
      const type = n?.type;
      const name = n?.name;
      if (!isNonEmptyString(name)) continue;

      if (type === "category") {
        if (categoryNames.has(name) || materialNames.has(name)) {
          errors.push({
            code: "ConfigValidationError",
            message: `同一目录层级下存在重名：${name}`,
            nodePath: `${levelPath}[${i}].name`,
            details: { name },
          });
        } else {
          categoryNames.add(name);
        }
      } else if (type === "material") {
        if (materialNames.has(name) || categoryNames.has(name)) {
          errors.push({
            code: "ConfigValidationError",
            message: `同一目录层级下存在重名：${name}`,
            nodePath: `${levelPath}[${i}].name`,
            details: { name },
          });
        } else {
          materialNames.add(name);
        }
      }
    }
  }
}

