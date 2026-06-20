<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-bold text-slate-400">批量参数编辑</h3>
      <div v-if="store.hasChanges" class="flex items-center gap-2">
        <span class="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
          {{ store.paramChanges.length }} 处变更
        </span>
      </div>
    </div>

    <div v-if="Object.keys(store.currentScenario.paramMeta).length === 0" 
         class="text-center py-6 text-slate-500 text-sm">
      <div class="text-2xl mb-2">⚙️</div>
      当前场景无可配置参数
    </div>

    <div v-else class="space-y-3">
      <div v-for="(meta, key) in store.currentScenario.paramMeta" :key="key"
           class="relative group">
        <div :class="['p-3 rounded-lg border transition-all', 
          isChanged(key) ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-700 bg-slate-900/50']">
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-slate-200">{{ meta.name }}</span>
                <span v-if="isChanged(key)" class="text-xs px-1.5 py-0.5 bg-amber-500/30 text-amber-300 rounded">
                  已修改
                </span>
              </div>
              <div class="text-xs text-slate-500 mt-0.5">{{ meta.description }}</div>
            </div>
            <button v-if="isChanged(key)" 
                    @click="store.resetParam(key as string)"
                    class="text-xs text-slate-400 hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100">
              重置
            </button>
          </div>

          <div class="flex items-center gap-3">
            <input type="range" 
                   :min="meta.min" :max="meta.max" :step="meta.step"
                   :value="store.editingParams[key as string]"
                   @input="onSliderInput(key as string, ($event.target as HTMLInputElement).value)"
                   class="flex-1 accent-cyan-500" />
            <div class="flex items-center gap-1">
              <input type="number" 
                     :min="meta.min" :max="meta.max" :step="meta.step"
                     :value="store.editingParams[key as string]"
                     @input="onNumberInput(key as string, ($event.target as HTMLInputElement).value)"
                     class="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-right text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500" />
              <span v-if="meta.unit" class="text-xs text-slate-500 w-6">{{ meta.unit }}</span>
            </div>
          </div>

          <div class="flex items-center justify-between mt-2 text-xs">
            <div class="text-slate-600">{{ meta.min }} ~ {{ meta.max }}</div>
            <div v-if="isChanged(key)" class="flex items-center gap-1 text-amber-400">
              <span class="text-slate-500">默认:</span>
              <span class="font-mono">{{ store.currentScenario.params[key as string] }}</span>
              <span class="mx-1">→</span>
              <span class="font-mono font-bold">{{ store.editingParams[key as string] }}</span>
            </div>
          </div>

          <div class="mt-2 flex flex-wrap gap-1">
            <span class="text-xs text-slate-500">影响:</span>
            <span v-for="m in meta.affectedMetrics" :key="m"
                  :class="['text-xs px-1.5 py-0.5 rounded', 
                    isMetricHighlighted(m) ? 'bg-cyan-500/30 text-cyan-300' : 'bg-slate-700 text-slate-400']">
              {{ m }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="store.hasChanges" 
           class="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-cyan-400">📊</span>
          <span class="text-sm font-medium text-cyan-300">变更影响分析</span>
        </div>
        <div class="text-xs text-slate-400 mb-2">
          以下 <span class="text-cyan-400 font-bold">{{ store.affectedMetrics.length }}</span> 项结果指标将受影响：
        </div>
        <div class="flex flex-wrap gap-1.5 mb-3">
          <span v-for="m in store.affectedMetrics" :key="m"
                class="text-xs px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded font-medium">
            {{ m }}
          </span>
        </div>
        <div class="space-y-1">
          <div v-for="change in store.paramChanges" :key="change.key"
               class="flex items-center justify-between text-xs bg-slate-900/50 rounded px-2 py-1">
            <span class="text-slate-400">
              {{ store.currentScenario.paramMeta[change.key]?.name }}
            </span>
            <span class="font-mono">
              <span class="text-slate-500">{{ formatValue(change.oldValue) }}</span>
              <span class="text-slate-600 mx-1">→</span>
              <span class="text-amber-400">{{ formatValue(change.newValue) }}</span>
              <span class="text-slate-600 ml-1">({{ formatDiff(change.oldValue, change.newValue) }})</span>
            </span>
          </div>
        </div>
      </div>

      <div class="flex gap-2 pt-2">
        <button @click="store.resetAllParams" 
                :disabled="!store.hasChanges"
                class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded text-sm font-medium text-slate-300 transition-colors">
          重置全部
        </button>
        <button @click="showPresetModal = true"
                class="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded text-sm font-medium text-purple-300 transition-colors">
          预设
        </button>
        <button @click="openSavePreset"
                :disabled="!store.hasChanges"
                class="px-3 py-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 disabled:opacity-30 rounded text-sm font-medium text-green-300 transition-colors">
          保存
        </button>
      </div>
    </div>

    <div v-if="showPresetModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showPresetModal = false">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-200">参数预设</h3>
          <button @click="showPresetModal = false" class="text-slate-400 hover:text-slate-200">✕</button>
        </div>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          <div v-for="preset in applicablePresets" :key="preset.id"
               class="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition-colors">
            <div>
              <div class="text-sm font-medium text-slate-200">{{ preset.name }}</div>
              <div class="text-xs text-slate-500">
                {{ Object.keys(preset.params).length }} 个参数 · {{ preset.iterations }} 次迭代
              </div>
            </div>
            <div class="flex gap-1">
              <button @click="applyPreset(preset)"
                      class="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 rounded text-xs font-medium">
                应用
              </button>
              <button v-if="preset.id.startsWith('custom-')"
                      @click="store.deletePreset(preset.id)"
                      class="px-2 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded text-xs">
                删除
              </button>
            </div>
          </div>
          <div v-if="applicablePresets.length === 0" class="text-center py-8 text-slate-500 text-sm">
            当前场景暂无可用预设
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSaveModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showSaveModal = false">
      <div class="bg-slate-800 rounded-xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
        <h3 class="text-lg font-bold text-slate-200 mb-4">保存为预设</h3>
        <input v-model="presetName" type="text" placeholder="输入预设名称..."
               class="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 mb-4" />
        <div class="flex gap-2">
          <button @click="showSaveModal = false"
                  class="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium">
            取消
          </button>
          <button @click="doSavePreset"
                  :disabled="!presetName.trim()"
                  class="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded text-sm font-medium">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMCStore, type Preset } from '../store/mc'

const store = useMCStore()
const showPresetModal = ref(false)
const showSaveModal = ref(false)
const presetName = ref('')

const applicablePresets = computed(() => 
  store.presets.filter(p => p.scenarioId === store.currentScenario.id)
)

function isChanged(key: string | number): boolean {
  return store.paramChanges.some(c => c.key === key)
}

function isMetricHighlighted(metric: string): boolean {
  return store.affectedMetrics.includes(metric)
}

function onSliderInput(key: string, value: string) {
  store.updateParam(key, parseFloat(value))
}

function onNumberInput(key: string, value: string) {
  const num = parseFloat(value)
  if (!isNaN(num)) store.updateParam(key, num)
}

function formatValue(v: number): string {
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 1) return v.toFixed(2)
  return v.toFixed(4)
}

function formatDiff(oldV: number, newV: number): string {
  const diff = newV - oldV
  const pct = ((diff / Math.abs(oldV)) * 100).toFixed(1)
  const sign = diff > 0 ? '+' : ''
  return `${sign}${pct}%`
}

function applyPreset(preset: Preset) {
  store.applyPreset(preset)
  showPresetModal.value = false
}

function openSavePreset() {
  presetName.value = ''
  showSaveModal.value = true
}

function doSavePreset() {
  if (presetName.value.trim()) {
    store.savePreset(presetName.value.trim())
    showSaveModal.value = false
  }
}
</script>
