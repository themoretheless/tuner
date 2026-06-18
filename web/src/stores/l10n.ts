import { ref } from 'vue'

function initialLang(): 'ru' | 'en' {
  try { return localStorage.getItem('lang') === 'en' ? 'en' : 'ru' } catch { return 'ru' }
}

const lang = ref<'ru' | 'en'>(initialLang())

const ru: Record<string, string> = {
  'app.title': 'Гитарный Тюнер',
  listening: 'СЛУШАЕТ',
  ready: 'ГОТОВ',
  'input.level': 'УРОВЕНЬ ВХОДА',
  detected: 'ОБНАРУЖЕНО',
  target: 'ЦЕЛЬ',
  'in.tune': 'В СТРОЮ',
  'adjust.flat': 'ПЛОСКО — ослабь',
  'adjust.sharp': 'ОСТРО — натяни',
  'standard.tuning': 'Стандартный строй',
  'auto.mode': 'АВТО РЕЖИМ',
  'reset.to.auto': 'СБРОС В АВТО',
  'play.reference': 'ВОСПРОИЗВЕСТИ РЕФЕРЕНС',
  'start.mic': 'ВКЛЮЧИТЬ МИКРОФОН',
  'stop.mic': 'ВЫКЛЮЧИТЬ МИКРОФОН',
  'random.note': 'СЛУЧАЙНАЯ НОТА (тренировка слуха)',
  'a4.label': 'A4',
  'waveform': 'Волна',
  'quiet.room': 'Тихая комната. Играй по одной струне. Используй ручной выбор для точности.',
  'keyboard.hint': 'Space/M микрофон, 1-6 струны, R референс',
  'footer': 'Гитарный Тюнер — Vue + Tauri/Rust',
  'subtitle': 'работает оффлайн • браузер + десктоп',
}

const en: Record<string, string> = {
  'app.title': 'Guitar Tuner',
  listening: 'LISTENING',
  ready: 'READY',
  'input.level': 'INPUT LEVEL',
  detected: 'DETECTED',
  target: 'TARGET',
  'in.tune': 'IN TUNE',
  'adjust.flat': 'FLAT — loosen',
  'adjust.sharp': 'SHARP — tighten',
  'standard.tuning': 'Standard Tuning',
  'auto.mode': 'AUTO MODE',
  'reset.to.auto': 'RESET TO AUTO',
  'play.reference': 'PLAY REFERENCE',
  'start.mic': 'START MICROPHONE',
  'stop.mic': 'STOP MICROPHONE',
  'random.note': 'RANDOM NOTE (ear training)',
  'a4.label': 'A4',
  'waveform': 'Waveform',
  'quiet.room': 'Works best in a quiet room. Pluck one string at a time. Use manual selection for best accuracy.',
  'keyboard.hint': 'Space/M mic, 1-6 strings, R reference',
  'footer': 'Guitar Tuner — Vue frontend • Tauri/Rust desktop',
  'subtitle': 'works offline • browser + desktop',
}

export function useL10n() {
  const t = (key: string) => {
    if (lang.value === 'en' && en[key]) return en[key]
    return ru[key] ?? key
  }
  const toggleLang = () => {
    lang.value = lang.value === 'ru' ? 'en' : 'ru'
    try { localStorage.setItem('lang', lang.value) } catch { /* ignore */ }
  }
  return { lang, t, toggleLang }
}
