import type { IFileSystem } from "../src/infra/fileSystem";

function enoent(src: string, dst: string): Error {
  const err = new Error(
    `ENOENT: no such file or directory, copyfile '${src}' -> '${dst}'`,
  ) as Error & { code?: string; path?: string; dest?: string };
  err.code = "ENOENT";
  err.path = src;
  err.dest = dst;
  return err;
}

export class InMemoryFileSystem implements IFileSystem {
  readonly dirs = new Set<string>();
  readonly files = new Map<string, string>();
  readonly writeLog: Array<{ path: string; content: string }> = [];

  async mkdirp(dir: string): Promise<void> {
    this.dirs.add(dir);
  }

  async exists(path: string): Promise<boolean> {
    return this.dirs.has(path) || this.files.has(path);
  }

  async isReadableFile(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async copyFile(src: string, dst: string): Promise<void> {
    const content = this.files.get(src);
    if (content == null) {
      throw enoent(src, dst);
    }
    this.files.set(dst, content);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.writeLog.push({ path, content });
    this.files.set(path, content);
  }
}
