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
        <div class="mb-4">
          <span class="font-semibold">Definición:</span>
          <span>{{ modal.card.definition }}</span>
          <button class="ml-2 px-2 py-1 bg-blue-500 text-white rounded" @click="playDefinition(modal.card.definition)"><i class="fas fa-volume-up"></i></button>
        </div>
        <div>
          <h4 class="font-semibold mb-2">Ejemplos:</h4>
          <div class="mb-4">
            <button v-if="speechSupported" @click="togglePractice" class="px-3 py-1 bg-green-500 text-white rounded mb-2">
              <i class="fas fa-microphone mr-1"></i>{{ isPracticing ? 'Detener práctica' : 'Practicar ejemplos' }}
            </button>
            <span v-else class="text-red-500">Reconocimiento de voz no soportado</span>
          </div>
          <div v-for="(ex, key) in modal.card.examples" :key="key" class="mb-2">
            <div class="flex items-center gap-2">
              <span
                v-if="isPracticing"
                :class="getExampleClass(key)"
              >{{ ex }}</span>
              <span
                v-else
                @click="playExample(ex)"
                class="cursor-pointer text-blue-700 hover:underline"
              >{{ ex }}</span>
                <button
                  class="px-2 py-1 rounded focus:outline-none"
                  :class="{'bg-blue-700': examplePronouncing === key, 'bg-blue-500': examplePronouncing !== key, 'text-white': true}"
                  @click="handleExamplePronunciationClick(key, ex, modal.card.examples[key + '_pronunciation_es_lat'])"
                >
                  <i class="fas fa-volume-up"></i>
                </button>
              <span v-if="modal.card.examples[key + '_pronunciation_es_lat']" class="ml-2 text-gray-500">/{{ modal.card.examples[key + '_pronunciation_es_lat'] }}/</span>
            </div>
          </div>
          <div v-if="isPracticing" class="mt-2">
            <span v-if="isListening" class="text-green-600">Escuchando...</span>
            <span v-else class="text-gray-500">Haz clic en "Practicar ejemplos" y pronuncia el ejemplo resaltado.</span>
          </div>
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
      modal: {
        visible: false,
        card: null
      },
      synth: null,
      speechSupported: true,
      isPracticing: false,
      isListening: false,
      currentExampleIndex: 0,
      exampleStates: [],
      recognition: null
    , examplePronouncing: null
    }
  },
  mounted() {
    fetch('/ingles/flashcards_vue.json')
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
    setExampleHighlight() {
      this.exampleStates = this.exampleStates.map((state, idx) => {
        if (state === 'correct' || state === 'incorrect') return state;
        return idx === this.currentExampleIndex ? 'highlight' : 'normal';
      });
    },
    getExampleClass(idx) {
      const state = this.exampleStates[idx];
      if (state === 'highlight') return 'word word-highlight';
      if (state === 'correct') return 'word word-correct';
      if (state === 'incorrect') return 'word word-incorrect';
      return 'word';
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
      if (!this.isListening || !this.isPracticing) return;
      const exampleKeys = Object.keys(this.modal.card.examples).filter(k => !k.includes('pronunciation'));
      const allExamples = exampleKeys.map(k => this.modal.card.examples[k]);
      const res = event.results[event.results.length - 1];
      const text = res[0].transcript.trim().toLowerCase();
      if (!text) return;
      if (res.isFinal) {
        const spokenWords = text.split(/\s+/).filter(Boolean);
        if (this.currentExampleIndex < this.exampleStates.length) {
          const { advanced } = this.consumeMatches(spokenWords, this.exampleStates, allExamples, this.currentExampleIndex);
          if (advanced > 0) {
            this.currentExampleIndex += advanced;
          } else {
            this.exampleStates[this.currentExampleIndex] = 'incorrect';
          }
        }
        this.setExampleHighlight();
      }
    },
    handleRecognitionError(event) {
      this.stopPractice();
    },
    handleRecognitionEnd() {
      if (this.isListening && this.isPracticing) {
        this.recognition.start();
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
