# 斗罗大陆服务器部署

## 当前生产环境

- 公网易记入口：`http://49.233.157.164/douluo/`
- 公网根入口：`http://49.233.157.164/`
- 健康检查：`http://49.233.157.164/api/health`
- 服务器目录：`/opt/apps/douluo`
- 容器：`douluo-game-app`
- 应用端口：仅监听服务器本机 `127.0.0.1:3001`
- 存档卷：Docker 命名卷 `douluo-data`
- 重启策略：`unless-stopped`
- “我的世界”继续使用 `http://49.233.157.164/mc-glm/`

## 域名待办

DNS 服务商是 DNSPod。服务器已接受以下域名，但 DNSPod 目前尚未发布对应记录：

- `gyc1313.tech`
- `www.gyc1313.tech`
- `game.gyc1313.tech`
- `douluo.gyc1313.tech`

最小操作是在 DNSPod 为根域名新增一条记录：

| 主机记录 | 类型 | 记录值 | TTL |
| --- | --- | --- | --- |
| `@` | `A` | `49.233.157.164` | `600` |

解析生效后，在服务器执行以下命令启用 HTTPS：

```bash
sudo certbot --nginx -d gyc1313.tech
```

如需同时使用 `www`，先为 `www` 增加指向相同 IP 的 A 记录，再执行：

```bash
sudo certbot --nginx -d gyc1313.tech -d www.gyc1313.tech
```

## 常用运维

```bash
cd /opt/apps/douluo

# 状态
docker compose -f docker-compose.production.yml ps

# 日志
docker logs --tail 200 douluo-game-app

# 重启
docker compose -f docker-compose.production.yml restart

# 停止 / 恢复
docker compose -f docker-compose.production.yml stop
docker compose -f docker-compose.production.yml up -d
```

不要删除 `douluo-data` 卷；它保存服务器存档。Nginx 改动前的备份位于 `/opt/apps/douluo/nginx-mc-glm-before-20260813-010600.conf`。
