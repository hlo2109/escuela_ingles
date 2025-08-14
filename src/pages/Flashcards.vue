<template>
  <div>
    <h2 class="text-2xl font-bold text-center text-blue-600 mb-8">Tarjetas de Vocabulario</h2>
    <div v-if="grouped.length" class="mb-8">
      <div v-for="group in grouped" :key="group.letter" class="mb-6">
        <h3 class="text-xl font-semibold text-blue-500 mb-2">{{ group.letter.toUpperCase() }}</h3>
        <div class="flex flex-wrap gap-3">
          <div v-for="card in group.cards" :key="card.english" class="bg-white border rounded-lg shadow px-4 py-2 cursor-pointer hover:bg-blue-50" @click="openModal(card)">
            <span class="font-bold text-lg">{{ card.english }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="text-center py-10">Cargando tarjetas...</div>

    <!-- Modal -->
    <div v-if="modal.visible" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full relative overflow-y-auto" style="max-height: 90vh;">
        <button class="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl" @click="closeModal">&times;</button>
        <h2 class="text-2xl font-bold mb-2 flex items-center">
          <span @click="playWord(modal.card.english)" class="cursor-pointer hover:text-blue-600">{{ modal.card.english }}</span>
          <span class="ml-3 text-gray-500 text-lg">/{{ modal.card.english_pronunciation }}/</span>
          <button class="ml-2 px-2 py-1 bg-blue-500 text-white rounded" @click="playWord(modal.card.english)"><i class="fas fa-volume-up"></i></button>
        </h2>
        <h3 class="text-lg mb-2 text-blue-600">{{ modal.card.spanish }}</h3>
        <h4 class="font-semibold mb-2">Ejemplos:</h4>
        <div class="mb-4">
          <span v-if="!speechSupported" class="text-red-500">Reconocimiento de voz no soportado</span>
        </div>
        <div v-for="(ex, key) in modal.card.examples" :key="key" class="mb-2">
          <div class="flex items-center gap-2">
            <span>
              <template v-for="(word, idx) in ex.split(/\s+/)" :key="idx">
                <span :class="getExampleWordClass(key, idx)">{{ word }}</span><span> </span>
              </template>
            </span>
            <span
              @click="playExample(ex)"
              class="cursor-pointer text-blue-700 hover:underline"
            >🔊</span>
            <button
              class="px-3 py-1 bg-green-500 text-white rounded"
              @click="startPracticeExample(key)"
              :disabled="!speechSupported"
            >
              <i class="fas fa-microphone mr-1"></i> Practicar
            </button>
            <span v-if="modal.card.examples[key + '_pronunciation_es_lat']" class="ml-2 text-gray-500">/{{ modal.card.examples[key + '_pronunciation_es_lat'] }}/</span>
            <span v-if="isListening && practicingKey === key" class="text-green-600 ml-2">Escuchando...</span>
          </div>
        </div>
    <!-- Mensaje global eliminado, ahora cada ejemplo muestra su estado -->
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
      modal: {
        visible: false,
        card: null
      },
      synth: null,
      speechSupported: true,
  isListening: false,
  practicingKey: null,
  exampleStates: {},
    exampleProgress: {},
  recognition: null,
  examplePronouncing: null
    }
  },
  mounted() {
    fetch('/flashcards_vue.json')
      .then(res => res.json())
      .then(data => {
        this.cards = data;
        this.grouped = this.groupByLetter(this.cards);
      });
    this.synth = window.speechSynthesis;
    // Reconocimiento de voz
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.maxAlternatives = 5;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.onresult = this.handleRecognitionResult;
      this.recognition.onerror = this.handleRecognitionError;
      this.recognition.onend = this.handleRecognitionEnd;
    } catch (e) {
      this.speechSupported = false;
    }
  },
  methods: {
    groupByLetter(cards) {
      const groups = {};
      cards.forEach(card => {
        const letter = card.english[0].toLowerCase();
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(card);
      });
      return Object.keys(groups).sort().map(letter => ({ letter, cards: groups[letter] }));
    },
    openModal(card) {
      this.modal.visible = true;
      this.modal.card = card;
    },
    closeModal() {
      this.modal.visible = false;
      this.modal.card = null;
    },
    playWord(word) {
      const utter = new window.SpeechSynthesisUtterance(word);
      this.synth.speak(utter);
    },
    playDefinition(def) {
      const utter = new window.SpeechSynthesisUtterance(def);
      this.synth.speak(utter);
    },
    playExample(ex) {
      const utter = new window.SpeechSynthesisUtterance(ex);
      utter.lang = 'en-US';
      utter.rate = 1;
      this.synth.speak(utter);
    },
    playExamplePronunciation(ex, ipa) {
      // Si hay IPA, usa el texto del ejemplo pero con voz en inglés y velocidad normal
      const utter = new window.SpeechSynthesisUtterance(ex);
      utter.lang = 'en-US';
      utter.rate = 1;
      // No se puede reproducir IPA directamente, pero se puede mostrar en el tooltip
      this.synth.speak(utter);
    },
    handleExamplePronunciationClick(key, ex, ipa) {
      this.examplePronouncing = key;
      this.playExamplePronunciation(ex, ipa);
      // Reset visual feedback after speech ends
      const onEnd = () => {
        this.examplePronouncing = null;
        utter.removeEventListener('end', onEnd);
      };
      const utter = new window.SpeechSynthesisUtterance(ex);
      utter.lang = 'en-US';
      utter.rate = 1;
      utter.addEventListener('end', onEnd);
      this.synth.speak(utter);
    },
    togglePractice() {
      if (this.isPracticing) {
        this.stopPractice();
      } else {
        this.startPractice();
      }
    },
    startPractice() {
      this.isPracticing = true;
      this.isListening = true;
      this.currentExampleIndex = 0;
      this.exampleStates = Object.keys(this.modal.card.examples)
        .filter(k => !k.includes('pronunciation'))
        .map(() => 'normal');
      this.setExampleHighlight();
      this.recognition.start();
    },
    stopPractice() {
      this.isPracticing = false;
      this.isListening = false;
      this.recognition.stop();
      this.exampleStates = [];
    },
    getExampleClass(key) {
      const state = this.exampleStates[key];
      if (state === 'highlight') return 'word word-highlight';
      if (state === 'correct') return 'word word-correct';
      if (state === 'incorrect') return 'word word-incorrect';
      return 'word';
    },
    getExampleWordClass(key, idx) {
      if (this.practicingKey === key && this.exampleProgress[key] !== undefined) {
        if (idx < this.exampleProgress[key]) {
          return 'word word-correct';
        } else if (idx === this.exampleProgress[key]) {
          return 'word word-highlight';
        }
      }
      const state = this.exampleStates[key];
      if (state === 'correct') return 'word word-correct';
      if (state === 'incorrect') return 'word word-incorrect';
      return 'word';
    },
    startPracticeExample(key) {
      this.isListening = true;
      this.practicingKey = key;
    this.exampleStates = { ...this.exampleStates, [key]: null };
    this.exampleProgress = { ...this.exampleProgress, [key]: 0 };
      this.recognition.start();
    },
    stopPracticeExample() {
      this.isListening = false;
      this.exampleStates = {};
    this.exampleProgress = {};
      this.practicingKey = null;
      this.recognition.stop();
    },
    norm(w) {
      return w.toLowerCase().replace(/[.,?!;:"'()]/g, "");
    },
    consumeMatches(spokenWords, statesArray, wordsArray, startIdx) {
      let idx = startIdx;
      let j = 0;
      while (j < spokenWords.length && idx < wordsArray.length) {
        const target = this.norm(wordsArray[idx]);
        const said = this.norm(spokenWords[j]);
        if (said === target) {
          statesArray[idx] = 'correct';
          idx++;
          j++;
        } else {
          break;
        }
      }
      return { advanced: idx - startIdx, consumed: j };
    },
    handleRecognitionResult(event) {
      if (!this.isListening || !this.practicingKey) return;
      const ex = this.modal.card.examples[this.practicingKey];
      const targetWords = ex.split(/\s+/).filter(Boolean);
      // Procesa resultados intermedios para seguimiento
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }
      transcript = transcript.trim().toLowerCase();
      const spokenWords = transcript.split(/\s+/).filter(Boolean);
      // Calcula el progreso
      let progress = 0;
      for (let i = 0; i < spokenWords.length && i < targetWords.length; i++) {
        if (this.norm(spokenWords[i]) === this.norm(targetWords[i])) {
          progress++;
        } else {
          break;
        }
      }
      this.exampleProgress = {
        ...this.exampleProgress,
        [this.practicingKey]: progress
      };
      // Si resultado final, evalúa correcto/incorrecto
      if (event.results[event.results.length - 1].isFinal) {
        let correct = progress === targetWords.length;
        this.exampleStates = {
          ...this.exampleStates,
          [this.practicingKey]: correct ? 'correct' : 'incorrect'
        };
        this.isListening = false;
        setTimeout(() => {
          this.exampleStates = { ...this.exampleStates, [this.practicingKey]: null };
          this.exampleProgress = { ...this.exampleProgress, [this.practicingKey]: 0 };
          this.practicingKey = null;
        }, 2000);
        this.recognition.stop();
      }
    },
    handleRecognitionError(event) {
      this.stopPracticeExample();
    },
    handleRecognitionEnd() {
      if (this.isListening && this.practicingKey) {
        this.recognition.start();
      }
    }
  }
}
</script>
<style scoped>
.flashcard {
  transition: box-shadow 0.2s;
}
.flashcard:hover {
  box-shadow: 0 4px 16px rgba(59,130,246,0.15);
}
</style>
