import { create } from 'zustand'

const useDownloadStore = create((set, get) => ({
  tasks: [],
  ws: null,

  connectWS: () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'task:updated') {
        set(state => ({
          tasks: state.tasks.map(t => t.id === data.payload.id ? { ...t, ...data.payload } : t)
        }))
      }
      if (data.type === 'task:added') {
        set(state => ({ tasks: [...state.tasks, data.payload] }))
      }
      if (data.type === 'task:removed') {
        set(state => ({ tasks: state.tasks.filter(t => t.id !== data.payload.id) }))
      }
      if (data.type === 'queue:sync') {
        set({ tasks: data.payload })
      }
    }
    ws.onclose = () => {
      setTimeout(() => get().connectWS(), 3000)
    }
    set({ ws })
  },

  disconnectWS: () => {
    const { ws } = get()
    if (ws) ws.close()
    set({ ws: null })
  }
}))

export default useDownloadStore
