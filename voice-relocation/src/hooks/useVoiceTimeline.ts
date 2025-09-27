/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { services } from '../data/services'
import type {
  AssistantTaskHighlightDetail,
  AssistantUiMessageDetail,
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

function resolveServiceIds(candidates: string[]): ServiceId[] {
  const resolved = new Set<ServiceId>()
  for (const candidate of candidates) {
    const match = serviceLookup.get(normalize(candidate))
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
}

function createToolHandlers(context: ToolHandlerContext) {
  const { tasksRef, selectedServicesRef, setSelectedServices, replaceTasks, upsertTask, updateTaskStatus } = context

  return {
    navigate_view: async ({ view }: { view: string }) => {
      const destination = view === 'dashboard' ? 'dashboard' : 'timeline'
      dispatchUiMessage(`Switched to ${destination} view`)
      return { success: true, view: destination }
    },
    list_selected_services: async () => {
      const services = selectedServicesRef.current
      return { services }
    },
    select_services: async ({ services: inputs = [] }: { services?: string[] }) => {
      const resolved = resolveServiceIds(inputs)
      if (!resolved.length) {
        return { success: false, message: 'No matching services found.' }
      }
      const merged = Array.from(new Set([...selectedServicesRef.current, ...resolved]))
      setSelectedServices(merged)
      dispatchCategories(merged)
      dispatchUiMessage(`Selected services: ${merged.join(', ')}`)
      return { success: true, services: merged }
    },
    unselect_services: async ({ services: inputs = [] }: { services?: string[] }) => {
      const resolved = resolveServiceIds(inputs)
      if (!resolved.length) {
        return { success: false, message: 'No matching services to unselect.' }
      }
      const remaining = selectedServicesRef.current.filter((id) => !resolved.includes(id))
      const next = remaining.length ? remaining : selectedServicesRef.current
      setSelectedServices(next)
      dispatchCategories(next)
      dispatchUiMessage(`Active services: ${next.join(', ')}`)
      return { success: true, services: next }
    },
    list_tasks: async ({ service }: { service?: string }) => {
      const tasks = tasksRef.current
      const filtered = service ? tasks.filter((task) => task.serviceId === resolveServiceIds([service])[0]) : tasks
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
      dispatchUiMessage('Opening housing search results')
      return { success: true, url: '/housing-search' }
    },
    get_relocation: async () => ({ from_city: 'San Francisco', to_city: 'Berlin', move_date: '2025-10-01' }),
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
  const { selectedServices, setSelectedServices, tasks, replaceTasks, upsertTask, updateTaskStatus } = args
  const [phase, setPhase] = useState<VoiceConnectionPhase>('idle')
  const [isMuted, setMuted] = useState(false)
  const [isConnected, setConnected] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [messages, setMessages] = useState<VoiceMessage[]>([])

  const peerRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null)
  const pendingCallsRef = useRef<Map<string, PendingFunctionCall>>(new Map())
  const assistantBufferRef = useRef<string>('')

  const tasksRef = useRef<TimelineTask[]>(tasks)
  const selectedRef = useRef<ServiceId[]>(selectedServices)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    selectedRef.current = selectedServices
  }, [selectedServices])

  const toolHandlers = useMemo(
    () =>
      createToolHandlers({
        tasksRef,
        selectedServicesRef: selectedRef,
        setSelectedServices,
        replaceTasks,
        upsertTask,
        updateTaskStatus,
      }),
    [replaceTasks, setSelectedServices, upsertTask, updateTaskStatus],
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
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
    setMessages((prev) => [
      ...prev,
      { id, role: 'assistant', content, timestamp: Date.now() },
    ])
  }, [])

  const handleFunctionExecution = useCallback(
    async (callId: string) => {
      const pending = pendingCallsRef.current.get(callId)
      if (!pending) return
      pendingCallsRef.current.delete(callId)

      try {
        const args = pending.args.trim() ? JSON.parse(pending.args) : {}
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
    [appendAssistantMessage, handleFunctionExecution],
  )

  const sendSessionUpdate = useCallback(() => {
    const channel = dataChannelRef.current
    if (!channel) return
    const instructions = `You are Gullie, a relocation voice specialist. Stay concise and default to English.\n` +
      `Before changing services, call navigate_view("timeline"). Before changing tasks, call navigate_view("dashboard").\n` +
      `End every spoken response with a short next-step question.`

    const tools = [
      'navigate_view',
      'list_selected_services',
      'select_services',
      'unselect_services',
      'list_tasks',
      'update_tasks',
      'complete_tasks',
      'edit_task',
      'toggle_task',
      'open_housing_search',
      'get_relocation',
    ].map((name) => ({
      type: 'function',
      name,
      description: `Tool handler for ${name.replace(/_/g, ' ')}`,
      parameters: { type: 'object' },
    }))

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
      const tokenResponse = await fetch('/api/ephemeral-key', { method: 'POST' })
      if (!tokenResponse.ok) {
        throw new Error('Unable to fetch ephemeral key.')
      }
      const { client_secret } = await tokenResponse.json()
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
          Authorization: `Bearer ${client_secret}`,
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
      setError(message)
      setPhase('error')
      cleanUp()
    }
  }, [cleanUp, handleDataChannelMessage, phase, sendSessionUpdate, stop])

  useEffect(() => stop, [stop])

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
