<script setup>
import { computed, ref } from 'vue'
import { normalizeDate } from '../modules/parser'

const props = defineProps(['schedules'])
const emit = defineEmits(['day-click'])

const currentView = ref('month')
const now = new Date()
const year = now.getFullYear()
const month = now.getMonth()

// 获取今天的日期字符串，用于高亮
const todayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const daysInMonth = new Date(year, month + 1, 0).getDate()
const firstDay = new Date(year, month, 1).getDay()
const startPad = firstDay === 0 ? 6 : firstDay - 1

const allDays = computed(() => {
  const days = []
  for (let i = 0; i < startPad; i++) days.push({ day: null, schedules: [] })
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const daySchedules = props.schedules.filter(s => {
      if (s.isDuration && s.startDate && s.endDate) {
        return dateStr >= s.startDate && dateStr <= s.endDate
      }
      return normalizeDate(s.time) === dateStr
    })
    days.push({ day: d, dateStr, schedules: daySchedules })
  }
  
  while (days.length < 42) days.push({ day: null, schedules: [] })
  return days
})

// 判断本月是否有任何日程（用于空状态）
const hasAnySchedule = computed(() => props.schedules.length > 0)

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

// 拖拽（带边界限制）
const containerRef = ref(null)
let isResizing = false
let startX = 0, startY = 0, startWidth = 0, startHeight = 0

function startResize(e) {
  isResizing = true
  startX = e.clientX
  startY = e.clientY
  startWidth = containerRef.value.offsetWidth
  startHeight = containerRef.value.offsetHeight
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
  e.stopPropagation()
}

function onMouseMove(e) {
  if (!isResizing) return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  const maxWidth = window.innerWidth * 0.95
  const maxHeight = window.innerHeight * 0.9
  const newWidth = Math.max(320, Math.min(maxWidth, startWidth + dx))
  const newHeight = Math.max(300, Math.min(maxHeight, startHeight + dy))
  containerRef.value.style.width = newWidth + 'px'
  containerRef.value.style.height = newHeight + 'px'
}

function stopResize() {
  isResizing = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

function handleDayClick(day) {
  if (day.schedules && day.schedules.length) {
    emit('day-click', day)
  }
}

// 回到今天
function goToToday() {
  // 目前只有单月视图，后续支持翻月时可以在这里设置当前月份
  alert('当前已经是本月视图，后续添加翻月功能后可一键跳转。')
}
</script>

<template>
  <div ref="containerRef" class="calendar-container">
    <div class="header">
      <div class="header-left">
        <span>{{ year }}年{{ month + 1 }}月</span>
        <button class="today-btn" @click="goToToday">今天：{{ now.getMonth() + 1 }}月{{ now.getDate() }}日</button>
      </div>
      
      <div class="view-toggle">
        <button :class="{ active: currentView === 'month' }" @click="currentView = 'month'">月</button>
        <button :class="{ active: currentView === 'week' }" @click="currentView = 'week'">周</button>
        <button :class="{ active: currentView === 'day' }" @click="currentView = 'day'">日</button>
      </div>
      <span class="hint">拖拽右下角调整大小</span>
    </div>
    
    <div class="calendar-scroll-wrapper">
      <div class="calendar-grid">
        <div class="weekday-cell" v-for="w in weekDays" :key="w">{{ w }}</div>
        
        <div 
          v-for="(day, index) in allDays" 
          :key="index"
          class="day-cell"
          :class="{ 
            'other-month': !day.day, 
            'has-event': day.schedules.length > 0,
            'is-important': day.schedules.some(s => s.isImportant),
            'is-today': day.dateStr === todayStr
          }"
          @click="handleDayClick(day)"
        >
          <div class="day-header" v-if="day.day">{{ day.day }}</div>
          
          <!-- 精简信息：只显示标题，少量信息用省略号 -->
          <div class="events-container" v-if="day.schedules.length">
            <div 
              v-for="s in day.schedules.filter(s => {
                if (!s.isDuration) return true;
                return s.startDate === day.dateStr || s.endDate === day.dateStr;
              })" 
              :key="'text-' + s.id" 
              class="event-text"
              :style="{ color: s.color }"
              :title="`${s.title} ${s.time || ''} ${s.location || ''}`"
              @click.stop="handleDayClick(day)"
            >
              <span v-if="s.isImportant" class="badge">[重要]</span>
              <span v-if="s.isDuration" class="duration-mark">{{ s.startDate === day.dateStr ? '【起】' : '【止】' }}</span>
              <span class="event-title">{{ s.title }}</span>
            </div>
          </div>

          <!-- 底部线条区域 -->
          <div class="lines-container" v-if="day.schedules.filter(s => s.isDuration).length">
            <div v-for="s in day.schedules.filter(s => s.isDuration).slice().reverse()" :key="'line-' + s.id" class="line-wrapper">
              <div 
                class="event-line" 
                :style="{ backgroundColor: s.color || '#1677ff' }"
                @click.stop="handleDayClick(day)"
                title="点击查看持续日程详情"
              ></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 空状态引导 -->
      <div v-if="!hasAnySchedule" class="empty-state">
        <p>📭 本月暂无日程</p>
        <p class="sub-hint">去左侧粘贴一条通知试试吧～</p>
      </div>
    </div>
    <div class="resize-handle" @mousedown="startResize"></div>
  </div>
</template>

<style scoped>
.calendar-container {
  width: 100%; height: 600px; border: 1px solid #eceef1; border-radius: 12px;
  background: #fff; padding: 14px; min-width: 320px; min-height: 300px;
  box-sizing: border-box; position: relative; display: flex; flex-direction: column;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.header { display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #1f2328; flex-shrink: 0; }
.header-left { display: flex; align-items: center; gap: 12px; }

.today-btn {
  font-size: 12px; padding: 5px 11px; background: #f2f7ff; color: #1677ff;
  border: 1px solid #d6e6ff; border-radius: 8px; cursor: pointer; font-weight: normal;
  transition: all 0.2s ease;
}
.today-btn:hover { background: #e8f2ff; border-color: #b3d4ff; box-shadow: 0 2px 8px rgba(22,119,255,0.12); }

.view-toggle { display: flex; gap: 4px; }
.view-toggle button {
  padding: 3px 10px; font-size: 12px; border: 1px solid #e6e9ed; background: #fff;
  color: #57606a; border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
}
.view-toggle button:hover { background: #f2f4f7; color: #1f2328; }
.view-toggle button.active { background: #1677ff; color: #fff; border-color: #1677ff; box-shadow: 0 2px 8px rgba(22,119,255,0.25); }
.hint { font-size: 12px; color: #9aa4af; font-weight: normal; }

.calendar-scroll-wrapper { flex: 1; overflow: auto; position: relative; border-radius: 10px; }
.calendar-grid {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(110px, 1fr); gap: 1px;
  background-color: #f0f2f5; border: 1px solid #f0f2f5; border-radius: 10px;
  overflow: hidden; width: 100%; min-height: 100%;
}
.weekday-cell { background: #fafbfc; text-align: center; padding: 8px 0; font-size: 12px; color: #8b949e; font-weight: 600; }

.day-cell {
  background: #fff; padding: 6px 4px 4px 4px; display: flex; flex-direction: column;
  position: relative; cursor: pointer; transition: background 0.2s ease;
}
.day-cell:hover { background: #f8fafc; }
.day-cell.other-month { background: #fdfdfe; cursor: default; }
.day-cell.other-month .day-header { color: #d9dee5; }

/* 核心：今天高亮 */
.day-cell.is-today {
  background: #f0f7ff;
  border: 1px solid #1677ff;
  box-shadow: inset 0 0 0 1px #1677ff;
}
.day-cell.is-today .day-header { color: #1677ff; font-weight: 700; }

.day-cell.is-important { background: #fff8f8; border: 1px dashed #ffb3b0; }
.day-cell.is-important.is-today { border: 2px solid #1677ff; background: #fff8f8; } /* 今天和重要同时存在时，蓝框优先 */

.day-header { font-weight: 600; font-size: 12px; margin-bottom: 4px; color: #1f2328; }
.events-container { flex-grow: 1; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }

/* 精简文字样式 */
.event-text {
  font-size: 11px; line-height: 1.3; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; padding: 1px 3px;
  transition: transform 0.2s ease, background 0.2s ease; /* 悬停放大效果 */
  border-radius: 4px;
}
.event-text:hover { transform: scale(1.05); background: #f2f4f7; z-index: 10; position: relative; }

.badge { color: #f5222d; font-weight: 600; margin-right: 2px; }
.duration-mark { color: #9aa4af; font-size: 10px; margin-right: 2px; }
.event-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 100%; vertical-align: bottom; }

.lines-container { margin-top: auto; display: flex; flex-direction: column-reverse; gap: 4px; width: 100%; padding-top: 4px; }
.line-wrapper { display: flex; align-items: center; gap: 4px; width: 100%; }
.event-line { flex: 1; height: 6px; border-radius: 3px; cursor: pointer; transition: all 0.2s ease; opacity: 0.85; }
.event-line:hover { filter: brightness(1.15); opacity: 1; box-shadow: 0 2px 8px rgba(0,0,0,0.18); transform: scaleY(1.2); }

/* 空状态引导 */
.empty-state {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #9aa4af; pointer-events: none; /* 让鼠标穿透，不影响底层日历 */
}
.empty-state p { font-size: 16px; margin-bottom: 8px; }
.empty-state .sub-hint { font-size: 13px; color: #c2c9d1; }

.resize-handle {
  position: absolute; bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, #ccd2d9 50%); border-radius: 0 0 12px 0; z-index: 999;
  transition: background 0.2s ease;
}
.resize-handle:hover { background: linear-gradient(135deg, transparent 50%, #9aa4af 50%); }
</style>