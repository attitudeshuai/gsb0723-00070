export interface IFileSystem {
  mkdirp(dir: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  copyFile(src: string, dst: string): Promise<void>;
  /**
   * 判断路径是否存在且可读。检查模式用于验证资源文件。
   */
  isReadable(path: string): Promise<boolean>;
  /**
   * 写入文本文件（用于将报告输出到文件）。
   */
  writeFile(path: string, content: string): Promise<void>;
}
