<script setup>
import { ref, computed } from 'vue'
import ChatWindow from './components/ChatWindow.vue'
import CalendarView from './components/CalendarView.vue'
import TimelineView from './components/TimelineView.vue'
import { parseText, normalizeDate } from './modules/parser'
import { loadSchedules, addSchedule, removeSchedule, updateSchedule } from './modules/storage'
// 注意：这里假设你已经把 ics.js 改成了 exporter.js 并实现了图片导出。如果还没改，这行会报错，请告诉我。
import { exportToImage } from './modules/exporter'
import { exportToICS } from './modules/icsExporter'

const schedules = ref(loadSchedules())
const selectedDay = ref(null)
const currentView = ref('calendar')
const sidebarCollapsed = ref(false) // 新增：控制侧边栏折叠
const chatWindowRef = ref(null) // 新增：用于向聊天窗口回写提示消息
const isParsing = ref(false) // 解析中：防重复提交
const drawerOpen = ref(false) // 移动端抽屉是否展开

// 日程的日期键：持续日程取 startDate，单日日程从 time 归一化
function dateKey(s) {
  return s.startDate || normalizeDate(s.time) || ''
}

// 去重：标题 + 日期完全一致视为同一条
function isDuplicate(item) {
  const key = dateKey(item)
  if (!key) return false
  return schedules.value.some(s => (s.title || '') === (item.title || '') && dateKey(s) === key)
}

async function handleSend(text) {
  // ChatWindow 已禁用按钮，这里再挡一次，防止任何途径的重复触发
  if (isParsing.value) return
  isParsing.value = true

  try {
    // 调用 AI 解析
    const parsed = await parseText(text)

    // 失败拦截：没有结果，或既没有时间也没有起始日期，一律视为无效
    if (!parsed || (!parsed.time && !parsed.startDate)) {
      throw new Error('未识别到有效的时间信息')
    }

    // 去重：已存在则不重复写入
    if (isDuplicate(parsed)) {
      chatWindowRef.value?.addAiMessage('⚠️ 该日程已存在：' + parsed.title)
      return
    }

    // 只有通过校验才写入存储
    schedules.value = addSchedule(parsed)

    // 走了本地降级时给出提示
    if (parsed.isFallback) {
      chatWindowRef.value?.addAiMessage('⚡ 网络延迟，已启用本地极速解析')
    }

    // 成功反馈
    chatWindowRef.value?.addAiMessage('✅ 已添加：' + parsed.title)
  } catch (err) {
    // 解析异常 / 文本无效，统一拦在这里：只提示，绝不落库
    console.error('解析失败:', err)
    chatWindowRef.value?.addAiMessage('❌ 未识别到有效的时间信息，请补充具体的日期或时间。')
  } finally {
    // 无论成功失败都要解锁，否则按钮会一直停在「解析中…」
    isParsing.value = false
    chatWindowRef.value?.setLoading(false)
  }
}
function handleRemove(id) {
  if (!confirm('确定要删除这个日程吗？')) return
  schedules.value = removeSchedule(id)
  if (selectedDay.value) {
    selectedDay.value.schedules = selectedDay.value.schedules.filter(s => s.id !== id)
    if (selectedDay.value.schedules.length === 0) selectedDay.value = null
  }
}

function handleSave(schedule) {
  schedules.value = updateSchedule(schedule.id, schedule)
  if (selectedDay.value) {
    const updated = schedules.value.find(s => s.id === schedule.id)
    if (updated) Object.assign(schedule, updated)
  }
}

async function handleExport() {
  if (!schedules.value.length) return alert('还没有日程可导出')
  if (currentView.value === 'list') return alert('请切换到日历视图或时间线视图后再导出')
  const target = currentView.value === 'timeline' ? 'timeline-wrapper' : 'calendar-wrapper'
  await exportToImage(target)
}

// 导出 .ics：可导入系统日历 / Google Calendar / Outlook，与视图无关
function handleExportICS() {
  if (!schedules.value.length) return alert('还没有日程可导出')
  exportToICS(schedules.value)
}

function handleDayClick(day) {
  selectedDay.value = day
}

function closeModal() {
  selectedDay.value = null
}

// 切换视图（移动端同时收起抽屉）
function switchView(view) {
  currentView.value = view
  drawerOpen.value = false
}

// 弹窗标题：优先用 dateStr 拼出「11月2日」，避免跨月歧义
function formatDayTitle(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day?.dateStr || '')
  if (!m) return `${day?.day ?? ''}日 日程详情`
  return `${Number(m[2])}月${Number(m[3])}日 日程详情`
}

const sortedSchedules = computed(() => {
  return [...schedules.value].sort((a, b) => b.id - a.id)
})

// 顶部标题随视图切换
const viewTitle = computed(() => {
  if (currentView.value === 'timeline') return '排期时间线'
  return currentView.value === 'calendar' ? '我的日程' : '所有日程清单'
})
</script>

<template>
  <div class="app-layout">
    <!-- 移动端抽屉遮罩：点击关闭 -->
    <div class="drawer-mask" v-if="drawerOpen" @click="drawerOpen = false"></div>

    <!-- 左侧边栏（桌面端折叠 / 移动端抽屉） -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed, 'drawer-open': drawerOpen }">
      <div class="sidebar-top">
        <div class="logo" v-if="!sidebarCollapsed">通知随手记</div>
        <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          {{ sidebarCollapsed ? '☰' : '◀' }}
        </button>
      </div>
      
      <nav class="nav" v-if="!sidebarCollapsed">
        <a class="nav-item" :class="{ active: currentView === 'calendar' }" @click="switchView('calendar')">📅 日历视图</a>
        <a class="nav-item" :class="{ active: currentView === 'timeline' }" @click="switchView('timeline')">📊 时间线视图</a>
        <a class="nav-item" :class="{ active: currentView === 'list' }" @click="switchView('list')">📋 所有日程</a>
        <a class="nav-item">⚙️ 设置</a>
      </nav>
      
      <div class="sidebar-bottom" v-show="!sidebarCollapsed">
        <ChatWindow ref="chatWindowRef" :parsing="isParsing" @send="handleSend" />
      </div>
    </aside>

    <!-- 右侧主内容区 -->
    <main class="main-content">
      <header class="main-header">
        <button class="menu-btn" @click="drawerOpen = true" aria-label="打开菜单">☰</button>
        <h1>{{ viewTitle }}</h1>
        <div class="actions">
          <button class="export ghost" @click="handleExportICS">导出日历(.ics)</button>
          <button class="export" @click="handleExport">导出图片</button>
        </div>
      </header>
      
      <div class="content-body">
        <div v-if="currentView === 'calendar'" id="calendar-wrapper">
          <CalendarView :schedules="schedules" @day-click="handleDayClick" />
        </div>

        <div v-else-if="currentView === 'timeline'" id="timeline-wrapper">
          <TimelineView :schedules="schedules" />
        </div>

        <div v-else class="list-view">
          <div v-if="!sortedSchedules.length" class="empty-hint">暂无日程，去左侧粘贴一条通知试试吧～</div>
          <div
            v-for="s in sortedSchedules"
            :key="s.id"
            class="list-item"
            :style="{ '--accent': s.color || '#1677ff' }"
          >
            <div class="list-item-header">
              <span class="list-title">
                <span v-if="s.isImportant" class="important-badge">⚠️ 重要</span>
                {{ s.title || '未命名日程' }}
              </span>
              <button class="delete-btn" @click="handleRemove(s.id)">删除</button>
            </div>
            <div class="list-item-body">
              <p v-if="s.time">🕐 {{ s.time }}</p>
              <p v-if="s.location">📍 {{ s.location }}</p>
              <p v-if="s.items && s.items.length">🎒 {{ s.items.join('、') }}</p>
              <p v-if="s.unit">🏢 {{ s.unit }}</p>
              <p v-if="s.credit">📚 {{ s.credit }} 学分</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 日程详情弹窗（优化提示） -->
    <div class="modal-overlay" v-if="selectedDay" @click.self="closeModal">
      <div class="modal-content">
        <h3>
          {{ formatDayTitle(selectedDay) }}
          <span v-if="selectedDay.schedules.some(s => s.isDuration)" class="duration-tip">
            （含持续日程）
          </span>
        </h3>
        <div class="detail-list">
          <div v-for="s in selectedDay.schedules" :key="s.id" class="detail-item">
            <div class="form-group">
              <label>标题：</label>
              <input v-model="s.title" @change="handleSave(s)" />
            </div>
            <div class="form-group">
              <label>时间：</label>
              <input v-model="s.time" @change="handleSave(s)" />
            </div>
            <div class="form-group">
              <label>地点：</label>
              <input v-model="s.location" @change="handleSave(s)" />
            </div>
            <div class="form-group">
              <label>单位：</label>
              <input v-model="s.unit" @change="handleSave(s)" />
            </div>
            <div class="form-group">
              <label>学分：</label>
              <input v-model="s.credit" @change="handleSave(s)" />
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="s.isImportant" @change="handleSave(s)" />
                标记为重要日程（显示 ⚠️ 提醒）
              </label>
            </div>
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="s.isDuration" @change="handleSave(s)" />
                标记为持续一段时间的日程
              </label>
            </div>
            <div v-if="s.isDuration" class="form-group date-range">
              <label>开始日期：</label>
              <input type="date" v-model="s.startDate" @change="handleSave(s)" />
              <label>结束日期：</label>
              <input type="date" v-model="s.endDate" @change="handleSave(s)" />
            </div>
            <div class="form-group">
              <label>日程颜色：</label>
              <input type="color" v-model="s.color" @change="handleSave(s)" />
              <span class="color-preview" :style="{ background: s.color }"></span>
            </div>
            <details>
              <summary>查看原文</summary>
              <pre>{{ s.source }}</pre>
            </details>
            <button class="delete-btn" @click="handleRemove(s.id)">删除此项</button>
          </div>
        </div>
        <button class="close-btn" @click="closeModal">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex; height: 100vh; background: #f9fafb;
  font-family: -apple-system, "PingFang SC", sans-serif; color: #1f2328;
  width: 100%; max-width: 100%; overflow-x: hidden; box-sizing: border-box;
}

/* 侧边栏样式（支持折叠） */
.sidebar {
  width: 300px; background: #fff; border-right: 1px solid #eceef1;
  display: flex; flex-direction: column; padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03); z-index: 10;
  transition: width 0.3s ease; overflow: hidden;
}
.sidebar.collapsed { width: 48px; padding: 8px; }
.sidebar-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.collapse-btn {
  background: #fff; border: 1px solid #eceef1; border-radius: 8px; cursor: pointer;
  font-size: 14px; padding: 3px 9px; color: #8b949e; flex-shrink: 0;
  transition: all 0.2s ease;
}
.collapse-btn:hover { background: #f2f4f7; border-color: #d8dde3; color: #57606a; }
.logo { font-size: 18px; font-weight: 700; color: #1677ff; white-space: nowrap; letter-spacing: 0.3px; }
.nav { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
.nav-item {
  padding: 9px 12px; border-radius: 10px; color: #57606a; text-decoration: none;
  cursor: pointer; transition: all 0.2s ease; font-size: 14px;
}
.nav-item:hover { background: #f2f4f7; color: #1f2328; }
.nav-item.active { background: #e8f2ff; color: #1677ff; font-weight: 600; }
.sidebar-bottom { margin-top: auto; }

/* 主内容区样式 */
.main-content {
  flex: 1; display: flex; flex-direction: column; padding: 24px;
  overflow: hidden; background: #f9fafb;
  width: 100%; max-width: 100%; min-width: 0;
  overflow-x: hidden; box-sizing: border-box;
}
.main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.main-header h1 { font-size: 20px; font-weight: 650; color: #1f2328; margin: 0; }
.export {
  background: #52c41a; color: #fff; border: none; padding: 9px 18px; border-radius: 10px;
  cursor: pointer; font-size: 14px; box-shadow: 0 2px 6px rgba(82,196,26,0.25);
  transition: all 0.2s ease;
  white-space: nowrap; flex: 0 1 auto; min-width: 0; max-width: 100%;
}
.export:hover { background: #46a816; box-shadow: 0 4px 12px rgba(82,196,26,0.32); transform: translateY(-1px); }
.export:active { transform: translateY(0); }

.actions { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.export.ghost {
  background: #fff; color: #1677ff; border: 1px solid #d6e6ff;
  box-shadow: 0 2px 6px rgba(22,119,255,0.12);
}
.export.ghost:hover {
  background: #f2f7ff; border-color: #b3d4ff;
  box-shadow: 0 4px 12px rgba(22,119,255,0.18); transform: translateY(-1px);
}
.content-body {
  flex: 1; overflow: hidden; background: #fff; border-radius: 12px; padding: 18px;
  border: 1px solid #f0f1f3; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
#calendar-wrapper, #timeline-wrapper { height: 100%; }

/* 列表视图样式 */
.list-view { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 4px; }
.empty-hint { text-align: center; color: #9aa4af; margin-top: 40px; font-size: 14px; }
.list-item {
  position: relative; overflow: hidden;
  border: 1px solid #eceef1; border-radius: 12px; padding: 16px 16px 16px 20px;
  background: #fbfcfd;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: all 0.2s ease;
}
/* 左侧颜色竖条：颜色取自该日程的 color */
.list-item::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: var(--accent, #1677ff);
}
.list-item:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.08); border-color: #e3e7ec; transform: translateY(-1px); }
.list-item-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; }
.list-title { font-size: 15px; font-weight: 600; color: #1f2328; }
.list-item-body p { margin: 4px 0; font-size: 13px; color: #6b7684; }

/* 弹窗样式 */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(28,32,38,0.45);
  display: flex; justify-content: center; align-items: center; z-index: 100;
  backdrop-filter: blur(2px);
}
.modal-content {
  background: #fff; padding: 24px; border-radius: 16px; width: 90%; max-width: 600px;
  max-height: 85vh; overflow-y: auto; border: 1px solid #eceef1;
  box-shadow: 0 12px 40px rgba(0,0,0,0.16);
}
.modal-content h3 { margin-top: 0; border-bottom: 1px solid #f0f2f5; padding-bottom: 12px; font-size: 17px; color: #1f2328; }
.duration-tip { font-size: 12px; color: #d48806; font-weight: normal; margin-left: 6px; }
.detail-item {
  border: 1px solid #eceef1; padding: 16px; margin-bottom: 14px; border-radius: 12px;
  background: #fbfcfd; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.04);
}
.form-group { margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.form-group label { width: 70px; font-size: 13px; color: #57606a; flex-shrink: 0; }
.form-group input[type="text"], .form-group input[type="date"], .form-group input:not([type]) {
  flex: 1; padding: 7px 10px; border: 1px solid #e6e9ed; border-radius: 8px; font-size: 13px;
  color: #1f2328; background: #fff; outline: none; transition: all 0.2s ease;
}
.form-group input:focus { border-color: #91caff; box-shadow: 0 0 0 3px rgba(22,119,255,0.1); }
.checkbox-group label { width: auto; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.date-range input { flex: 1; }
.color-preview { display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #eceef1; margin-left: 8px; }
pre {
  white-space: pre-wrap; font-size: 12px; color: #6b7684; background: #f7f8fa;
  padding: 10px; border-radius: 8px; margin-top: 6px; border: 1px solid #f0f2f5;
}
.delete-btn {
  background: #fff; color: #f5222d; border: 1px solid #ffd8d6; padding: 6px 12px;
  border-radius: 8px; cursor: pointer; font-size: 12px; transition: all 0.2s ease;
}
.delete-btn:hover { background: #fff1f0; border-color: #ffa39e; box-shadow: 0 2px 8px rgba(245,34,45,0.12); }
.close-btn {
  width: 100%; padding: 12px; background: #1677ff; color: #fff; border: none;
  border-radius: 10px; cursor: pointer; margin-top: 12px; font-size: 14px;
  transition: all 0.2s ease;
}
.close-btn:hover { background: #0e5fd8; box-shadow: 0 4px 12px rgba(22,119,255,0.28); }
.important-badge { color: #f5222d; font-size: 12px; margin-right: 4px; }

/* 移动端汉堡按钮：桌面端隐藏 */
.menu-btn {
  display: none;
  align-items: center; justify-content: center;
  width: 34px; height: 34px; flex-shrink: 0;
  border: 1px solid #eceef1; background: #fff; border-radius: 9px;
  color: #57606a; font-size: 16px; line-height: 1;
  cursor: pointer; transition: all 0.2s ease;
}
.menu-btn:hover { background: #f4f4f5; color: #1f2328; }

/* 抽屉遮罩：仅移动端渲染 */
.drawer-mask { display: none; }

/* ================= 移动端适配 ================= */
@media (max-width: 768px) {
  .app-layout { flex-direction: column; height: 100dvh; }

  /* 遮罩 */
  .drawer-mask {
    display: block; position: fixed; inset: 0; z-index: 150;
    background: rgba(0, 0, 0, 0.45);
  }

  /* 侧边栏改为抽屉：默认移出屏幕，展开时滑入 */
  .sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; z-index: 200;
    width: 82vw; max-width: 320px; padding: 16px;
    transform: translateX(-100%);
    transition: transform 0.28s ease;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  }
  .sidebar.collapsed { width: 82vw; padding: 16px; }
  .sidebar.drawer-open { transform: translateX(0); }
  .collapse-btn { display: none; }

  /* 主内容区 */
  .main-content { padding: 12px; min-width: 0; overflow-x: hidden; }
  .main-header { flex-wrap: wrap; row-gap: 8px; gap: 8px; margin-bottom: 12px; }
  .menu-btn { display: flex; }
  .main-header h1 {
    flex: 1; min-width: 0; font-size: 17px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  /* 按钮独占一行，避免和标题抢宽度被裁切 */
  .actions { flex: 1 0 100%; justify-content: flex-start; gap: 6px; }
  .export { padding: 7px 12px; font-size: 12px; border-radius: 8px; }

  .content-body { padding: 10px; border-radius: 10px; }
  .nav-item { padding: 11px 12px; } /* 放大触控区域 */
}
</style>