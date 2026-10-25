#!/bin/bash
# Vultr 上每小时跑一次（claude-user 的 crontab：0 * * * *），只有悉尼 06 点那次真跑：
# 把网站上各公司当前的提示词读回 Notion「网站当前版本」列（agent-sync --pull）。按悉尼时间判断，夏令时切换不用改 crontab。
# 环境变量在仓库的 .env.local（NOTION_TOKEN、SUPABASE_URL、SUPABASE_SERVICE_KEY）。FORCE=1 立刻跑一次。
# 日志 ~/logs/agent-sync.log，最近一次的 JSON 在 ~/logs/agent-sync-last.json。
set -uo pipefail
[ "${FORCE:-}" = 1 ] || [ "$(TZ=Australia/Sydney date +%H)" = 06 ] || exit 0
cd "$(dirname "$0")/.." || exit 1
mkdir -p ~/logs
{
  echo "== $(TZ=Australia/Sydney date '+%F %T')"
  node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.local scripts/agent-sync.mjs --pull > ~/logs/agent-sync-last.json
  echo "exit $?"
} >> ~/logs/agent-sync.log 2>&1
