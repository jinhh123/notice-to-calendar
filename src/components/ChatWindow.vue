<script setup>
import { ref } from 'vue'

const emit = defineEmits(['send'])
const text = ref('')
const messages = ref([])

// 供父组件调用，向消息区追加一条 AI 提示
function addAiMessage(content) {
  messages.value.push({ role: 'ai', content })
}

defineExpose({ addAiMessage })

function handleSend() {
  const t = text.value.trim()
  if (!t) return
  // 只添加用户消息
  messages.value.push({ role: 'user', content: t })
  // 触发父组件发送
  emit('send', t)
  // 清空输入框，不添加任何假消息
  text.value = ''
}
</script>

<template>
  <section class="chat">
    <div class="messages">
      <div v-for="(m, i) in messages" :key="i" :class="['bubble', m.role]">
        {{ m.content }}
      </div>
      <p v-if="!messages.length" class="hint">
        把通知文本粘贴到下面，点发送试试。
      </p>
    </div>
    <div class="input-row">
      <textarea
        v-model="text"
        placeholder="粘贴通知文本…"
        rows="3"
      ></textarea>
      <button @click="handleSend">发送</button>
    </div>
  </section>
</template>

<style scoped>
.chat { 
  background: #f9f9f9; 
  border-radius: 8px; 
  padding: 12px; 
  margin-bottom: 0; /* 改成 0 */
  border: 1px solid #eee;
}
.messages { min-height: 120px; margin-bottom: 8px; }
.bubble { padding: 8px 12px; border-radius: 8px; margin-bottom: 6px; max-width: 80%; }
.bubble.user { background: #d1e7ff; margin-left: auto; }
.bubble.ai { background: #eee; }
.hint { color: #999; font-size: 13px; }
.input-row { display: flex; gap: 8px; }
textarea { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 6px; resize: none; font-family: inherit; }
button { padding: 8px 16px; background: #1677ff; color: #fff; border: none; border-radius: 6px; }
</style>