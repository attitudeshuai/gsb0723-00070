import { inject, injectable } from "inversify";
import type { Config, TreeNode } from "../domain/types";
import type { IResourceChecker } from "../domain/checker";
import type { IFileSystem } from "./fileSystem";
import { DI_TYPES } from "../di/types";

@injectable()
export class ResourceChecker implements IResourceChecker {
  constructor(
    @inject(DI_TYPES.FileSystem) private readonly fileSystem: IFileSystem,
  ) {}

  async check(config: Config): Promise<string[]> {
    const missing: string[] = [];
    await this.walk(config.structure, missing);
    return missing;
  }

  private async walk(nodes: TreeNode[], missing: string[]): Promise<void> {
    for (const node of nodes) {
      if (node.type === "category") {
        await this.walk(node.children, missing);
      } else {
        const readable = await this.fileSystem.isReadableFile(node.resource);
        if (!readable) {
          missing.push(node.resource);
        }
      }
    }
  }
}
