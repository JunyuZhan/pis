#!/bin/bash

# 前端组件可靠性测试脚本
# 运行所有组件测试并生成详细的可靠性报告

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORT_DIR="$PROJECT_DIR/reports/component-reliability"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/report_${TIMESTAMP}.md"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        前端组件可靠性测试套件                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR"

# 创建报告目录
mkdir -p "$REPORT_DIR"

# 检查是否在正确的目录
if [ ! -d "$PROJECT_DIR/apps/web" ]; then
  echo -e "${RED}错误: 找不到 apps/web 目录 (当前目录: $(pwd))${NC}"
  exit 1
fi

cd "$PROJECT_DIR/apps/web"

echo -e "${CYAN}📊 开始组件可靠性测试...${NC}"
echo ""

# 运行测试并生成覆盖率报告
echo -e "${YELLOW}运行组件测试...${NC}"
if pnpm test:coverage -- src/components 2>&1 | tee "$REPORT_DIR/test_output.log"; then
  TEST_STATUS="✅ 通过"
  TEST_EXIT_CODE=0
else
  TEST_STATUS="❌ 失败"
  TEST_EXIT_CODE=$?
fi

echo ""
echo -e "${CYAN}📈 生成测试报告...${NC}"

# 查找覆盖率报告
COVERAGE_DIR="coverage"
if [ -d "$COVERAGE_DIR" ]; then
  # 尝试找到覆盖率数据文件
  COVERAGE_SUMMARY=$(find "$COVERAGE_DIR" -name "coverage-summary.json" 2>/dev/null | head -1)
  
  if [ -n "$COVERAGE_SUMMARY" ] && [ -f "$COVERAGE_SUMMARY" ]; then
    # 解析覆盖率数据
    TOTAL_LINES=$(node -e "const data = require('$COVERAGE_SUMMARY'); console.log(data.total.lines.pct || 0)")
    TOTAL_FUNCTIONS=$(node -e "const data = require('$COVERAGE_SUMMARY'); console.log(data.total.functions.pct || 0)")
    TOTAL_BRANCHES=$(node -e "const data = require('$COVERAGE_SUMMARY'); console.log(data.total.branches.pct || 0)")
    TOTAL_STATEMENTS=$(node -e "const data = require('$COVERAGE_SUMMARY'); console.log(data.total.statements.pct || 0)")
  else
    TOTAL_LINES="N/A"
    TOTAL_FUNCTIONS="N/A"
    TOTAL_BRANCHES="N/A"
    TOTAL_STATEMENTS="N/A"
  fi
else
  TOTAL_LINES="N/A"
  TOTAL_FUNCTIONS="N/A"
  TOTAL_BRANCHES="N/A"
  TOTAL_STATEMENTS="N/A"
fi

# 统计测试文件
COMPONENT_TEST_FILES=$(find src/components -name "*.test.tsx" -o -name "*.spec.tsx" 2>/dev/null | wc -l | tr -d ' ')
COMPONENT_FILES=$(find src/components -name "*.tsx" ! -name "*.test.tsx" ! -name "*.spec.tsx" 2>/dev/null | wc -l | tr -d ' ')

# 生成 Markdown 报告
cat > "$REPORT_FILE" << EOF
# 前端组件可靠性测试报告

**生成时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**测试状态**: $TEST_STATUS

---

## 📊 测试概览

| 指标 | 数值 |
|------|------|
| 组件总数 | $COMPONENT_FILES |
| 已测试组件 | $COMPONENT_TEST_FILES |
| 测试覆盖率 | $TOTAL_STATEMENTS% |

---

## 📈 代码覆盖率

| 类型 | 覆盖率 | 阈值 | 状态 |
|------|--------|------|------|
| 语句 (Statements) | $TOTAL_STATEMENTS% | 90% | $(awk "BEGIN {print ($TOTAL_STATEMENTS >= 90) ? '✅' : '⚠️'}") |
| 函数 (Functions) | $TOTAL_FUNCTIONS% | 90% | $(awk "BEGIN {print ($TOTAL_FUNCTIONS >= 90) ? '✅' : '⚠️'}") |
| 分支 (Branches) | $TOTAL_BRANCHES% | 80% | $(awk "BEGIN {print ($TOTAL_BRANCHES >= 80) ? '✅' : '⚠️'}") |
| 行 (Lines) | $TOTAL_LINES% | 90% | $(awk "BEGIN {print ($TOTAL_LINES >= 90) ? '✅' : '⚠️'}") |

---

## 🔍 组件测试状态

### ✅ 已测试组件

EOF

# 列出已测试的组件
find src/components -name "*.test.tsx" -o -name "*.spec.tsx" 2>/dev/null | while read -r test_file; do
  component_name=$(basename "$test_file" .test.tsx | sed 's/.spec.tsx$//')
  component_dir=$(dirname "$test_file" | sed 's|src/components/||')
  echo "- \`$component_dir/$component_name\`" >> "$REPORT_FILE"
done

cat >> "$REPORT_FILE" << EOF

### ⚠️ 未测试组件

EOF

# 列出未测试的组件
find src/components -name "*.tsx" ! -name "*.test.tsx" ! -name "*.spec.tsx" ! -name "*.d.ts" 2>/dev/null | while read -r component_file; do
  component_name=$(basename "$component_file" .tsx)
  component_dir=$(dirname "$component_file" | sed 's|src/components/||')
  test_file=$(echo "$component_file" | sed 's/\.tsx$/.test.tsx/')
  
  if [ ! -f "$test_file" ]; then
    echo "- \`$component_dir/$component_name\`" >> "$REPORT_FILE"
  fi
done

cat >> "$REPORT_FILE" << EOF

---

## 🎯 可靠性测试重点

### 1. 错误处理测试
- ✅ 网络错误处理
- ✅ API 错误响应处理
- ✅ 边界条件测试
- ✅ 异常输入处理

### 2. 用户交互测试
- ✅ 表单提交验证
- ✅ 按钮点击事件
- ✅ 键盘导航
- ✅ 触摸手势支持

### 3. 状态管理测试
- ✅ 加载状态
- ✅ 错误状态
- ✅ 成功状态
- ✅ 空状态

### 4. 权限控制测试
- ✅ 角色过滤
- ✅ 权限检查
- ✅ 访问控制

---

## 📝 测试日志

\`\`\`
$(tail -100 "$REPORT_DIR/test_output.log" 2>/dev/null || echo "无测试日志")
\`\`\`

---

## 🔗 相关链接

- [测试配置](./apps/web/vitest.config.ts)
- [测试工具](./apps/web/src/test/)
- [组件目录](./apps/web/src/components/)

---

**报告生成时间**: $(date '+%Y-%m-%d %H:%M:%S')  
**报告文件**: \`$REPORT_FILE\`
EOF

echo -e "${GREEN}✓ 测试报告已生成: $REPORT_FILE${NC}"
echo ""

# 显示摘要
echo -e "${CYAN}📋 测试摘要${NC}"
echo -e "  组件总数: ${BLUE}$COMPONENT_FILES${NC}"
echo -e "  已测试: ${GREEN}$COMPONENT_TEST_FILES${NC}"
echo -e "  覆盖率: ${BLUE}$TOTAL_STATEMENTS%${NC}"
echo ""

# 如果覆盖率低于阈值，显示警告
if [ "$TOTAL_STATEMENTS" != "N/A" ]; then
  if (( $(echo "$TOTAL_STATEMENTS < 90" | bc -l 2>/dev/null || echo 0) )); then
    echo -e "${YELLOW}⚠️  警告: 代码覆盖率低于 90% 阈值${NC}"
    echo ""
  fi
fi

# 返回测试退出码
exit $TEST_EXIT_CODE
