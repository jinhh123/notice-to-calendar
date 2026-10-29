<script setup>
import { ref, computed } from 'vue'
import ChatWindow from './components/ChatWindow.vue'
import CalendarView from './components/CalendarView.vue'
import { parseText } from './modules/parser'
import { loadSchedules, addSchedule, removeSchedule, updateSchedule } from './modules/storage'
// 注意：这里假设你已经把 ics.js 改成了 exporter.js 并实现了图片导出。如果还没改，这行会报错，请告诉我。
import { exportToImage } from './modules/exporter'

const schedules = ref(loadSchedules())
const selectedDay = ref(null)
const currentView = ref('calendar')
const sidebarCollapsed = ref(false) // 新增：控制侧边栏折叠
const chatWindowRef = ref(null) // 新增：用于向聊天窗口回写提示消息

async function handleSend(text) {
  try {
    // 调用 AI 解析
    const parsed = await parseText(text)

    // 失败拦截：既没有时间描述，也没有起始日期，视为无效日程
    if (!parsed.time && !parsed.startDate) {
      chatWindowRef.value?.addAiMessage('❌ 未识别到有效的时间信息，请补充具体的日期或时间。')
      return // 不写入存储，直接终止
    }

    // 存入本地
    schedules.value = addSchedule(parsed)

    // 成功反馈
    chatWindowRef.value?.addAiMessage('✅ 已添加：' + parsed.title)
  } catch (err) {
    console.error('解析失败:', err)
    chatWindowRef.value?.addAiMessage('❌ AI 解析失败了，请检查网络或 API 额度。')
  }
}
function handleRemove(id) {
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
  await exportToImage('calendar-wrapper')
}

function handleDayClick(day) {
  selectedDay.value = day
}

function closeModal() {
  selectedDay.value = null
}

const sortedSchedules = computed(() => {
  return [...schedules.value].sort((a, b) => b.id - a.id)
})
</script>

<template>
  <div class="app-layout">
    <!-- 左侧边栏（支持折叠） -->
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-top">
        <div class="logo" v-if="!sidebarCollapsed">通知随手记</div>
        <button class="collapse-btn" @click="sidebarCollapsed = !sidebarCollapsed">
          {{ sidebarCollapsed ? '☰' : '◀' }}
        </button>
      </div>
      
      <nav class="nav" v-if="!sidebarCollapsed">
        <a class="nav-item" :class="{ active: currentView === 'calendar' }" @click="currentView = 'calendar'">📅 日历视图</a>
        <a class="nav-item" :class="{ active: currentView === 'list' }" @click="currentView = 'list'">📋 所有日程</a>
        <a class="nav-item">⚙️ 设置</a>
      </nav>
      
      <div class="sidebar-bottom" v-if="!sidebarCollapsed">
        <ChatWindow ref="chatWindowRef" @send="handleSend" />
      </div>
    </aside>

    <!-- 右侧主内容区 -->
    <main class="main-content">
      <header class="main-header">
        <h1>{{ currentView === 'calendar' ? '我的日程' : '所有日程清单' }}</h1>
        <button class="export" @click="handleExport">导出图片</button>
      </header>
      
      <div class="content-body">
        <div v-if="currentView === 'calendar'" id="calendar-wrapper">
          <CalendarView :schedules="schedules" @day-click="handleDayClick" />
        </div>
        
        <div v-else class="list-view">
          <div v-if="!sortedSchedules.length" class="empty-hint">暂无日程，去左侧粘贴一条通知试试吧～</div>
          <div v-for="s in sortedSchedules" :key="s.id" class="list-item">
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
          {{ selectedDay.day }}日 日程详情
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
.app-layout { display: flex; height: 100vh; background: #f0f2f5; font-family: -apple-system, "PingFang SC", sans-serif; }

/* 侧边栏样式（支持折叠） */
.sidebar {
  width: 300px; background: #fff; border-right: 1px solid #e0e0e0;
  display: flex; flex-direction: column; padding: 16px;
  box-shadow: 2px 0 8px rgba(0,0,0,0.05); z-index: 10;
  transition: width 0.3s ease; overflow: hidden;
}
.sidebar.collapsed { width: 48px; padding: 8px; }
.sidebar-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.collapse-btn { background: none; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 14px; padding: 2px 8px; color: #666; flex-shrink: 0; }
.collapse-btn:hover { background: #f0f0f0; }
.logo { font-size: 18px; font-weight: bold; color: #1677ff; white-space: nowrap; }
.nav { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
.nav-item { padding: 8px 12px; border-radius: 6px; color: #555; text-decoration: none; cursor: pointer; transition: all 0.2s; font-size: 14px; }
.nav-item:hover { background: #f0f2f5; }
.nav-item.active { background: #e6f7ff; color: #1677ff; font-weight: 500; }
.sidebar-bottom { margin-top: auto; }

/* 主内容区样式 */
.main-content { flex: 1; display: flex; flex-direction: column; padding: 20px; overflow: hidden; }
.main-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.main-header h1 { font-size: 20px; color: #333; }
.export { background: #52c41a; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
.content-body { flex: 1; overflow: hidden; background: #fff; border-radius: 8px; padding: 16px; border: 1px solid #e8e8e8; }

/* 列表视图样式 */
.list-view { height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.empty-hint { text-align: center; color: #999; margin-top: 40px; }
.list-item { border: 1px solid #eee; border-radius: 8px; padding: 16px; background: #fff; }
.list-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.list-title { font-size: 15px; font-weight: bold; color: #333; }
.list-item-body p { margin: 4px 0; font-size: 13px; color: #666; }

/* 弹窗样式 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: center; z-index: 100; }
.modal-content { background: #fff; padding: 24px; border-radius: 12px; width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.modal-content h3 { margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.duration-tip { font-size: 12px; color: #faad14; font-weight: normal; margin-left: 6px; }
.detail-item { border: 1px solid #eee; padding: 16px; margin-bottom: 16px; border-radius: 8px; background: #fafafa; position: relative; }
.form-group { margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.form-group label { width: 70px; font-size: 13px; color: #555; flex-shrink: 0; }
.form-group input[type="text"], .form-group input[type="date"], .form-group input:not([type]) { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
.checkbox-group label { width: auto; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.date-range input { flex: 1; }
.color-preview { display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #ddd; margin-left: 8px; }
pre { white-space: pre-wrap; font-size: 12px; color: #666; background: #fff; padding: 8px; border-radius: 4px; margin-top: 6px; }
.delete-btn { background: #ff4d4f; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
.close-btn { width: 100%; padding: 12px; background: #1677ff; color: #fff; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; font-size: 14px; }
.important-badge { color: #ff4d4f; font-size: 12px; margin-right: 4px; }
</style>