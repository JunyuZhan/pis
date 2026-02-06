#!/bin/bash
# ============================================
# PIS PostgreSQL 数据库初始化脚本（创建管理员账户）
# ============================================
# 此脚本在数据库初始化后创建默认管理员账户
# PostgreSQL 容器会在首次启动时自动执行此脚本
# 执行顺序：init-postgresql-db.sql -> init-postgresql.sh
# ============================================

set -e

# 读取环境变量
DOMAIN="${DOMAIN:-localhost}"
POSTGRES_DB="${POSTGRES_DB:-pis}"
POSTGRES_USER="${POSTGRES_USER:-pis}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

echo ""
echo "=========================================="
echo "处理管理员账户密码"
echo "=========================================="

# 如果设置了 ADMIN_PASSWORD 环境变量，使用它来更新密码
# 否则，password_hash 保持为 NULL，首次登录时需要设置密码
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "🔐 检测到 ADMIN_PASSWORD 环境变量，正在设置管理员密码..."
    
    # 使用 Node.js 生成 PBKDF2-SHA512 密码哈希
    # 格式: salt:iterations:hash
    PASSWORD_HASH=$(node -e "
        const crypto = require('crypto');
        const password = process.env.ADMIN_PASSWORD;
        const salt = crypto.randomBytes(32).toString('hex');
        const iterations = 100000;
        const keylen = 64;
        const digest = 'sha512';
        const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest);
        console.log(\`\${salt}:\${iterations}:\${derivedKey.toString('hex')}\`);
    ")
    
    # 转义单引号（SQL 注入防护）
    # 虽然密码哈希是十六进制字符串，但为了安全起见，仍然转义
    PASSWORD_HASH_ESC=$(echo "$PASSWORD_HASH" | sed "s/'/''/g")
    
    # 更新数据库中的密码哈希
    # 使用 HERE document 避免 shell 注入风险
    # ⚠️ 重要：查找第一个管理员账户（动态），而不是硬编码邮箱
    psql -v ON_ERROR_STOP=1 \
         --username "$POSTGRES_USER" \
         --dbname "$POSTGRES_DB" <<EOF
-- 更新第一个管理员账户的密码（按创建时间排序）
UPDATE users 
SET password_hash = '$PASSWORD_HASH_ESC', updated_at = NOW() 
WHERE id = (
    SELECT id FROM users 
    WHERE role = 'admin' AND deleted_at IS NULL 
    ORDER BY created_at ASC 
    LIMIT 1
);
EOF
    
    echo "✅ 管理员密码已设置（使用 ADMIN_PASSWORD 环境变量）"
else
    echo "ℹ️  未设置 ADMIN_PASSWORD 环境变量"
    echo "   密码保持为未设置状态，首次登录时需要设置密码"
fi

echo ""
echo "=========================================="
echo "验证管理员账户"
echo "=========================================="

# 验证管理员账户状态
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" <<EOF
-- 显示管理员账户状态（动态查找第一个管理员账户）
DO \$\$
DECLARE
    admin_count INTEGER;
    admin_email_val TEXT;
    has_password BOOLEAN;
BEGIN
    -- 查找第一个管理员账户的邮箱
    SELECT email INTO admin_email_val
    FROM users 
    WHERE role = 'admin' AND deleted_at IS NULL 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- 统计管理员账户数量和密码设置情况
    SELECT COUNT(*), COUNT(password_hash) > 0 INTO admin_count, has_password 
    FROM users 
    WHERE role = 'admin' AND deleted_at IS NULL;
    
    IF admin_count > 0 AND admin_email_val IS NOT NULL THEN
        IF has_password THEN
            RAISE NOTICE '✅ 默认管理员账户已就绪: %', admin_email_val;
            RAISE NOTICE '   - 密码已设置';
        ELSE
            RAISE NOTICE '✅ 默认管理员账户已就绪: %', admin_email_val;
            RAISE NOTICE '   - 首次登录时需要设置密码';
        END IF;
    ELSE
        RAISE NOTICE '⚠️  未找到管理员账户，请检查初始化脚本';
    END IF;
END \$\$;
EOF

echo ""
echo "✅ 管理员账户验证完成！"
echo ""
echo "📝 管理员账户信息："
# 动态获取第一个管理员账户的邮箱
ADMIN_EMAIL_DYNAMIC=$(psql -t -A -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || echo "admin@pis.com")
echo "   邮箱: ${ADMIN_EMAIL_DYNAMIC}"
if [ -n "$ADMIN_PASSWORD" ]; then
    echo "   密码: 已通过 ADMIN_PASSWORD 环境变量设置"
else
    echo "   密码: 未设置（首次登录时需要设置）"
fi
echo ""
if [ -z "$ADMIN_PASSWORD" ]; then
    echo "💡 提示："
    echo "   - 首次登录时系统会提示设置密码"
    echo "   - 生产环境可通过环境变量 ADMIN_PASSWORD 预先设置密码"
fi
