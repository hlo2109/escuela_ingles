<template>
  <div>
    <h2 class="text-2xl font-bold text-center text-blue-600 mb-8">Vocabulario</h2>
    <div v-if="grouped.length" class="mb-8">
      <div v-for="group in grouped" :key="group.letter" class="mb-6">
        <h3 class="text-xl font-semibold text-blue-500 mb-2">{{ group.letter.toUpperCase() }}</h3>
        <div class="flex flex-wrap gap-3">
          <div v-for="card in group.cards" :key="card.english" class="flashcard bg-white rounded-lg shadow p-4 border border-gray-100 hover:shadow-md transition cursor-pointer" @click="openModal(card)">
            <span class="font-bold text-lg">{{ card.english }}</span>
          </div>
          
        </div>
      </div>
    </div>
    <div v-else class="text-center py-10">Cargando tarjetas...</div>

    <!-- Modal -->
    <div v-if="modal.visible" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative overflow-y-auto" style="max-height: 90vh;">
        <button class="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl" @click="closeModal">&times;</button>
        <h2 class="text-2xl font-bold mb-2 flex items-center">
          <span @click="playWord(modal.card.english)" class="cursor-pointer hover:text-blue-600">{{ modal.card.english }}</span>
          <span class="ml-3 text-gray-500 text-lg">/{{ modal.card.english_pronunciation }}/</span>
          <button class="ml-2 px-2 py-1 bg-blue-500 text-white rounded" @click="playWord(modal.card.english)"><i class="fas fa-volume-up"></i></button>&nbsp;&nbsp;&nbsp;
          <select v-model="speechRate" class="p-2 border border-gray-300 rounded-lg text-sm float-end">
              <option value="0.3">Lento</option>
              <option value="1">Normal</option>
              <option value="1.3">Rápido</option>
            </select>
        </h2>
        <h3 class="text-lg mb-2 text-blue-600">{{ modal.card.spanish }}</h3>
        <div>
        {{ modal.card.definition }}
        </div>

        <h4 class="font-semibold mb-2">Examples:</h4>
        <div class="mb-4">
          <span v-if="!speechSupported" class="text-red-500">Reconocimiento de voz no soportado</span>
        </div>
        <div v-for="tense in ['present','past','future']" :key="tense" class="mb-2">
          <h5><b>{{ (tense) }}</b></h5>
          <div class="flex items-center gap-2">
            <!-- Texto objetivo -->
            <span>
              <template v-for="(word, idx) in (modal.card.examples[tense] || '').split(/\s+/)" :key="idx">
                <span :class="getExampleWordClass(tense, idx)" @click="onWordClick(word)" class="cursor-pointer" >{{ word }}</span><span>&nbsp;</span>
              </template>
            </span>
            <!-- Pronunciación -->
            <!-- <span class="text-gray-500 italic">
              <template v-for="(word, idx2) in (modal.card.examples[`${tense}_pronunciation_es_lat`] || '').split(/\s+/)" :key="`p-${tense}-${idx2}`">
                <span >{{ word }}</span><span>&nbsp;</span>
              </template>
            </span> -->
            <!-- Controles -->
            <button class="ml-auto px-3 py-1 bg-blue-500 text-white rounded" @click="startPracticeExample(tense)" v-if="!isListening">Practicar</button>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button class="px-3 py-1 bg-gray-200 rounded" @click="stopPracticeExample" v-if="isListening" >Detener</button>
          <span v-if="isListening" class="text-sm text-gray-600">Escuchando...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Flashcards',
  data() {
    return {
      cards: [],
      grouped: [],
      modal: { visible: false, card: null },
      synth: null,
      recognition: null,
      speechSupported: true,
      isListening: false,
      isPracticing: false,
      practicingKey: null, // 'present' | 'past' | 'future'
      exampleStates: {}, // { present: 'correct' | 'incorrect' }
      exampleProgress: {}, // { present: number }
      speechRate: 1
    }
  },
  mounted() {
    // Cargar datos (asume carga previa de this.cards)
    fetch('/flashcards_vue.json')
      .then(res => res.json())
      .then(data => {
        this.cards = data;
        this.grouped = this.groupByLetter(this.cards);
      });

    // TTS
    if ('speechSynthesis' in window) {
      this.synth = window.speechSynthesis
    }
    // ASR
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SR) throw new Error('no-sr')
      this.recognition = new SR()
      this.recognition.continuous = true
      this.recognition.maxAlternatives = 5
      this.recognition.interimResults = true
      this.recognition.lang = 'en-US'
      this.recognition.onresult = this.handleRecognitionResult
      this.recognition.onerror = this.handleRecognitionError
      this.recognition.onend = this.handleRecognitionEnd
    } catch (e) {
      this.speechSupported = false
    }
  },
  methods: {
    groupByLetter(cards) {
      const groups = {}
      cards.forEach(card => {
        const letter = card.english[0].toLowerCase()
        if (!groups[letter]) groups[letter] = []
        groups[letter].push(card)
      })
      return Object.keys(groups).sort().map(letter => ({ letter, cards: groups[letter] }))
    },
    openModal(card) {
      this.modal.visible = true
      this.modal.card = card
    },
    closeModal() {
      this.modal.visible = false
      this.modal.card = null
      this.stopPracticeExample()
    },
    playWord(word) {
      if (!this.synth) return
      const utter = new window.SpeechSynthesisUtterance(word)
      utter.lang = 'en-US'
      utter.rate = this.speechRate
      this.synth.speak(utter)
    },
    onWordClick(word) {
      const utter = new window.SpeechSynthesisUtterance(word);
      utter.lang = 'en-US'
      utter.rate = this.speechRate
      this.synth.speak(utter);
    },
    // --- Helpers de normalización y coincidencia tolerante ---
    norm(w) {
      if (!w) return ''
      return w
        .toLowerCase()
        .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quita tildes
        .replace(/’/g, "'")
        .replace(/(^[^\w']+|[^\w']+$)/g, '') // puntuación en bordes
    },
    normalizeContractions(s) {
      return (s || '')
        .replace(/\bi'm\b/gi, 'im')
        .replace(/\bcan't\b/gi, 'cant')
        .replace(/\bdon't\b/gi, 'dont')
        .replace(/\bwon't\b/gi, 'wont')
        .replace(/\bit's\b/gi, 'its')
    },
    tokenize(s) {
      return this.normalizeContractions(s)
        .toLowerCase()
        .replace(/[“”"().,!?;:]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
    },
    closeEnough(a, b) { // <=1 edición permitida
      if (a === b) return true
      if (!a || !b) return false
      if (Math.abs(a.length - b.length) > 1) return false
      let i = 0, j = 0, edits = 0
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue }
        if (++edits > 1) return false
        if (a.length > b.length) i++
        else if (b.length > a.length) j++
        else { i++; j++ }
      }
      edits += (a.length - i) + (b.length - j)
      return edits <= 1
    },

    // --- Práctica ---
    getExampleWordClass(key, idx) {
      const state = this.exampleStates[key]
      const progress = this.exampleProgress[key] || 0
      if (idx < progress) return 'text-green-600 font-semibold'
      if (state === 'incorrect') return 'text-red-600'
      return ''
    },
    startPracticeExample(key) {
      this.isPracticing = true
      this.isListening = true
      this.practicingKey = key
      this.exampleStates = { ...this.exampleStates, [key]: null }
      this.exampleProgress = { ...this.exampleProgress, [key]: 0 }
      
      this.isListening = true
      if (this.recognition) this.recognition.start()
      
    },
    stopPracticeExample() {
      this.isListening = false
      this.isPracticing = false
      this.exampleStates = {}
      this.exampleProgress = {}
      this.practicingKey = null
      if (this.recognition) this.recognition.stop()
    },

    handleRecognitionResult(event) {
      if (!this.isListening || !this.practicingKey) return
      const raw = this.modal.card?.examples?.[this.practicingKey] || ''
      const targetWords = this.tokenize(raw).map(this.norm)

      // reconstruir transcript completo (interim + final)
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) {
        transcript += (event.results[i][0]?.transcript || '') + ' '
      }
      const spokenWords = this.tokenize(transcript).map(this.norm)

      // progreso como prefijo más largo tolerante
      let progress = 0
      for (let k = 0; k < Math.min(spokenWords.length, targetWords.length); k++) {
        if (this.closeEnough(spokenWords[k], targetWords[k])) progress++
        else break
      }
      this.exampleProgress = { ...this.exampleProgress, [this.practicingKey]: progress }

      // al finalizar: alineación laxa permitiendo ruido
      if (event.results[event.results.length - 1]?.isFinal) {
        const prevProgress = this.exampleProgress[this.practicingKey] || 0
        let progress = prevProgress

        for (let i = 0; i < spokenWords.length && progress < targetWords.length; i++) {
          if (this.closeEnough(spokenWords[i], targetWords[progress])) {
            progress++
          }
        }

        this.exampleProgress = {
          ...this.exampleProgress,
          [this.practicingKey]: progress
        }

        const correct = progress === targetWords.length
        this.exampleStates = {
          ...this.exampleStates,
          [this.practicingKey]: correct ? 'correct' : 'incorrect'
        }

        if (correct) {
          this.isListening = false
          if (this.recognition) this.recognition.stop()
        }
      }
    },
    handleRecognitionError() {
      this.stopPracticeExample()
    },
    handleRecognitionEnd() {
      if (this.isListening && this.practicingKey) {
        this.recognition.start()
      }
    },

    // Controles globales (si los usas en otro lado)
    togglePractice() {
      if (this.isPracticing) this.stopPractice()
      else this.startPractice()
    },
    startPractice() {
      // opcional si tienes botón global
    },
    stopPractice() {
      // opcional si tienes botón global
    }
  }
}
</script>

<style scoped>
.flashcard { transition: box-shadow 0.2s; }
.flashcard:hover { box-shadow: 0 4px 16px rgba(59,130,246,0.15); }
</style>
