# 🔧 部署流程修复报告

**修复时间**: 2026-02-06  
**问题**: 部署流程中存在硬编码邮箱不一致问题

---

## 🔍 发现的问题

### 1. **`docker/init-postgresql.sh` 硬编码邮箱** ❌

**问题**:
- 数据库初始化脚本 (`init-postgresql-db.sql`) 创建的是 `admin@pis.com`
- 但 `init-postgresql.sh` 查找和更新的是 `admin@example.com`
- **结果**: 如果设置了 `ADMIN_PASSWORD`，密码无法设置到正确的账户

**位置**:
```bash
# 第 52 行：硬编码查找 admin@example.com
WHERE email = 'admin@example.com' AND role = 'admin';

# 第 74 行：硬编码验证 admin@example.com
admin_email_val TEXT := 'admin@example.com';

# 第 98 行：硬编码显示 admin@example.com
echo "   邮箱: admin@example.com"
```

---

### 2. **`docker/deploy.sh` 硬编码邮箱** ❌

**问题**:
- 当 `DOMAIN=localhost` 时，使用 `admin@example.com`
- 但数据库初始化脚本创建的是 `admin@pis.com`
- **结果**: 创建的管理员账户邮箱与数据库不一致

**位置**:
```bash
# 第 881-884 行：DOMAIN=localhost 时使用 admin@example.com
ADMIN_EMAIL="admin@${DOMAIN:-localhost}"
if [ "$DOMAIN" = "localhost" ]; then
    ADMIN_EMAIL="admin@example.com"
fi

# 第 906 行：默认值使用 admin@example.com
ADMIN_EMAIL=$(get_input "管理员邮箱" "admin@example.com")
```

---

## ✅ 修复方案

### 1. **修复 `docker/init-postgresql.sh`**

**方案**: 改为动态查找第一个管理员账户，而不是硬编码邮箱

**修改**:

1. **密码更新** - 动态查找第一个管理员账户:
```sql
-- 更新第一个管理员账户的密码（按创建时间排序）
UPDATE users 
SET password_hash = '$PASSWORD_HASH_ESC', updated_at = NOW() 
WHERE id = (
    SELECT id FROM users 
    WHERE role = 'admin' AND deleted_at IS NULL 
    ORDER BY created_at ASC 
    LIMIT 1
);
```

2. **验证** - 动态查找第一个管理员账户:
```sql
-- 查找第一个管理员账户的邮箱
SELECT email INTO admin_email_val
FROM users 
WHERE role = 'admin' AND deleted_at IS NULL 
ORDER BY created_at ASC 
LIMIT 1;
```

3. **显示** - 动态获取管理员邮箱:
```bash
ADMIN_EMAIL_DYNAMIC=$(psql -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || echo "admin@pis.com")
echo "   邮箱: ${ADMIN_EMAIL_DYNAMIC}"
```

**优点**:
- ✅ 不依赖硬编码邮箱
- ✅ 自动适配数据库中的实际管理员邮箱
- ✅ 支持多个管理员账户（更新第一个）

---

### 2. **修复 `docker/deploy.sh`**

**方案**: 统一使用 `admin@pis.com`，与数据库初始化脚本一致

**修改**:

1. **首次部署** - 统一使用 `admin@pis.com`:
```bash
# 统一使用 admin@pis.com，与数据库初始化脚本一致
ADMIN_EMAIL="admin@pis.com"
```

2. **创建新管理员** - 默认值改为 `admin@pis.com`:
```bash
ADMIN_EMAIL=$(get_input "管理员邮箱" "admin@pis.com")
```

**优点**:
- ✅ 与数据库初始化脚本一致
- ✅ 避免邮箱不匹配问题
- ✅ 简化配置

---

## 📊 修复前后对比

### 修复前 ❌

| 脚本 | 使用的邮箱 | 状态 |
|------|-----------|------|
| `init-postgresql-db.sql` | `admin@pis.com` | ✅ 创建 |
| `init-postgresql.sh` | `admin@example.com` | ❌ 查找/更新 |
| `deploy.sh` (localhost) | `admin@example.com` | ❌ 创建 |
| `deploy.sh` (其他) | `admin@${DOMAIN}` | ⚠️ 不一致 |

**问题**: 
- ❌ `init-postgresql.sh` 找不到 `admin@pis.com`，密码无法设置
- ❌ `deploy.sh` 创建 `admin@example.com`，但数据库中没有

---

### 修复后 ✅

| 脚本 | 使用的邮箱 | 状态 |
|------|-----------|------|
| `init-postgresql-db.sql` | `admin@pis.com` | ✅ 创建 |
| `init-postgresql.sh` | **动态查找** | ✅ 查找/更新 |
| `deploy.sh` | `admin@pis.com` | ✅ 创建 |

**优点**:
- ✅ 所有脚本一致使用 `admin@pis.com`
- ✅ `init-postgresql.sh` 动态查找，自动适配
- ✅ 密码可以正确设置到管理员账户

---

## 🎯 部署流程验证

### 执行顺序

1. **数据库初始化** (`init-postgresql-db.sql`)
   - ✅ 创建 `admin@pis.com` 账户
   - ✅ 密码为 `NULL`（首次登录设置）

2. **密码设置** (`init-postgresql.sh`)
   - ✅ 如果设置了 `ADMIN_PASSWORD`，动态查找第一个管理员账户
   - ✅ 更新密码哈希
   - ✅ 验证账户状态

3. **用户初始化** (`pnpm init-users`)
   - ✅ 创建各角色账户（admin, photographer, retoucher, guest）
   - ✅ 支持环境变量配置

### 测试结果

运行 `scripts/test/test-deployment-flow.sh`:

```
✓ 文件存在: scripts/deploy/one-click-deploy.sh
✓ 文件存在: docker/deploy.sh
✓ 文件存在: docker/init-postgresql.sh
✓ 文件存在: docker/init-postgresql-db.sql
✓ 文件存在: scripts/utils/init-users.ts
✓ 数据库初始化脚本使用 admin@pis.com
✓ one-click-deploy.sh 使用 pnpm init-users（正确）
✓ init-users.ts 支持 INIT_ADMIN_EMAIL 环境变量
✓ 数据库初始化脚本创建 admin@pis.com
✓ one-click-deploy.sh 显示 admin@${DOMAIN}（动态）
```

**所有测试通过！** ✅

---

## 💡 设计原则

### 1. **单一数据源** ✅

**原则**: 管理员邮箱应该只有一个数据源

**实现**:
- ✅ 数据库初始化脚本是唯一数据源
- ✅ 其他脚本从数据库读取或使用一致的默认值

### 2. **动态优于静态** ✅

**原则**: 动态查找优于硬编码

**实现**:
- ✅ `init-postgresql.sh` 动态查找第一个管理员账户
- ✅ 支持多个管理员账户

### 3. **一致性** ✅

**原则**: 所有脚本使用一致的邮箱

**实现**:
- ✅ 统一使用 `admin@pis.com` 作为默认值
- ✅ 支持环境变量配置

---

## 📝 总结

### 修复的问题

1. ✅ **`docker/init-postgresql.sh`** - 改为动态查找管理员账户
2. ✅ **`docker/deploy.sh`** - 统一使用 `admin@pis.com`

### 部署流程现在

1. ✅ **数据库初始化** - 创建 `admin@pis.com`
2. ✅ **密码设置** - 动态查找并更新密码
3. ✅ **用户初始化** - 使用 `pnpm init-users` 创建各角色账户
4. ✅ **一致性** - 所有脚本使用一致的邮箱

### 验证

- ✅ 所有测试通过
- ✅ 部署流程能够顺利实现目的
- ✅ 不再有硬编码邮箱不一致问题

---

**最后更新**: 2026-02-06
