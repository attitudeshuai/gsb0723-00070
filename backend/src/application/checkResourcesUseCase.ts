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

export interface ICheckResourcesUseCase {
  /**
   * 仅验证配置与资源文件是否存在/可读，绝不执行任何写操作。
   */
  check(config: Config): Promise<CheckResult>;
}

@injectable()
export class CheckResourcesUseCase implements ICheckResourcesUseCase {
  constructor(
    @inject(DI_TYPES.NodeValidator) private readonly validator: INodeValidator,
    @inject(DI_TYPES.FileSystem) private readonly fileSystem: IFileSystem,
  ) {}

  async check(config: Config): Promise<CheckResult> {
    const validationErrors = this.validator.validate(config);
    const missingResources: MissingResource[] = [];

    // 配置非法时不再检查资源，避免对结构做不安全的假设。
    if (validationErrors.length > 0) {
      return { validationErrors, missingResources };
    }

    for (let i = 0; i < config.structure.length; i++) {
      await this.walk(config.structure[i]!, `structure[${i}]`, missingResources);
    }

    return { validationErrors, missingResources };
  }

  private async walk(
    node: TreeNode,
    nodePath: string,
    missing: MissingResource[],
  ): Promise<void> {
    if (node.type === "category") {
      for (let i = 0; i < node.children.length; i++) {
        await this.walk(node.children[i]!, `${nodePath}.children[${i}]`, missing);
      }
      return;
    }

    const readable = await this.fileSystem.isReadable(node.resource);
    if (!readable) {
      missing.push({
        resource: node.resource,
        nodePath: `${nodePath}.resource`,
        reason: "资源文件不存在或不可读",
      });
    }
  }
}
