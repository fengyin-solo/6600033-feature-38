import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'

export interface ParamMeta {
  name: string
  description: string
  min: number
  max: number
  step: number
  unit?: string
  affectedMetrics: string[]
}

export interface MCScenario {
  id: string
  name: string
  description: string
  params: Record<string, number>
  paramMeta: Record<string, ParamMeta>
  category: string
}

export interface MCResult {
  scenario: string
  iterations: number
  estimate: number
  trueValue?: number
  error?: number
  samples: number[]
  convergence: number[]
}

export interface HypTestResult {
  testType: string
  statistic: number
  pValue: number
  significant: boolean
  alpha: number
  df?: number
}

export interface ParamChange {
  key: string
  oldValue: number
  newValue: number
  affectedMetrics: string[]
}

export interface Preset {
  id: string
  name: string
  scenarioId: string
  params: Record<string, number>
  iterations: number
}

function normalRandom(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function runMC(scenario: MCScenario, n: number): MCResult {
  const samples: number[] = []
  const convergence: number[] = []

  if (scenario.id === 'pi') {
    let inside = 0
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1
      if (x * x + y * y <= 1) inside++
      samples.push(x * x + y * y <= 1 ? 1 : 0)
      convergence.push((inside / (i + 1)) * 4)
    }
    const estimate = (inside / n) * 4
    return { scenario: 'pi', iterations: n, estimate, trueValue: Math.PI, error: Math.abs(estimate - Math.PI), samples, convergence }
  }
  if (scenario.id === 'brownian') {
    let pos = 0
    const dt = scenario.params.dt || 0.01
    for (let i = 0; i < n; i++) { pos += normalRandom() * Math.sqrt(dt); samples.push(pos) }
    convergence.push(...samples.slice(0, 200))
    return { scenario: 'brownian', iterations: n, estimate: pos, samples, convergence }
  }
  if (scenario.id === 'option') {
    const { S0 = 100, K = 105, r = 0.05, sigma = 0.2, T = 1 } = scenario.params
    let payoffSum = 0
    for (let i = 0; i < n; i++) {
      const ST = S0 * Math.exp((r - 0.5 * sigma * sigma) * T + sigma * Math.sqrt(T) * normalRandom())
      const p = Math.max(ST - K, 0); payoffSum += p; samples.push(p)
      if ((i + 1) % 50 === 0) convergence.push((payoffSum / (i + 1)) * Math.exp(-r * T))
    }
    return { scenario: 'option', iterations: n, estimate: (payoffSum / n) * Math.exp(-r * T), samples, convergence }
  }
  if (scenario.id === 'random_walk') {
    let pos = 0
    for (let i = 0; i < n; i++) { pos += Math.random() > 0.5 ? 1 : -1; samples.push(pos) }
    convergence.push(...samples.slice(0, 200))
    return { scenario: 'random_walk', iterations: n, estimate: pos, samples, convergence }
  }
  if (scenario.id === 'diffusion') {
    const { D = 1, dt = 0.01 } = scenario.params
    let x = 0, y = 0
    for (let i = 0; i < n; i++) {
      x += normalRandom() * Math.sqrt(2 * D * dt); y += normalRandom() * Math.sqrt(2 * D * dt)
      samples.push(Math.sqrt(x * x + y * y))
    }
    convergence.push(...samples.slice(0, 200))
    return { scenario: 'diffusion', iterations: n, estimate: Math.sqrt(x * x + y * y), samples, convergence }
  }
  // gambler
  const { p = 0.45, bankroll = 50, goal = 100 } = scenario.params
  let ruinCount = 0
  for (let i = 0; i < n; i++) {
    let money = bankroll
    let steps = 0
    while (money > 0 && money < goal && steps < 10000) { money += Math.random() < p ? 1 : -1; steps++ }
    if (money <= 0) ruinCount++
    samples.push(money <= 0 ? 0 : 1)
    convergence.push(ruinCount / (i + 1))
  }
  return { scenario: 'gambler', iterations: n, estimate: ruinCount / n, samples, convergence }
}

export const SCENARIOS: MCScenario[] = [
  { 
    id: 'pi', 
    name: '圆周率π估算', 
    description: '随机投点估算π值，观察收敛过程', 
    params: {}, 
    paramMeta: {},
    category: '基础' 
  },
  { 
    id: 'brownian', 
    name: '布朗运动模拟', 
    description: '粒子热运动随机路径模拟', 
    params: { dt: 0.01 }, 
    paramMeta: {
      dt: { 
        name: '时间步长', 
        description: '每步的时间间隔，越小路径越精细', 
        min: 0.001, 
        max: 0.1, 
        step: 0.001,
        unit: 's',
        affectedMetrics: ['估算值', '收敛过程', '样本分布']
      }
    },
    category: '物理' 
  },
  { 
    id: 'option', 
    name: '欧式期权定价', 
    description: 'Black-Scholes期权价格蒙特卡洛估算', 
    params: { S0: 100, K: 105, r: 0.05, sigma: 0.2, T: 1 }, 
    paramMeta: {
      S0: { 
        name: '标的资产现价', 
        description: '期权标的资产当前价格', 
        min: 10, 
        max: 500, 
        step: 1,
        unit: '元',
        affectedMetrics: ['估算值', '误差', '样本分布']
      },
      K: { 
        name: '行权价格', 
        description: '期权合约约定的行权价格', 
        min: 10, 
        max: 500, 
        step: 1,
        unit: '元',
        affectedMetrics: ['估算值', '误差', '样本分布']
      },
      r: { 
        name: '无风险利率', 
        description: '年化无风险利率', 
        min: 0, 
        max: 0.3, 
        step: 0.005,
        unit: '%',
        affectedMetrics: ['估算值', '误差']
      },
      sigma: { 
        name: '波动率', 
        description: '标的资产年化波动率', 
        min: 0.01, 
        max: 1, 
        step: 0.01,
        unit: '%',
        affectedMetrics: ['估算值', '误差', '样本分布', '收敛过程']
      },
      T: { 
        name: '到期时间', 
        description: '期权距离到期的时间', 
        min: 0.1, 
        max: 5, 
        step: 0.1,
        unit: '年',
        affectedMetrics: ['估算值', '误差', '样本分布']
      }
    },
    category: '金融' 
  },
  { 
    id: 'random_walk', 
    name: '随机游走', 
    description: '一维离散随机游走轨迹模拟', 
    params: {}, 
    paramMeta: {},
    category: '基础' 
  },
  { 
    id: 'diffusion', 
    name: '粒子扩散', 
    description: '二维粒子随机扩散位移分析', 
    params: { D: 1, dt: 0.01 }, 
    paramMeta: {
      D: { 
        name: '扩散系数', 
        description: '粒子扩散能力的度量', 
        min: 0.1, 
        max: 10, 
        step: 0.1,
        unit: 'm²/s',
        affectedMetrics: ['估算值', '样本分布', '收敛过程']
      },
      dt: { 
        name: '时间步长', 
        description: '每步的时间间隔', 
        min: 0.001, 
        max: 0.1, 
        step: 0.001,
        unit: 's',
        affectedMetrics: ['估算值', '样本分布']
      }
    },
    category: '物理' 
  },
  { 
    id: 'gambler', 
    name: '赌徒破产', 
    description: '不利赌局下资金耗尽概率估算', 
    params: { p: 0.45, bankroll: 50, goal: 100 }, 
    paramMeta: {
      p: { 
        name: '每局胜率', 
        description: '单局游戏获胜的概率', 
        min: 0.01, 
        max: 0.99, 
        step: 0.01,
        unit: '%',
        affectedMetrics: ['估算值', '误差', '收敛过程', '样本分布']
      },
      bankroll: { 
        name: '初始资金', 
        description: '赌徒开始时拥有的资金', 
        min: 10, 
        max: 500, 
        step: 1,
        unit: '元',
        affectedMetrics: ['估算值', '误差', '样本分布']
      },
      goal: { 
        name: '目标资金', 
        description: '赌徒希望达到的资金目标', 
        min: 20, 
        max: 1000, 
        step: 1,
        unit: '元',
        affectedMetrics: ['估算值', '误差', '样本分布']
      }
    },
    category: '概率' 
  }
]

export const useMCStore = defineStore('mc', () => {
  const currentScenario = ref<MCScenario>(SCENARIOS[0])
  const iterations = ref(1000)
  const result = ref<MCResult | null>(null)
  const testResult = ref<HypTestResult | null>(null)
  const isRunning = ref(false)
  const editingParams = reactive<Record<string, number>>({})
  const paramChanges = ref<ParamChange[]>([])
  const presets = ref<Preset[]>([
    { id: 'opt-conservative', name: '保守定价', scenarioId: 'option', params: { S0: 100, K: 110, r: 0.03, sigma: 0.15, T: 1 }, iterations: 2000 },
    { id: 'opt-aggressive', name: '激进定价', scenarioId: 'option', params: { S0: 100, K: 95, r: 0.07, sigma: 0.35, T: 0.5 }, iterations: 2000 },
    { id: 'gambler-risky', name: '高风险局', scenarioId: 'gambler', params: { p: 0.4, bankroll: 30, goal: 150 }, iterations: 2000 },
    { id: 'gambler-safe', name: '低风险局', scenarioId: 'gambler', params: { p: 0.55, bankroll: 80, goal: 120 }, iterations: 2000 }
  ])

  function initEditingParams() {
    Object.keys(editingParams).forEach(k => delete editingParams[k])
    Object.assign(editingParams, currentScenario.value.params)
    paramChanges.value = []
  }

  function updateParam(key: string, value: number) {
    const meta = currentScenario.value.paramMeta[key]
    if (!meta) return
    const clamped = Math.max(meta.min, Math.min(meta.max, value))
    const oldValue = editingParams[key]
    editingParams[key] = clamped
    const existingIdx = paramChanges.value.findIndex(c => c.key === key)
    if (existingIdx >= 0) {
      if (clamped === currentScenario.value.params[key]) {
        paramChanges.value.splice(existingIdx, 1)
      } else {
        paramChanges.value[existingIdx].newValue = clamped
      }
    } else if (clamped !== currentScenario.value.params[key]) {
      paramChanges.value.push({
        key,
        oldValue: currentScenario.value.params[key],
        newValue: clamped,
        affectedMetrics: meta.affectedMetrics
      })
    }
  }

  const affectedMetrics = computed(() => {
    const metrics = new Set<string>()
    paramChanges.value.forEach(c => c.affectedMetrics.forEach(m => metrics.add(m)))
    if (paramChanges.value.length > 0) metrics.add('迭代次数')
    return Array.from(metrics)
  })

  const hasChanges = computed(() => paramChanges.value.length > 0)

  function applyBatchChanges() {
    Object.assign(currentScenario.value.params, editingParams)
    paramChanges.value = []
  }

  function resetParam(key: string) {
    const defaultValue = currentScenario.value.params[key]
    editingParams[key] = defaultValue
    const idx = paramChanges.value.findIndex(c => c.key === key)
    if (idx >= 0) paramChanges.value.splice(idx, 1)
  }

  function resetAllParams() {
    initEditingParams()
  }

  function applyPreset(preset: Preset) {
    const scenario = SCENARIOS.find(s => s.id === preset.scenarioId)
    if (scenario) {
      currentScenario.value = scenario
      iterations.value = preset.iterations
      Object.assign(currentScenario.value.params, preset.params)
      initEditingParams()
    }
  }

  function savePreset(name: string) {
    const preset: Preset = {
      id: `custom-${Date.now()}`,
      name,
      scenarioId: currentScenario.value.id,
      params: { ...editingParams },
      iterations: iterations.value
    }
    presets.value.push(preset)
    return preset
  }

  function deletePreset(id: string) {
    const idx = presets.value.findIndex(p => p.id === id)
    if (idx >= 0) presets.value.splice(idx, 1)
  }

  function runSimulation() {
    applyBatchChanges()
    isRunning.value = true
    setTimeout(() => { result.value = runMC(currentScenario.value, iterations.value); isRunning.value = false }, 10)
  }

  function runTest(g1: number[], g2: number[]) {
    const n1 = g1.length, n2 = g2.length
    const m1 = g1.reduce((a, b) => a + b, 0) / n1
    const m2 = g2.reduce((a, b) => a + b, 0) / n2
    const v1 = g1.reduce((s, x) => s + (x - m1) ** 2, 0) / (n1 - 1)
    const v2 = g2.reduce((s, x) => s + (x - m2) ** 2, 0) / (n2 - 1)
    const se = Math.sqrt(v1 / n1 + v2 / n2)
    const t = (m1 - m2) / se
    const df = Math.round((v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)))
    const pValue = 2 * (1 - Math.min(0.9999, Math.abs(t) / (Math.abs(t) + Math.sqrt(df))))
    testResult.value = { testType: 'Welch T检验', statistic: Math.round(t * 1000) / 1000, pValue: Math.round(pValue * 10000) / 10000, significant: pValue < 0.05, alpha: 0.05, df }
  }

  function setScenario(s: MCScenario) { 
    currentScenario.value = s; 
    result.value = null
    initEditingParams()
  }

  const convergenceData = computed(() => {
    if (!result.value) return [] as [number, number][]
    return result.value.convergence.slice(0, 200).map((v, i): [number, number] => [i, Math.round(v * 100000) / 100000])
  })

  const histogramData = computed(() => {
    if (!result.value) return { xAxis: [] as number[], data: [] as number[] }
    const s = result.value.samples.slice(0, 1000)
    const mn = Math.min(...s), mx = Math.max(...s)
    const bins = 20, bs = (mx - mn) / bins || 1
    const counts = new Array(bins).fill(0)
    s.forEach(v => { counts[Math.min(bins - 1, Math.floor((v - mn) / bs))]++ })
    return { xAxis: Array.from({ length: bins }, (_, i) => Math.round((mn + i * bs) * 100) / 100), data: counts }
  })

  initEditingParams()

  return { 
    currentScenario, 
    iterations, 
    result, 
    testResult, 
    isRunning, 
    editingParams,
    paramChanges,
    presets,
    affectedMetrics,
    hasChanges,
    convergenceData, 
    histogramData, 
    runSimulation, 
    runTest, 
    setScenario,
    updateParam,
    resetParam,
    resetAllParams,
    applyPreset,
    savePreset,
    deletePreset
  }
})
