import { inject, injectable } from "inversify";
import * as path from "node:path";
import type {
  Config,
  ErrorRecord,
  RunOptions,
  RunResult,
  TreeNode,
} from "../domain/types";
import type { IFileSystem } from "../infra/fileSystem";
import type { INodeValidator } from "../domain/validator";
import { DI_TYPES } from "../di/types";

export interface IGenerateStructureUseCase {
  run(config: Config, options?: RunOptions): Promise<RunResult>;
}

function emptyResult(): RunResult {
  return {
    createdDirectories: [],
    copiedFiles: [],
    skippedFiles: [],
    errors: [],
  };
}

function normalizeOptions(options?: RunOptions): Required<RunOptions> {
  return {
    skipIfExists: options?.skipIfExists ?? true,
    overwrite: options?.overwrite ?? false,
  };
}

@injectable()
export class GenerateStructureUseCase implements IGenerateStructureUseCase {
  constructor(
    @inject(DI_TYPES.NodeValidator) private readonly validator: INodeValidator,
    @inject(DI_TYPES.FileSystem) private readonly fileSystem: IFileSystem,
  ) {}

  async run(config: Config, options?: RunOptions): Promise<RunResult> {
    const result = emptyResult();
    const validationErrors = this.validator.validate(config);
    if (validationErrors.length > 0) {
      result.errors.push(...validationErrors);
      return result;
    }

    const opts = normalizeOptions(options);
    const workspace = path.normalize(config.workspace.replace(/[/\\]+$/, ""));

    await this.ensureWorkspace(workspace, result);
    for (const node of config.structure) {
      await this.walk(node, workspace, result, opts);
    }

    return result;
  }

  private async ensureWorkspace(workspace: string, result: RunResult): Promise<void> {
    try {
      await this.fileSystem.mkdirp(workspace);
      result.createdDirectories.push(workspace);
    } catch (e) {
      result.errors.push(this.toErrorRecord(workspace, e));
    }
  }

  private async walk(
    node: TreeNode,
    basePath: string,
    result: RunResult,
    options: Required<RunOptions>,
  ): Promise<void> {
    if (node.type === "category") {
      const dirPath = path.join(basePath, node.name);
      try {
        await this.fileSystem.mkdirp(dirPath);
        result.createdDirectories.push(dirPath);
      } catch (e) {
        result.errors.push(this.toErrorRecord(dirPath, e));
        return;
      }
      for (const child of node.children) {
        await this.walk(child, dirPath, result, options);
      }
      return;
    }

    // material
    const src = node.resource;
    const dst = path.join(basePath, node.name);

    if (options.overwrite) {
      await this.copyOne(src, dst, result);
      return;
    }
    if (options.skipIfExists) {
      const exists = await this.fileSystem.exists(dst);
      if (exists) {
        result.skippedFiles.push({ src, dst, reason: "目标文件已存在" });
        return;
      }
    }
    await this.copyOne(src, dst, result);
  }

  private async copyOne(
    src: string,
    dst: string,
    result: RunResult,
  ): Promise<void> {
    try {
      await this.fileSystem.copyFile(src, dst);
      result.copiedFiles.push({ src, dst });
    } catch (e) {
      result.errors.push(this.toErrorRecord(dst, e, { src, dst }));
    }
  }

  private toErrorRecord(
    context: string,
    err: unknown,
    details?: Record<string, unknown>,
  ): ErrorRecord {
    const message = err instanceof Error ? err.message : String(err);
    return {
      code: "FileOperationError",
      message: `${context}: ${message}`,
      details: details ?? {},
    };
  }
}
