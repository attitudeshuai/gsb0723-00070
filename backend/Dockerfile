# 使用官方 Node.js 运行时作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json（如果存在）
# 这一步单独复制，利用 Docker 缓存层，避免依赖变更时重新安装所有依赖
COPY package*.json ./

# 使用国内镜像源加速（可选，根据实际情况调整）
# 如果需要加速，取消下面的注释：
# RUN npm config set registry https://registry.npmmirror.com

# 安装依赖（包括 devDependencies，因为需要 TypeScript 编译）
RUN npm ci

# 复制源代码和配置文件
COPY tsconfig.json ./
COPY jest.config.js ./
COPY src/ ./src/
COPY tests/ ./tests/

# 构建 TypeScript 项目
RUN npm run build

# 清理缓存，减小镜像体积（保留 devDependencies 以便在容器内运行测试）
RUN rm -rf node_modules/.cache/

# 设置默认命令（可以通过 docker-compose 覆盖）
CMD ["node", "dist/cli.js"]
