FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server.js ./
# /api/spirits 与 /api/beasts 运行时 require ./public/data/*.json，
# 只复制接口真正依赖的两个数据文件（frontend/dist 已包含整套 public 静态资源，
# 这里不整目录复制以免把约 122MB 图片重复放入镜像）。
COPY public/data/spirits.json ./public/data/spirits.json
COPY public/data/beasts.json ./public/data/beasts.json
# 双轨保留：game.html 及其脚本已从 frontend/dist 剔除（vite 构建期去污，约省 1.1MB），
# 这里精确复制到 /app/public，由 server 的静态回退路径继续提供旧版入口。
COPY public/game.html public/debug-saves.html ./public/
COPY public/game.js public/game-data.js public/game-events-expanded.js \
     public/game-visual.js public/save-utils.js public/game-rules.js public/game-combat.js \
     ./public/
COPY frontend/dist ./frontend/dist
# 运维工具：账号管理 + 旧存档归属迁移（纯 Node 无外部依赖，供 docker exec 使用）
COPY scripts/account-admin.js ./scripts/account-admin.js
COPY scripts/migrate-legacy-saves.js ./scripts/migrate-legacy-saves.js

RUN mkdir -p /app/public /app/data \
    && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
