import { inject, injectable } from "inversify";
import * as path from "node:path";
import type {
  Config,
  CopyEntry,
  ErrorRecord,
  MissingResource,
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
    overwrittenFiles: [],
    missingResources: [],
    errors: [],
  };
}

function normalizeOptions(options?: RunOptions): Required<RunOptions> {
  return {
    skipIfExists: options?.skipIfExists ?? true,
    overwrite: options?.overwrite ?? false,
  };
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return (
    !!err &&
    typeof err === "object" &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string"
  );
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
    for (let i = 0; i < config.structure.length; i++) {
      const node = config.structure[i];
      if (node) {
        await this.walk(node, workspace, result, opts, `structure[${i}]`);
      }
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
    nodePath: string,
  ): Promise<void> {
    if (node.type === "category") {
      const dirPath = path.join(basePath, node.name);
      try {
        await this.fileSystem.mkdirp(dirPath);
        result.createdDirectories.push(dirPath);
      } catch (e) {
        result.errors.push(this.toErrorRecord(dirPath, e, { nodePath }));
        return;
      }
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child) {
          await this.walk(child, dirPath, result, options, `${nodePath}.children[${i}]`);
        }
      }
      return;
    }

    // material
    const src = node.resource;
    const dst = path.join(basePath, node.name);
    const exists = await this.fileSystem.exists(dst);

    if (options.overwrite) {
      await this.copyOne(src, dst, result, nodePath, exists);
      return;
    }
    if (options.skipIfExists && exists) {
      result.skippedFiles.push({ src, dst, reason: "目标文件已存在" });
      return;
    }
    await this.copyOne(src, dst, result, nodePath, false);
  }

  private async copyOne(
    src: string,
    dst: string,
    result: RunResult,
    nodePath: string,
    overwriting: boolean,
  ): Promise<void> {
    try {
      await this.fileSystem.copyFile(src, dst);
      const entry: CopyEntry = { src, dst };
      if (overwriting) {
        result.overwrittenFiles.push(entry);
      } else {
        result.copiedFiles.push(entry);
      }
    } catch (e) {
      if (isErrnoException(e) && e.code === "ENOENT") {
        const missing: MissingResource = {
          resource: src,
          reason: "not_found",
          nodePath,
        };
        result.missingResources.push(missing);
        result.errors.push({
          code: "ResourceNotFoundError",
          message: `资源文件不存在：${src}`,
          nodePath,
          details: { src, dst },
        });
        return;
      }
      result.errors.push(this.toErrorRecord(dst, e, { src, dst, nodePath }));
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
