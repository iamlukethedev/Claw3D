/**
 * 繁中翻譯表 — Claw3D 繁體中文 UI
 * Moderate coverage: ~80 key strings
 */
export const zhTW: Record<string, string> = {
  // ===== Gateway 連線 =====
  "gateway.not_connected": "未連接到閘道器",
  "gateway.connecting": "連線中…",
  "gateway.connected": "已連線",
  "gateway.connect": "連線",
  "gateway.disconnect": "斷開連線",
  "gateway.remote_section": "遠端閘道器（建議）",
  "gateway.upstream_url": "上游 URL",
  "gateway.upstream_token": "上游令牌",
  "gateway.upstream_token_optional": "上游令牌（選填）",
  "gateway.backend_choose": "選擇後端，然後連接到它的閘道器 URL。",
  "gateway.selected_backend": "選擇的後端",
  "gateway.active_backend": "啟用的後端",
  "gateway.backend_demo": "Demo 後端",
  "gateway.backend_hermes": "Hermes 後端",
  "gateway.backend_local": "本機執行時期",
  "gateway.backend_claw3d": "Claw3D 執行時期",
  "gateway.backend_custom": "自訂後端",
  "gateway.backend_openclaw": "OpenClaw 後端",
  "gateway.run_locally_section": "本機執行（選填）",
  "gateway.run_locally_desc": "在本機啟動一個閘道器程序，然後連線。",
  "gateway.see_office_hint": "只想看看辦公室？",
  "gateway.see_office_desc": "執行指令啟動內建模擬閘道器與示範 Agent。然後選擇 Demo 後端並連線。",
  "gateway.hermes_local_hint": "在本機使用 Hermes？",
  "gateway.hermes_local_desc": "執行指令，然後選擇 Hermes 後端。預設本機 URL 為 ws://localhost:18789。",
  "gateway.local_runtime_hint": "使用本機或自訂執行時期？",
  "gateway.remote_access_hint": "從其他機器開啟 Claw3D？",
  "gateway.each_backend_hint": "每個後端都保留自己的 URL 和令牌。",
  "gateway.use_local_defaults": "使用本機預設值",
  "gateway.copy_command": "複製指令",
  "gateway.copied": "已複製",
  "gateway.approval_hint": "如果首次連線失敗，請到你的 OpenClaw 主機核准此裝置：",

  // ===== 連接狀態 =====
  "status.disconnected": "未連線",
  "status.connecting": "連線中",
  "status.connected": "已連線",
  "status.error": "連線錯誤",
  "status.local_gateway_found": "檢測到本機閘道器，正在連線…",
  "status.local_gateway_not_found": "找不到本機閘道器。",
  "status.connecting_remote": "正在連線到遠端閘道器…",

  // ===== Office 面板標題 =====
  "panel.inbox": "收件匣",
  "panel.inbox_desc": "查看 Agent 的活動通知",
  "panel.settings": "設定",
  "panel.skills": "技能",
  "panel.skills_marketplace": "技能市集",
  "panel.playbooks": "劇本",
  "panel.history": "歷史記錄",
  "panel.analytics": "分析",
  "panel.kanban": "看板",
  "panel.kanban_disabled": "看板未啟用",
  "panel.atm": "金庫",

  // ===== Agent 狀態 =====
  "agent.status.running": "執行中",
  "agent.status.idle": "閒置",
  "agent.status.offline": "離線",
  "agent.status.error": "錯誤",
  "agent.status.loading": "載入中…",
  "agent.no_agents": "已連線到閘道器，但辦公室中沒有載入任何 Agent。",
  "agent.agents": "Agent",
  "agent.agent": "Agent",
  "agent.needs_approval": "需要核准",

  // ===== 辦公室 UI =====
  "office.title": "辦公室",
  "office.floor.lobby": "大廳",
  "office.floor.office": "辦公室",
  "office.floor.warroom": "戰情室",
  "office.loading": "正在連線到執行時期…",
  "office.connecting_to_runtime": "正在連線到你的執行時期…",
  "office.boot": "正在啟動 Studio…",
  "office.boot_desc": "正在連線到閘道器…",

  // ===== 設定面板 =====
  "settings.gateway": "閘道器",
  "settings.gateway_connect": "連線以套用所選後端，或斷開以返回連線畫面。",
  "settings.gateway_disconnect": "斷開閘道器",
  "settings.onboarding": "新手引導",
  "settings.onboarding_reopen": "重新開啟新手引導以測試新用戶流程。",
  "settings.onboarding_reopen_btn": "重新開啟引導",
  "settings.remote_office": "遠端辦公室",
  "settings.remote_office_desc": "Claw3D 直接從瀏覽器連線到遠端 OpenClaw 閘道器並取得唯讀狀態快照。",
  "settings.studio_title": "工作室標題",
  "settings.studio_title_desc": "自訂辦公室頂部顯示的橫幅。",
  "settings.studio_ready": "就緒",
  "settings.studio_title_usage": "用於辦公室場景標題。",
  "settings.gateway_desc": "切換啟用的後端並更新其儲存的端點詳情。",
  "settings.remote_office_show": "顯示第二個辦公室",
  "settings.remote_claw3d": "遠端 Claw3D 狀態端點",
  "settings.remote_openclaw": "遠端 OpenClaw 閘道器",

  // ===== 按鈕與通用 =====
  "common.next": "下一步",
  "common.back": "上一步",
  "common.skip": "跳過",
  "common.close": "關閉",
  "common.save": "儲存",
  "common.cancel": "取消",
  "common.delete": "刪除",
  "common.edit": "編輯",
  "common.search": "搜尋",
  "common.loading": "載入中…",
  "common.error": "錯誤",
  "common.success": "成功",
  "common.copy": "複製",
  "common.reopen": "重新開啟",

  // ===== 辦公室導航 =====
  "nav.agents": "Agent",
  "nav.inbox": "收件匣",
  "nav.settings": "設定",
  "nav.skills": "技能",
  "nav.history": "歷史",
  "nav.playbooks": "劇本",
  "nav.marketplace": "市集",

  // ===== 閘道器後端描述 =====
  "gateway.backend_demo_desc": "Demo 可以在本機建立一個主要 Agent，或連接到模擬閘道器。",
};

export default zhTW;
