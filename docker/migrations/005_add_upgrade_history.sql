-- ============================================
-- 升级历史表迁移脚本
-- 用于记录系统升级操作
-- ============================================

-- 创建升级历史表
CREATE TABLE IF NOT EXISTS upgrade_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_version VARCHAR(50) NOT NULL,          -- 升级前版本
    to_version VARCHAR(50) NOT NULL,            -- 升级后版本
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 状态: pending, running, success, failed, rolled_back
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    executed_by UUID REFERENCES users(id),       -- 执行人
    notes TEXT,                                   -- 备注（如升级日志摘要）
    error_message TEXT,                          -- 错误信息（如果失败）
    rebuild_performed BOOLEAN DEFAULT false,     -- 是否执行了重新构建
    rollback_available BOOLEAN DEFAULT true,     -- 是否可回滚
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_upgrade_history_status ON upgrade_history(status);
CREATE INDEX IF NOT EXISTS idx_upgrade_history_started_at ON upgrade_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_upgrade_history_to_version ON upgrade_history(to_version);

-- 添加注释
COMMENT ON TABLE upgrade_history IS '系统升级历史记录';
COMMENT ON COLUMN upgrade_history.from_version IS '升级前版本号';
COMMENT ON COLUMN upgrade_history.to_version IS '升级后版本号';
COMMENT ON COLUMN upgrade_history.status IS '升级状态: pending-等待中, running-执行中, success-成功, failed-失败, rolled_back-已回滚';
COMMENT ON COLUMN upgrade_history.rebuild_performed IS '是否执行了 Docker 镜像重新构建';
COMMENT ON COLUMN upgrade_history.rollback_available IS '是否可以回滚到此版本';

-- 插入当前版本作为初始记录（可选）
-- INSERT INTO upgrade_history (from_version, to_version, status, completed_at, notes)
-- VALUES ('initial', '1.0.0', 'success', NOW(), '系统初始安装')
-- ON CONFLICT DO NOTHING;
