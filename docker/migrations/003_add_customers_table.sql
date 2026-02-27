-- ============================================
-- 客户管理表迁移脚本
-- ============================================
-- 此脚本用于已部署的系统添加客户管理功能
-- 新部署会通过 init-postgresql-db.sql 自动创建这些表
-- ============================================

-- ============================================
-- 客户表
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,                  -- 客户姓名
    phone VARCHAR(20),                           -- 电话号码
    email VARCHAR(255),                          -- 邮箱
    wechat VARCHAR(100),                         -- 微信号
    company VARCHAR(200),                        -- 公司/单位
    address TEXT,                                -- 地址
    notes TEXT,                                  -- 备注信息
    tags TEXT[],                                 -- 标签（数组）
    source VARCHAR(50),                          -- 客户来源: referral, website, social, other
    status VARCHAR(20) DEFAULT 'active',         -- 状态: active, inactive, archived
    created_by UUID REFERENCES users(id),        -- 创建者
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE          -- 软删除
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers(deleted_at) WHERE deleted_at IS NULL;

-- 为 customers 表创建更新时间触发器
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 客户-相册关联表
-- ============================================
CREATE TABLE IF NOT EXISTS customer_albums (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'client',           -- 角色: client(客户), guest(来宾), photographer(摄影师)
    notes TEXT,                                  -- 关联备注
    notified_at TIMESTAMP WITH TIME ZONE,        -- 最后通知时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(customer_id, album_id)                -- 防止重复关联
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_customer_albums_customer ON customer_albums(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_albums_album ON customer_albums(album_id);

-- ============================================
-- 为 albums 表添加客户关联字段（可选）
-- ============================================
-- 如果需要在相册上直接显示主要客户，可以添加此字段
-- ALTER TABLE albums ADD COLUMN IF NOT EXISTS primary_customer_id UUID REFERENCES customers(id);
