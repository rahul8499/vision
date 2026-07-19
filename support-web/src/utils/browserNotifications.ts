let audioContext: AudioContext | null = null

const getAudioContext = () => {
  if (typeof window === 'undefined') return null
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return null
  audioContext ||= new AudioContextClass()
  return audioContext
}

export const enableSupportBrowserNotifications = async () => {
  const context = getAudioContext()
  if (context?.state === 'suspended') await context.resume().catch(() => undefined)
  if (!('Notification' in window) || Notification.permission !== 'default') {
    return 'Notification' in window ? Notification.permission : 'unsupported'
  }
  return Notification.requestPermission()
}

const playNotificationSound = () => {
  const context = getAudioContext()
  if (!context || context.state !== 'running') return
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, context.currentTime)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.2)
}

export const showSupportBrowserNotification = (
  title: string,
  message: string,
  onClick?: () => void,
) => {
  playNotificationSound()
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return
  const notification = new Notification(title, { body: message, tag: `support-${Date.now()}` })
  notification.onclick = () => {
    window.focus()
    onClick?.()
    notification.close()
  }
}
