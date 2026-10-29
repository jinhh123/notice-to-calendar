// 当前用 localStorage，后续可换 IndexedDB 或云端，调用方不用改。

const KEY = 'notice_schedules'

export function loadSchedules() {
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : []
}

export function saveSchedules(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function addSchedule(item) {
  const list = loadSchedules()
  item.id = Date.now().toString()
  list.unshift(item)
  saveSchedules(list)
  return list
}

export function removeSchedule(id) {
  const list = loadSchedules().filter(i => i.id !== id)
  saveSchedules(list)
  return list
}
export function updateSchedule(id, updates) {
  const list = loadSchedules()
  const index = list.findIndex(i => i.id === id)
  if (index !== -1) {
    list[index] = { ...list[index], ...updates }
    saveSchedules(list)
  }
  return list
}