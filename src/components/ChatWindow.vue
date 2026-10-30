<script setup>
import { ref } from 'vue'

const emit = defineEmits(['send'])
const text = ref('')
const messages = ref([])
const isLoading = ref(false) // 请求进行中：禁用发送，防止狂点重复添加

function setLoading(value) {
  isLoading.value = !!value
}

// 供父组件调用，向消息区追加一条 AI 提示
function addAiMessage(content) {
  messages.value.push({ role: 'ai', content })
}

defineExpose({ addAiMessage, setLoading })

function handleSend() {
  if (isLoading.value) return
  const t = text.value.trim()
  if (!t) return
  // 只添加用户消息
  messages.value.push({ role: 'user', content: t })
  // 上锁，父组件处理完会调用 setLoading(false)
  isLoading.value = true
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
      <button :disabled="isLoading" @click="handleSend">
        {{ isLoading ? '解析中…' : '发送' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.chat {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 0;
  border: 1px solid #eceef1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.messages { min-height: 120px; max-height: 220px; overflow-y: auto; margin-bottom: 10px; }
.bubble {
  padding: 8px 12px; border-radius: 10px; margin-bottom: 6px; max-width: 80%;
  font-size: 13px; line-height: 1.5; word-break: break-word; transition: all 0.2s ease;
}
.bubble.user { background: #e8f2ff; color: #1f2328; margin-left: auto; }
.bubble.ai { background: #f5f6f8; color: #1f2328; border: 1px solid #eceef1; }
.hint { color: #9aa4af; font-size: 13px; }
.input-row { display: flex; gap: 8px; align-items: flex-end; }
textarea {
  flex: 1; padding: 9px 10px; border: 1px solid #e6e9ed; border-radius: 10px;
  resize: none; font-family: inherit; font-size: 13px; color: #1f2328; background: #fbfcfd;
  outline: none; transition: all 0.2s ease;
}
textarea:focus { border-color: #91caff; background: #fff; box-shadow: 0 0 0 3px rgba(22,119,255,0.1); }
button {
  padding: 9px 18px; background: #1677ff; color: #fff; border: none; border-radius: 10px;
  cursor: pointer; font-size: 13px; box-shadow: 0 2px 6px rgba(22,119,255,0.22);
  transition: all 0.2s ease;
}
button:not(:disabled):hover { background: #0e5fd8; box-shadow: 0 4px 12px rgba(22,119,255,0.3); transform: translateY(-1px); }
button:not(:disabled):active { transform: translateY(0); }
button:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; transform: none; }
</style>