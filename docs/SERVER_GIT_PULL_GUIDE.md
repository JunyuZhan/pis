# 服务器 Git 强制拉取代码指南

## 快速命令

### 方法1: 强制重置到远程版本（推荐）

```bash
cd /opt/pis
git fetch origin
git reset --hard origin/development
```

### 方法2: 完整重置（包括清理未跟踪文件）

```bash
cd /opt/pis
git fetch origin
git reset --hard origin/development
git clean -fd  # 删除未跟踪的文件和目录（谨慎使用）
```

### 方法3: 如果当前不在 development 分支

```bash
cd /opt/pis
git fetch origin
git checkout development
git reset --hard origin/development
```

## 命令说明

- `git fetch origin`: 从远程仓库获取最新代码（不合并）
- `git reset --hard origin/development`: 强制重置本地分支到远程版本
- `git clean -fd`: 删除未跟踪的文件和目录（可选，谨慎使用）

## 验证拉取结果

```bash
# 查看最新提交
git log --oneline -5

# 检查关键文件是否存在
ls -la docker/docker-compose.yml

# 查看 Git 状态
git status
```

## ⚠️ 注意事项

1. **会丢弃本地未提交的更改**：`git reset --hard` 会永久删除所有本地未提交的修改
2. **备份重要数据**：如果有重要的本地配置或修改，请先备份
3. **确认分支**：确保在正确的分支上执行（通常是 `development`）

## 常见问题

### Q: 如何保留本地修改但更新代码？
A: 使用 `git stash` 暂存本地修改：
```bash
git stash
git fetch origin
git reset --hard origin/development
git stash pop  # 恢复本地修改（可能有冲突）
```

### Q: 如何查看远程和本地的差异？
A: 
```bash
git fetch origin
git log HEAD..origin/development  # 查看远程有但本地没有的提交
git diff HEAD origin/development  # 查看代码差异
```

### Q: 如何只更新特定文件？
A: 
```bash
git fetch origin
git checkout origin/development -- docker/docker-compose.yml
```

## 推荐工作流程

1. **检查当前状态**：
   ```bash
   cd /opt/pis
   git status
   ```

2. **备份重要文件**（如果有）：
   ```bash
   cp .env .env.backup
   ```

3. **强制拉取**：
   ```bash
   git fetch origin
   git reset --hard origin/development
   ```

4. **验证文件**：
   ```bash
   ls -la docker/docker-compose.yml
   ```

5. **重新运行部署脚本**：
   ```bash
   bash docker/deploy.sh
   ```
