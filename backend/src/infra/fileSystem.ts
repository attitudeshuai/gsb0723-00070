export interface IFileSystem {
  mkdirp(dir: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  isReadableFile(path: string): Promise<boolean>;
  copyFile(src: string, dst: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}
