import type { IFileSystem } from "../src/infra/fileSystem";

export class InMemoryFileSystem implements IFileSystem {
  readonly dirs = new Set<string>();
  readonly files = new Map<string, string>();
  /** 显式标记为不可读的资源路径（用于检查模式测试）。 */
  readonly unreadable = new Set<string>();

  async mkdirp(dir: string): Promise<void> {
    this.dirs.add(dir);
  }

  async exists(path: string): Promise<boolean> {
    return this.dirs.has(path) || this.files.has(path);
  }

  async copyFile(src: string, dst: string): Promise<void> {
    const content = this.files.get(src);
    if (content == null) {
      throw new Error(`ENOENT: no such file or directory, copyfile '${src}' -> '${dst}'`);
    }
    this.files.set(dst, content);
  }

  async isReadable(path: string): Promise<boolean> {
    if (this.unreadable.has(path)) return false;
    return this.files.has(path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}
