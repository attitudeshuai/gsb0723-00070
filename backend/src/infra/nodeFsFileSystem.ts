import { injectable } from "inversify";
import * as fs from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import type { IFileSystem } from "./fileSystem";

@injectable()
export class NodeFsFileSystem implements IFileSystem {
  async mkdirp(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async copyFile(src: string, dst: string): Promise<void> {
    await fs.copyFile(src, dst);
  }
}

