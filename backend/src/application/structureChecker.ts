import { inject, injectable } from "inversify";
import type {
  CheckResult,
  Config,
  MissingResource,
  TreeNode,
} from "../domain/types";
import type { IFileSystem } from "../infra/fileSystem";
import type { INodeValidator } from "../domain/validator";
import { DI_TYPES } from "../di/types";

export interface IStructureChecker {
  check(config: Config): Promise<CheckResult>;
}

@injectable()
export class StructureChecker implements IStructureChecker {
  constructor(
    @inject(DI_TYPES.NodeValidator) private readonly validator: INodeValidator,
    @inject(DI_TYPES.FileSystem) private readonly fileSystem: IFileSystem,
  ) {}

  async check(config: Config): Promise<CheckResult> {
    const validationErrors = this.validator.validate(config);
    const missingResources: MissingResource[] = [];

    // 仅在结构本身可遍历时才检查资源；若 structure 不是数组，validator 已报错。
    if (Array.isArray(config?.structure)) {
      await this.walk(config.structure, "structure", missingResources);
    }

    return { validationErrors, missingResources };
  }

  private async walk(
    nodes: TreeNode[],
    nodePath: string,
    missing: MissingResource[],
  ): Promise<void> {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;
      const path = `${nodePath}[${i}]`;
      if (node.type === "category") {
        if (Array.isArray(node.children)) {
          await this.walk(node.children, `${path}.children`, missing);
        }
        continue;
      }
      // material
      const resource = node.resource;
      if (typeof resource !== "string" || resource.trim().length === 0) {
        continue;
      }
      const exists = await this.fileSystem.exists(resource);
      if (!exists) {
        missing.push({ resource, reason: "not_found", nodePath: path });
        continue;
      }
      const readable = await this.fileSystem.isReadableFile(resource);
      if (!readable) {
        missing.push({ resource, reason: "not_readable", nodePath: path });
      }
    }
  }
}
