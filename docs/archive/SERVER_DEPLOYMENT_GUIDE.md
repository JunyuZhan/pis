# 服务器部署指南（归档）

> **状态：已归档。** 本文曾含个人主机别名、固定分支等备忘内容。正式部署请以 **[中文部署指南](../i18n/zh-CN/DEPLOYMENT.md)** / **[English](../i18n/en/DEPLOYMENT.md)** 与 **[docker/README.md](../../docker/README.md)** 为准。

---

以下为保留的通用步骤摘要（已去掉个人化命令）。

## 通用流程摘要

1. 登录你的服务器（`ssh user@your-server`），进入准备存放项目的目录。  
2. 克隆本仓库默认分支（以 GitHub 默认分支为准，勿依赖已废弃的分支名）。  
3. `cd docker && bash deploy.sh`，按交互提示完成配置。  
4. 需要时：`docker compose -f docker-compose.yml up -d`（具体 compose 文件以当前仓库说明为准）。  
5. 默认常见对外端口为 **8088**（Nginx），FTP **21** 及被动端口段见 compose 注释。

常见问题（日志、重启、停止）与「部署后检查」仍适用，命令中的路径请按你本机克隆位置替换。

---

## 原稿中的常见问题（保留）

### 查看部署日志

```bash
cd /path/to/pis/docker
docker compose -f docker-compose.yml logs -f
```

### 重启 / 停止

```bash
cd /path/to/pis/docker
docker compose -f docker-compose.yml restart
# 或
docker compose -f docker-compose.yml down
```

### 部署后检查清单

- [ ] 容器均正常运行（`docker ps`）  
- [ ] 可访问 Web 与后台（端口以实际为准，常为 8088）  
- [ ] 上传与缩略图/预览处理正常  
- [ ] 访客相册可访问  

---

管理员密码重置等运维命令以 **[部署指南](../i18n/zh-CN/DEPLOYMENT.md)** 与仓库内脚本说明为准。
