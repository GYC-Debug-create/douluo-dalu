# 斗罗大陆 · 账号系统上线部署手册

目标机：`49.233.157.164`（应用目录 `/opt/apps/douluo`，容器 `douluo-game-app`）
**关键：线上存档在 Docker 命名卷 `douluo-data`（挂在容器内 `/app/data`），不在宿主机的 `/opt/apps/douluo/data`。
所以【迁移】必须在容器内执行（脚本已打进镜像 `scripts/`）。**

> 本手册对应的代码即 `douluo-update-account.tgz`（本地已生成，与源代码一起用）。

---

## 第 0 步 · 备份线上存档（必做，不可逆操作前先备份）

```bash
# 在服务器上执行
docker exec douluo-game-app tar -C /app/data -czf /tmp/douluo-data-bak.tgz .
docker cp douluo-game-app:/tmp/douluo-data-bak.tgz /root/douluo-data-bak-$(date +%Y%m%d).tgz
docker exec douluo-game-app rm -f /tmp/douluo-data-bak.tgz
ls -lh /root/douluo-data-bak-*.tgz   # 确认有备份文件
```

## 第 1 步 · 把新代码传到服务器（任选一种）

- **方式 A（推荐，从本机）**：
  ```bash
  scp /path/to/douluo-update-account.tgz 你的用户@49.233.157.164:/tmp/
  ```
- 方式 B：用宝塔 / XFTP / web 面板手动上传到 `/tmp/`。
- 方式 C：如果服务器上能把仓库拉下来（当前本地 git 没有 remote），`git pull` 后直接跳到第 2 步。

## 第 2 步 · 解压覆盖（保留 data 卷不动，它不在目录里）

```bash
cd /opt/apps/douluo
sudo tar -xzf /tmp/douluo-update-account.tgz -C /opt/apps/douluo
```

## 第 3 步 · 重建并重启容器

```bash
cd /opt/apps/douluo
sudo docker compose -f docker-compose.production.yml build
sudo docker compose -f docker-compose.production.yml up -d
curl -fsS http://127.0.0.1:3001/api/health     # 应返回 {"status":"ok"}
```

## 第 4 步 · 在容器内迁移线上存档（关键）

先看卷里实际有哪些档：

```bash
docker exec douluo-game-app node scripts/migrate-legacy-saves.js list
```

建账号（初始密码 `123456`，小朋友进游戏后在标题页可自行「修改密码」）：

```bash
docker exec douluo-game-app node scripts/account-admin.js create 小帅 123456
# 需要你的个人账号就再来一条：
# docker exec douluo-game-app node scripts/account-admin.js create gyc 123456
```

按【2026-08-15 探测】的 12 个档，真人档归「小帅」，重复觉醒残留归档：

```bash
# 真人档 → 小帅
docker exec douluo-game-app node scripts/migrate-legacy-saves.js assign 小帅 \
  p_msqdaf8if4uiq p_msuij3bce1bg9 p_msu5gthanjy3j \
  p_msqdm9ogdaoml p_msqd98hopid11 p_msqdncqy1961h p_msqdh0cu2degb

# 5 个重复觉醒(千手修罗 Lv.10) → data/removed/（不会删除）
docker exec douluo-game-app node scripts/migrate-legacy-saves.js remove \
  p_msu5gsxr6876l p_msu5gt35ildn5 p_msu5gtcrdg58s p_msu5gsalklssp p_msu5gprexr1mg
```

若线上的 `list` 结果与上面不一致，以线上为准，把真实想留的 id 放进 `assign`、其余放 `remove`。

## 第 5 步 · 公网验证（新装的浏览器开 http://49.233.157.164/douluo/）

用 http://49.233.157.164 测：
- `POST /api/auth/login {username:'x',password:'x'}` → **不再 404**（应 400/401）＝后端已更新
- `POST /api/player/auth` → **404**（老接口已删）
- `GET /api/player/list` → **401**（未登录拒绝）
- `GET /api/health` → 200

浏览器：标题页出现「账号」输入框 → 用 `小帅 / 123456` 登录 → 「继续冒险」看到 7 个档 → 进游戏 → 改密码。

## 回滚

```bash
# 若想退回，先确认第 0 步的备份存在，再：
sudo docker compose -f docker-compose.production.yml build   # 需要旧代码时先恢复旧文件
sudo docker compose -f docker-compose.production.yml up -d
# 存档卷不动就不会丢档；如需恢复备份：
# docker cp /root/douluo-data-bak-YYYYMMDD.tgz douluo-game-app:/tmp/ && \
# docker exec douluo-game-app tar -C /app/data -xzf /tmp/douluo-data-bak.tgz
```

---

## 安全提醒（务必尽快执行）

更新前线上是**旧版鉴权**：`/api/player/auth` 任意 playerId 都能拿写入 Token、存档列表/读档全公开——
任何公网访客都可读/改/删这 12 个档。**第 3~4 步执行完就修复**；在更新前如需继续对外开服，至少考虑临时关掉外网写入口。
