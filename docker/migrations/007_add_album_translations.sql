-- ============================================
-- 相册多语言支持迁移脚本
-- 添加 JSONB 字段存储多语言标题和描述
-- ============================================

-- 添加多语言标题字段
-- 格式: { "zh-CN": "中文标题", "en": "English Title" }
ALTER TABLE albums ADD COLUMN IF NOT EXISTS title_translations JSONB DEFAULT '{}';

-- 添加多语言描述字段
-- 格式: { "zh-CN": "中文描述", "en": "English Description" }
ALTER TABLE albums ADD COLUMN IF NOT EXISTS description_translations JSONB DEFAULT '{}';

-- 添加多语言分享标题字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_title_translations JSONB DEFAULT '{}';

-- 添加多语言分享描述字段
ALTER TABLE albums ADD COLUMN IF NOT EXISTS share_description_translations JSONB DEFAULT '{}';

-- 创建索引以支持 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_albums_title_translations ON albums USING gin (title_translations);

-- 添加注释
COMMENT ON COLUMN albums.title_translations IS '多语言标题，格式: {"zh-CN": "中文", "en": "English"}';
COMMENT ON COLUMN albums.description_translations IS '多语言描述，格式: {"zh-CN": "中文", "en": "English"}';
COMMENT ON COLUMN albums.share_title_translations IS '多语言分享标题';
COMMENT ON COLUMN albums.share_description_translations IS '多语言分享描述';

-- ============================================
-- 创建辅助函数：获取多语言文本
-- 优先返回指定语言，否则返回默认语言，最后返回原始字段
-- ============================================

CREATE OR REPLACE FUNCTION get_localized_text(
    translations JSONB,
    fallback_text TEXT,
    locale TEXT DEFAULT 'zh-CN'
) RETURNS TEXT AS $$
BEGIN
    -- 尝试获取指定语言
    IF translations IS NOT NULL AND translations ? locale THEN
        RETURN translations ->> locale;
    END IF;
    
    -- 尝试获取默认语言（中文）
    IF translations IS NOT NULL AND translations ? 'zh-CN' THEN
        RETURN translations ->> 'zh-CN';
    END IF;
    
    -- 返回原始字段
    RETURN fallback_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_localized_text IS '获取多语言文本，优先指定语言，然后默认语言，最后原始值';
