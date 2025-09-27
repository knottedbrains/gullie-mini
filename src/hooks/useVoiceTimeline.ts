/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { services } from '../data/services'
import type {
  AssistantTaskHighlightDetail,
  AssistantUiMessageDetail,
  RelocationProfile,
  ServiceId,
  TaskStatus,
  TimelineTask,
} from '../types/timeline'

interface UseVoiceTimelineArgs {
  selectedServices: ServiceId[]
  setSelectedServices: (ids: ServiceId[]) => void
  tasks: TimelineTask[]
  replaceTasks: (tasks: TimelineTask[]) => void
  upsertTask: (task: TimelineTask) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  buildServiceTasks: (serviceId: ServiceId) => TimelineTask[]
  relocationProfile: RelocationProfile
  setRelocationProfile: (profile: RelocationProfile) => void
}

export type VoiceConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'function'
  | 'error'

export interface VoiceMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
  timestamp: number
}

interface PendingFunctionCall {
  name: string
  args: string
}

type ToolResult = Record<string, unknown> | string | number | boolean | null

const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const MODEL = 'gpt-4o-realtime-preview'

const SESSION_INSTRUCTIONS = `You are Gullie, a relocation voice specialist guiding a user who is moving from one city to another.
- Be concise, friendly, and speak in English.
- Always greet with: "Hi, I see that you have a move started from {from_city} to {to_city}."
- Begin every session by calling get_relocation() and list_selected_services().
- Check recent progress by calling list_tasks with status="in_progress" and limit=5, then ask for updates.
- Ask one discovery question at a time about immigration, housing, shipping, finance, and education.
- Whenever the user shares their origin or destination cities (or confirms their route), call set_relocation_profile({ from_city, to_city, move_date? }) so the UI updates immediately.
- Suggest enabling timeline services when the user hints at a need. Call navigate_view("timeline") followed by select_services with the canonical service IDs.
- When a service is selected, request add_service_tasks({ serviceId }) to populate the timeline right away.
- Before modifying services call navigate_view("timeline"). Before modifying tasks call navigate_view("dashboard").
- After every tool call, provide a spoken summary of what changed.
- When tasks are reported complete, call update_tasks or complete_tasks. Handle cascading updates when possible.
- When housing help is requested, call open_housing_search with a concise prompt.
- End each spoken response with a short next-step question.
- Remember what the user said earlier in the conversation and reference it naturally.
- Keep the conversation one prompt at a time; do not queue multiple questions.`

function dispatchUiMessage(message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<AssistantUiMessageDetail>('assistantUiMessage', {
      detail: { message, timestamp: Date.now() },
    }),
  )
}

function dispatchHighlight(detail: AssistantTaskHighlightDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('assistantTaskHighlight', { detail }))
}

function dispatchCategories(activeCategories: ServiceId[]) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('categoriesConfirmed', {
      detail: { activeCategories },
    }),
  )
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const serviceLookup = (() => {
  const map = new Map<string, ServiceId>()
  for (const service of services) {
    map.set(normalize(service.id), service.id)
    map.set(normalize(service.label), service.id)
    const synonyms = [
      `${service.label} service`,
      `${service.label} tasks`,
      service.label.replace(/ing$/, ''),
    ]
    for (const synonym of synonyms) {
      map.set(normalize(synonym), service.id)
    }
  }
  return map
})()

const SERVICE_SYNONYMS: Record<string, ServiceId> = {
  visa: 'immigration',
  visas: 'immigration',
  'work permit': 'immigration',
  permit: 'immigration',
  immigration: 'immigration',
  'immigration support': 'immigration',
  'visa support': 'immigration',
  housing: 'housing',
  'long term housing': 'housing',
  'long-term housing': 'housing',
  'apartment search': 'housing',
  apartment: 'housing',
  rent: 'housing',
  rental: 'housing',
  lease: 'housing',
  'temporary housing': 'settling',
  'temp housing': 'settling',
  'temporary accommodation': 'settling',
  'short term accommodation': 'settling',
  'short-term accommodation': 'settling',
  moving: 'moving',
  'move logistics': 'moving',
  movers: 'moving',
  shipping: 'moving',
  'ship furniture': 'moving',
  'moving company': 'moving',
  finance: 'finances',
  finances: 'finances',
  banking: 'finances',
  'bank account': 'finances',
  budget: 'finances',
  'open bank account': 'finances',
  settling: 'settling',
  lifestyle: 'settling',
  community: 'settling',
  schools: 'settling',
  school: 'settling',
  education: 'settling',
  children: 'settling',
  kids: 'settling',
  pets: 'settling',
  'pet relocation': 'settling',
}

function resolveServiceIds(candidates: string[]): ServiceId[] {
  const resolved = new Set<ServiceId>()
  for (const candidate of candidates) {
    const key = normalize(candidate)
    const synonym = SERVICE_SYNONYMS[key]
    if (synonym) {
      resolved.add(synonym)
      continue
    }
    const match = serviceLookup.get(key)
    if (match) {
      resolved.add(match)
    }
  }
  return Array.from(resolved)
}

interface ToolHandlerContext {
  tasksRef: MutableRefObject<TimelineTask[]>
  selectedServicesRef: MutableRefObject<ServiceId[]>
  setSelectedServices: (ids: ServiceId[]) => void
  replaceTasks: (tasks: TimelineTask[]) => void
  upsertTask: (task: TimelineTask) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  buildServiceTasks: (serviceId: ServiceId) => TimelineTask[]
  relocationProfileRef: MutableRefObject<RelocationProfile>
  setRelocationProfile: (profile: RelocationProfile) => void
}

function createToolHandlers(context: ToolHandlerContext) {
  const {
    tasksRef,
    selectedServicesRef,
    setSelectedServices,
    replaceTasks,
    upsertTask,
    updateTaskStatus,
    buildServiceTasks,
    relocationProfileRef,
    setRelocationProfile,
  } = context

  const ensureTasksRefUpdated = (tasksRef: MutableRefObject<TimelineTask[]>, created: TimelineTask[]) => {
    if (!created.length) return
    const known = new Set(tasksRef.current.map((task) => task.id))
    const appended = [...tasksRef.current]
    for (const task of created) {
      if (!known.has(task.id)) {
        appended.push(task)
      }
    }
    tasksRef.current = appended
  }

  return {
    navigate_view: async ({ view }: { view: string }) => {
      console.info('[voice] navigate_view', view)
      const destination = view === 'dashboard' ? 'dashboard' : 'timeline'
      dispatchUiMessage(`Switched to ${destination} view`)
      return { success: true, view: destination }
    },
    list_selected_services: async () => {
      console.info('[voice] list_selected_services')
      const services = selectedServicesRef.current
      return { services }
    },
    select_services: async ({ services: inputs = [] }: { services?: string[] }) => {
      console.info('[voice] select_services', inputs)
      const resolved = resolveServiceIds(inputs)
      if (!resolved.length) {
        return { success: false, message: 'No matching services found.' }
      }
      const merged = Array.from(new Set([...selectedServicesRef.current, ...resolved]))
      selectedServicesRef.current = merged
      setSelectedServices(merged)
      dispatchCategories(merged)
      const created: Record<string, number> = {}
      for (const serviceId of resolved) {
        const generated = buildServiceTasks(serviceId)
        ensureTasksRefUpdated(tasksRef, generated)
        if (generated.length) {
          dispatchHighlight({ ids: generated.map((task) => task.id), action: 'created' })
          dispatchUiMessage(`Built ${generated.length} tasks for ${serviceId}`)
        }
        created[serviceId] = generated.length
      }
      dispatchUiMessage(`Selected services: ${merged.join(', ')}`)
      return { success: true, services: merged, created }
    },
    add_service_tasks: async ({ serviceId }: { serviceId: string }) => {
      console.info('[voice] add_service_tasks', serviceId)
      const resolved = resolveServiceIds([serviceId])
      if (!resolved.length) {
        return { success: false, message: 'Unknown service.' }
      }
      const id = resolved[0]
      const generated = buildServiceTasks(id)
      ensureTasksRefUpdated(tasksRef, generated)
      if (generated.length) {
        dispatchHighlight({ ids: generated.map((task) => task.id), action: 'created' })
        dispatchUiMessage(`Added ${generated.length} tasks for ${id}`)
      }
      return { success: true, created: generated.length }
    },
    unselect_services: async ({ services: inputs = [] }: { services?: string[] }) => {
      console.info('[voice] unselect_services', inputs)
      const resolved = resolveServiceIds(inputs)
      if (!resolved.length) {
        return { success: false, message: 'No matching services to unselect.' }
      }
      const remaining = selectedServicesRef.current.filter((id) => !resolved.includes(id))
      const next = remaining.length ? remaining : selectedServicesRef.current
      selectedServicesRef.current = next
      setSelectedServices(next)
      dispatchCategories(next)
      dispatchUiMessage(`Active services: ${next.join(', ')}`)
      return { success: true, services: next }
    },
    list_tasks: async ({ service }: { service?: string }) => {
      const tasks = tasksRef.current
      const serviceId = service ? resolveServiceIds([service])[0] : undefined
      const filtered = serviceId ? tasks.filter((task) => task.serviceId === serviceId) : tasks
      return {
        count: filtered.length,
        tasks: filtered.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          serviceId: task.serviceId,
          timeframe: task.timeframe,
        })),
      }
    },
    complete_tasks: async ({ ids = [] }: { ids?: string[] }) => {
      console.info('[voice] complete_tasks', ids)
      const updated: string[] = []
      for (const id of ids) {
        if (tasksRef.current.some((task) => task.id === id)) {
          updateTaskStatus(id, 'completed')
          updated.push(id)
        }
      }
      if (updated.length) {
        dispatchHighlight({ ids: updated, action: 'completed' })
      }
      return { updated }
    },
    toggle_task: async ({ id }: { id: string }) => {
      console.info('[voice] toggle_task', id)
      const task = tasksRef.current.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: 'Task not found.' }
      }
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
      updateTaskStatus(id, nextStatus)
      dispatchHighlight({ ids: [id], action: 'touched' })
      return { success: true, status: nextStatus }
    },
    edit_task: async ({ id, updates = {} }: { id: string; updates?: Partial<TimelineTask> }) => {
      console.info('[voice] edit_task', id, updates)
      const task = tasksRef.current.find((item) => item.id === id)
      if (!task) return { success: false, message: 'Task not found.' }
      const merged = { ...task, ...updates, lastUpdatedAt: new Date().toISOString() }
      upsertTask(merged)
      dispatchHighlight({ ids: [id], action: 'updated' })
      return { success: true, task: merged }
    },
    update_tasks: async ({ updates = [] }: { updates?: Array<Partial<TimelineTask> & { id: string }> }) => {
      const nextMap = new Map(tasksRef.current.map((task) => [task.id, task] as const))
      const touched: string[] = []
      for (const update of updates) {
        const existing = nextMap.get(update.id)
        if (existing) {
          nextMap.set(update.id, {
            ...existing,
            ...update,
            lastUpdatedAt: new Date().toISOString(),
          })
          touched.push(update.id)
          continue
        }
        if (!update.serviceId) {
          continue
        }
        const fallback: TimelineTask = {
          id: update.id,
          serviceId: update.serviceId as ServiceId,
          title: update.title ?? 'New task',
          description: update.description ?? 'Added by voice assistant',
          timeframe: update.timeframe ?? 'TBD',
          status: update.status ?? 'pending',
          sequence:
            typeof update.sequence === 'number'
              ? update.sequence
              : tasksRef.current.length + touched.length + 1,
          lastUpdatedAt: new Date().toISOString(),
        }
        nextMap.set(update.id, fallback)
        touched.push(update.id)
      }
      const next = Array.from(nextMap.values())
      replaceTasks(next)
      if (touched.length) {
        dispatchHighlight({ ids: touched, action: 'updated' })
      }
      return { success: true, updated: touched.length }
    },
    open_housing_search: async () => {
      console.info('[voice] open_housing_search')
      dispatchUiMessage('Opening housing search results')
      return { success: true, url: '/housing-search' }
    },
    get_relocation: async () => {
      console.info('[voice] get_relocation')
      const profile = relocationProfileRef.current
      return {
        from_city: profile.fromCity ?? 'Unknown origin',
        to_city: profile.toCity ?? 'Unknown destination',
        move_date: profile.moveDate ?? 'TBD',
      }
    },
    set_relocation_profile: async ({ from_city, to_city, move_date }: { from_city?: string; to_city?: string; move_date?: string }) => {
      console.info('[voice] set_relocation_profile', { from_city, to_city, move_date })
      const next: RelocationProfile = {
        ...relocationProfileRef.current,
        fromCity: from_city ?? relocationProfileRef.current.fromCity,
        toCity: to_city ?? relocationProfileRef.current.toCity,
        moveDate: move_date ?? relocationProfileRef.current.moveDate,
        lastUpdatedAt: new Date().toISOString(),
      }
      relocationProfileRef.current = next
      setRelocationProfile(next)
      if (from_city || to_city || move_date) {
        const origin = next.fromCity ? next.fromCity : 'your origin city'
        const destination = next.toCity ? next.toCity : 'your destination'
        dispatchUiMessage(`Relocation route updated: ${origin} → ${destination}`)
      }
      return { success: true, profile: next }
    },
  }
}

export interface UseVoiceTimelineResult {
  phase: VoiceConnectionPhase
  isMuted: boolean
  isConnected: boolean
  error?: string
  messages: VoiceMessage[]
  start: () => Promise<void>
  stop: () => void
  toggleMute: () => void
}

export function useVoiceTimeline(args: UseVoiceTimelineArgs): UseVoiceTimelineResult {
  const {
    selectedServices,
    setSelectedServices,
    tasks,
    replaceTasks,
    upsertTask,
    updateTaskStatus,
    buildServiceTasks,
    relocationProfile,
    setRelocationProfile,
  } = args
  const [phase, setPhase] = useState<VoiceConnectionPhase>('idle')
  const [isMuted, setMuted] = useState(false)
  const [isConnected, setConnected] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [userMessage, setUserMessage] = useState<string | null>(null)

  const peerRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingCallsRef = useRef<Map<string, PendingFunctionCall>>(new Map())
  const assistantBufferRef = useRef<string>('')

  const tasksRef = useRef<TimelineTask[]>(tasks)
  const selectedRef = useRef<ServiceId[]>(selectedServices)
  const relocationProfileRef = useRef<RelocationProfile>(relocationProfile)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    selectedRef.current = selectedServices
  }, [selectedServices])

  useEffect(() => {
    relocationProfileRef.current = relocationProfile
  }, [relocationProfile])

  const toolHandlers = useMemo(
    () =>
      createToolHandlers({
        tasksRef,
        selectedServicesRef: selectedRef,
        setSelectedServices,
        replaceTasks,
        upsertTask,
        updateTaskStatus,
        buildServiceTasks,
        relocationProfileRef,
        setRelocationProfile,
      }),
    [buildServiceTasks, replaceTasks, setSelectedServices, setRelocationProfile, upsertTask, updateTaskStatus],
  )

  const cleanUp = useCallback(() => {
    dataChannelRef.current?.close()
    peerRef.current?.close()
    micStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
      remoteAudioRef.current.remove()
    }
    dataChannelRef.current = null
    peerRef.current = null
    micStreamRef.current = null
    remoteAudioRef.current = null
    pendingCallsRef.current.clear()
    assistantBufferRef.current = ''
    setUserMessage(null)
    setConnected(false)
  }, [])

  const stop = useCallback(() => {
    cleanUp()
    dispatchUiMessage('Voice session stopped')
    setPhase('idle')
  }, [cleanUp])

  const toggleMute = useCallback(() => {
    const stream = micStreamRef.current
    if (!stream) return
    const tracks = stream.getAudioTracks()
    const currentlyEnabled = tracks.every((track) => track.enabled)
    const nextEnabled = !currentlyEnabled
    for (const track of tracks) {
      track.enabled = nextEnabled
    }
    setMuted(!nextEnabled)
  }, [])

  const appendAssistantMessage = useCallback((content: string) => {
    if (!content.trim()) {
      return
    }
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
    setMessages((prev) => [
      ...prev,
      { id, role: 'assistant', content: content.trim(), timestamp: Date.now() },
    ])
  }, [])

  const inferRelocationFromText = useCallback(
    (text: string) => {
      const lower = text.toLowerCase()
      const current = relocationProfileRef.current
      let next: RelocationProfile | null = null

      const fullMatch = text.match(/from\s+([A-Za-z\s]+?)\s+(?:to|->|towards)\s+([A-Za-z\s]+)/i)
      if (fullMatch) {
        const fromCity = fullMatch[1].trim()
        const toCity = fullMatch[2].trim()
        if (fromCity && toCity) {
          next = {
            ...current,
            fromCity,
            toCity,
            lastUpdatedAt: new Date().toISOString(),
          }
        }
      }

      if (!next && lower.includes('moving to')) {
        const match = text.match(/moving to\s+([A-Za-z\s]+)/i)
        if (match) {
          const toCity = match[1].trim()
          if (toCity && !current.toCity) {
            next = {
              ...current,
              toCity,
              lastUpdatedAt: new Date().toISOString(),
            }
          }
        }
      }

      if (!next && lower.includes('moving from')) {
        const match = text.match(/moving from\s+([A-Za-z\s]+)/i)
        if (match) {
          const fromCity = match[1].trim()
          if (fromCity && !current.fromCity) {
            next = {
              ...current,
              fromCity,
              lastUpdatedAt: new Date().toISOString(),
            }
          }
        }
      }

      if (next) {
        relocationProfileRef.current = next
        setRelocationProfile(next)
        const origin = next.fromCity ?? 'your origin city'
        const destination = next.toCity ?? 'your destination'
        dispatchUiMessage(`Heard your route: ${origin} → ${destination}`)
      }
    },
    [setRelocationProfile],
  )

  const appendUserMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) {
        return
      }
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
      setMessages((prev) => [
        ...prev,
        { id, role: 'user', content: trimmed, timestamp: Date.now() },
      ])
      inferRelocationFromText(trimmed)
    },
    [inferRelocationFromText],
  )

  const handleFunctionExecution = useCallback(
    async (callId: string) => {
      const pending = pendingCallsRef.current.get(callId)
      if (!pending) return
      pendingCallsRef.current.delete(callId)

      try {
        const args = pending.args.trim() ? JSON.parse(pending.args) : {}
        console.info('[voice] executing tool', pending.name, args)
        const handler = (toolHandlers as Record<string, (payload: any) => Promise<ToolResult>>)[pending.name]
        if (!handler) {
          throw new Error(`Handler missing for tool ${pending.name}`)
        }
        const output = await handler(args)
        dataChannelRef.current?.send(
          JSON.stringify({
            type: 'response.function_call_output',
            call_id: callId,
            output: JSON.stringify(output),
          }),
        )
        dataChannelRef.current?.send(
          JSON.stringify({
            type: 'response.create',
            response: {
              instructions: 'Provide a concise spoken update and end with a next-step question.',
            },
          }),
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        dataChannelRef.current?.send(
          JSON.stringify({
            type: 'response.function_call_output',
            call_id: callId,
            output: JSON.stringify({ success: false, message }),
          }),
        )
      } finally {
        setPhase('listening')
      }
    },
    [toolHandlers],
  )

  const handleDataChannelMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data)
        switch (payload.type) {
          case 'response.created':
            setPhase('thinking')
            break
          case 'response.completed':
            setPhase('listening')
            if (assistantBufferRef.current) {
              appendAssistantMessage(assistantBufferRef.current)
              assistantBufferRef.current = ''
            }
            break
          case 'response.output_text.delta': {
            assistantBufferRef.current += payload.text ?? ''
            break
          }
          case 'response.output_text.done':
            if (assistantBufferRef.current) {
              appendAssistantMessage(assistantBufferRef.current)
              assistantBufferRef.current = ''
            }
            setPhase('listening')
            break
          case 'response.input_text.delta': {
            const chunk = payload.text ?? payload.delta ?? ''
            if (!chunk) break
            const next = (userMessage ?? '') + chunk
            setUserMessage(next)
            break
          }
          case 'response.input_text.done': {
            if (userMessage) {
              appendUserMessage(userMessage)
              setUserMessage(null)
            }
            break
          }
          case 'response.function_call':
            pendingCallsRef.current.set(payload.call_id, { name: payload.name, args: '' })
            setPhase('function')
            break
          case 'response.function_call_arguments.delta': {
            const call = pendingCallsRef.current.get(payload.call_id)
            if (call) {
              const chunk = payload.delta ?? payload.arguments ?? ''
              call.args += chunk
            }
            break
          }
          case 'response.function_call_arguments.done':
            void handleFunctionExecution(payload.call_id)
            break
          // Newer event names (dot-separated) — support both for compatibility
          case 'response.function_call.arguments.delta': {
            const call = pendingCallsRef.current.get(payload.call_id)
            if (call) {
              const chunk = payload.delta ?? payload.arguments ?? ''
              call.args += chunk
            }
            break
          }
          case 'response.function_call.arguments.done':
            void handleFunctionExecution(payload.call_id)
            break
          case 'response.refusal.delta':
            assistantBufferRef.current += payload.text ?? ''
            break
          default:
            break
        }
      } catch (error) {
        console.warn('Failed to parse data channel message', error, event.data)
      }
    },
    [appendAssistantMessage, handleFunctionExecution, userMessage],
  )

  const sendSessionUpdate = useCallback(() => {
    const channel = dataChannelRef.current
    if (!channel) return

    const instructions = SESSION_INSTRUCTIONS

    const tools = [
      {
        type: 'function',
        name: 'navigate_view',
        description: 'Switch between timeline and dashboard views',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            view: { type: 'string', enum: ['timeline', 'dashboard'] },
          },
          required: ['view'],
        },
      },
      {
        type: 'function',
        name: 'list_selected_services',
        description: 'List currently active services in the timeline',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
      },
      {
        type: 'function',
        name: 'select_services',
        description: 'Enable one or more services for the user timeline',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            services: { type: 'array', items: { type: 'string' } },
          },
          required: ['services'],
        },
      },
      {
        type: 'function',
        name: 'add_service_tasks',
        description: 'Generate tasks for a specific service',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            serviceId: { type: 'string' },
          },
          required: ['serviceId'],
        },
      },
      {
        type: 'function',
        name: 'unselect_services',
        description: 'Disable one or more services',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            services: { type: 'array', items: { type: 'string' } },
          },
          required: ['services'],
        },
      },
      {
        type: 'function',
        name: 'list_tasks',
        description: 'List tasks, optionally filtered by service',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            service: { type: 'string' },
          },
        },
      },
      {
        type: 'function',
        name: 'update_tasks',
        description: 'Update multiple tasks with partial fields',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  timeframe: { type: 'string' },
                  status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
                  serviceId: { type: 'string' },
                  sequence: { type: 'number' },
                },
                required: ['id'],
              },
            },
          },
        },
      },
      {
        type: 'function',
        name: 'complete_tasks',
        description: 'Mark one or more tasks complete',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ids: { type: 'array', items: { type: 'string' } },
          },
          required: ['ids'],
        },
      },
      {
        type: 'function',
        name: 'edit_task',
        description: 'Edit a single task with partial updates',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            updates: { type: 'object', additionalProperties: true },
          },
          required: ['id'],
        },
      },
      {
        type: 'function',
        name: 'toggle_task',
        description: 'Toggle a task between completed and pending',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
      {
        type: 'function',
        name: 'open_housing_search',
        description: 'Open a housing search view with suggested filters',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
      },
      {
        type: 'function',
        name: 'get_relocation',
        description: 'Read the current relocation profile (cities and move date)',
        parameters: { type: 'object', additionalProperties: false, properties: {} },
      },
      {
        type: 'function',
        name: 'set_relocation_profile',
        description: 'Update relocation cities and/or target move date',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from_city: { type: 'string' },
            to_city: { type: 'string' },
            move_date: { type: 'string' },
          },
        },
      },
    ]

    channel.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          instructions,
          modalities: ['audio', 'text'],
          tool_choice: 'auto',
          tools,
        },
      }),
    )
  }, [])

  const start = useCallback(async () => {
    if (phase !== 'idle') return
    setError(undefined)
    setPhase('connecting')
    try {
      console.log("Fetching ephemeral key...")
      const tokenResponse = await fetch('/api/ephemeral-key', { method: 'POST' })
      if (!tokenResponse.ok) {
        throw new Error('Unable to fetch ephemeral key.')
      }
      const { client_secret } = await tokenResponse.json()
      const ephemeralKey = client_secret?.value
      if (!ephemeralKey) throw new Error("No ephemeral key in response")
      console.log("Got ephemeral key:", ephemeralKey)

      const peer = new RTCPeerConnection({ iceServers: STUN_SERVERS })
      peerRef.current = peer

      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
      microphone.getTracks().forEach((track) => peer.addTrack(track, microphone))
      micStreamRef.current = microphone

      const audioElement = document.createElement('audio')
      audioElement.autoplay = true
      audioElement.setAttribute('playsinline', 'true')
      document.body.appendChild(audioElement)
      remoteAudioRef.current = audioElement

      peer.ontrack = (event) => {
        const [stream] = event.streams
        if (stream && audioElement.srcObject !== stream) {
          audioElement.srcObject = stream
        }
      }

      const dataChannel = peer.createDataChannel('oai-events')
      dataChannelRef.current = dataChannel
      dataChannel.onmessage = handleDataChannelMessage
      dataChannel.onopen = () => {
        setConnected(true)
        setPhase('listening')
        sendSessionUpdate()
        dispatchUiMessage('Voice session connected')
      }
      dataChannel.onclose = () => {
        dispatchUiMessage('Voice session ended')
        cleanUp()
        setPhase('idle')
      }

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)

      const response = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`, // ✅ fixed
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })

      if (!response.ok) {
        throw new Error('Failed to negotiate WebRTC session with OpenAI.')
      }

      const answer = {
        type: 'answer' as const,
        sdp: await response.text(),
      }
      await peer.setRemoteDescription(answer)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error starting voice session.'
      console.error("Voice session error:", message)
      setError(message)
      setPhase('error')
      cleanUp()
    }
  }, [cleanUp, handleDataChannelMessage, phase, sendSessionUpdate, stop])

  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    phase,
    isMuted,
    isConnected,
    error,
    messages,
    start,
    stop,
    toggleMute,
  }
}
