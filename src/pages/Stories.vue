<template>
  <div>
    <h2 class="text-2xl font-bold text-center text-blue-600 mb-8">Cuentos en Inglés</h2>
    <div v-if="stories.length">
      <select v-model="selectedStoryId" @change="onStoryChange" class="w-full p-3 border border-gray-300 rounded-lg mb-6">
        <option v-for="story in stories" :key="story.id" :value="story.id">{{ story.title }}</option>
      </select>
      <div class="bg-white rounded-lg shadow-md p-6 mb-8">
        <h3 class="text-xl font-bold mb-4">{{ currentStory?.title }}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- English Version -->
          <div>
            <h4 class="text-blue-600 font-semibold mb-2">Inglés</h4>
            <div class="text-lg leading-relaxed">
              <template v-for="(paragraph, pIdx) in currentStory?.english" :key="pIdx">
                <p class="mb-4">
                  <template v-for="(word, wIdx) in splitWords(paragraph)" :key="wIdx">
                    <span
                      v-if="word.trim()"
                      :class="getWordClass('english', wIdx, pIdx)"
                      @click="onWordClick(word)"
                      @mouseenter="showTooltip($event, word)"
                      @mouseleave="hideTooltip"
                    >{{ word }}</span>
                    <template v-else>{{ word }}</template>
                  </template>
                </p>
              </template>
            </div>
          </div>
          <!-- Spanish Pronunciation -->
          <div>
            <h4 class="text-blue-600 font-semibold mb-2">Pronunciación</h4>
            <div class="text-lg leading-relaxed">
              <template v-for="(paragraph, pIdx) in currentStory?.pronunciation" :key="pIdx">
                <p class="mb-4">
                  <template v-for="(word, wIdx) in splitWords(paragraph)" :key="wIdx">
                    <span
                      v-if="word.trim()"
                      :class="getWordClass('pronunciation', wIdx, pIdx)"
                    >{{ word }}</span>
                    <template v-else>{{ word }}</template>
                  </template>
                </p>
              </template>
            </div>
          </div>
        </div>
      </div>
      <!-- Controls -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center space-x-4">
            <button @click="handleListen" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">
              <i class="fas fa-volume-up mr-2"></i> {{ isSpeaking ? 'Stop' : 'Listen' }}
            </button>
            <button @click="handlePractice" :disabled="!speechSupported" :class="['bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center', !speechSupported ? 'opacity-50 cursor-not-allowed' : '']">
              <i class="fas fa-microphone mr-2"></i> {{ isListening ? 'Stop' : 'Practice' }}
            </button>
            <div v-if="isListening" class="flex items-center text-gray-600">
              <div class="w-3 h-3 rounded-full bg-red-500 animate-pulse mr-2"></div>
              <span>Escuchando...</span>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-gray-600">Velocidad:</span>
            <select v-model="speechRate" class="p-2 border border-gray-300 rounded-lg">
              <option value="0.7">Lento</option>
              <option value="1">Normal</option>
              <option value="1.3">Rápido</option>
            </select>
          </div>
        </div>
        <div v-if="showFeedback" class="mt-4">
          <div class="flex items-center">
            <div class="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
            <span class="text-sm text-gray-600">Pronunciación correcta</span>
          </div>
          <div class="flex items-center mt-1">
            <div class="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
            <span class="text-sm text-gray-600">Pronunciación incorrecta</span>
          </div>
        </div>
        <div v-if="tooltip.visible" :style="tooltip.style" class="fixed z-50 bg-white border border-blue-400 px-3 py-2 rounded-lg shadow text-base">{{ tooltip.text }}</div>
      </div>
    </div>
    <div v-else class="text-center py-10">Cargando cuentos...</div>
  </div>
</template>
<script>
export default {
  name: 'Stories',
  data() {
    return {
      stories: [],
      selectedStoryId: 0,
      currentStory: null,
      speechRate: 1,
      isSpeaking: false,
      isListening: false,
      speechSupported: true,
      showFeedback: false,
      currentWordIndex: 0,
      currentPronunciationIndex: 0,
      wordStates: [],
      pronunciationStates: [],
      recognition: null,
      synth: null,
      tooltip: {
        visible: false,
        text: '',
        style: {}
      },
      OPTIONAL_WORDS: new Set(["a","the","an","in","on","at","to","of","and"])
    }
  },
  mounted() {
    fetch('/stories.json')
      .then(res => res.json())
      .then(data => {
        this.stories = data.stories;
        this.currentStory = this.stories[0];
        this.resetStates();
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
    splitWords(paragraph) {
      return paragraph.split(/(\s+)/);
    },
    onStoryChange() {
      this.currentStory = this.stories.find(s => s.id === Number(this.selectedStoryId));
      this.resetStates();
      this.showFeedback = false;
    },
    resetStates() {
      // Inicializa los arrays de estados solo para palabras (sin espacios)
      this.wordStates = [];
      this.pronunciationStates = [];
      this.currentWordIndex = 0;
      this.currentPronunciationIndex = 0;
      if (!this.currentStory) return;
      this.currentStory.english.forEach(paragraph => {
        this.wordStates.push(...paragraph.split(/(\s+)/).filter(w => w.trim()).map(() => 'normal'));
      });
      this.currentStory.pronunciation.forEach(paragraph => {
        this.pronunciationStates.push(...paragraph.split(/(\s+)/).filter(w => w.trim()).map(() => 'normal'));
      });
      // Primer highlight
      this.setHighlight();
    },
    setHighlight() {
      this.wordStates = this.wordStates.map((state, idx) => {
        if (state === 'correct' || state === 'incorrect') return state;
        return idx === this.currentWordIndex ? 'highlight' : 'normal';
      });
      this.pronunciationStates = this.pronunciationStates.map((state, idx) => {
        if (state === 'correct' || state === 'incorrect') return state;
        return idx === this.currentPronunciationIndex ? 'highlight' : 'normal';
      });
    },
    getWordClass(type, wIdx, pIdx) {
      // Calcula el índice global de la palabra ignorando los espacios
      let idx = 0;
      for (let i = 0; i < pIdx; i++) {
        idx += this.splitWords(type === 'english' ? this.currentStory.english[i] : this.currentStory.pronunciation[i]).filter(w => w.trim()).length;
      }
      // Solo cuenta palabras, ignora espacios
      const wordsInParagraph = this.splitWords(type === 'english' ? this.currentStory.english[pIdx] : this.currentStory.pronunciation[pIdx]);
      let realWIdx = 0;
      for (let k = 0; k <= wIdx; k++) {
        if (wordsInParagraph[k] && wordsInParagraph[k].trim()) realWIdx++;
      }
      idx += realWIdx - 1;
      const state = type === 'english' ? this.wordStates[idx] : this.pronunciationStates[idx];
      if (state === 'highlight') return type === 'english' ? 'word word-highlight' : 'pronunciation pronunciation-highlight';
      if (state === 'correct') return type === 'english' ? 'word word-correct' : 'pronunciation pronunciation-correct';
      if (state === 'incorrect') return type === 'english' ? 'word word-incorrect' : 'pronunciation pronunciation-incorrect';
      return type === 'english' ? 'word' : 'pronunciation';
    },
    handleListen() {
      if (this.synth.speaking) {
        this.synth.cancel();
        this.isSpeaking = false;
        return;
      }
      const textToSpeak = this.currentStory.english.join(' ');
      const utterance = new window.SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = parseFloat(this.speechRate);
      utterance.onstart = () => { this.isSpeaking = true; };
      utterance.onend = () => { this.isSpeaking = false; };
      this.synth.speak(utterance);
    },
    handlePractice() {
      if (this.isListening) {
        this.stopListening();
        this.showFeedback = false;
      } else {
        this.startListening();
        this.showFeedback = true;
      }
    },
    startListening() {
      this.isListening = true;
      this.currentWordIndex = 0;
      this.currentPronunciationIndex = 0;
      this.resetStates();
      this.recognition.start();
    },
    stopListening() {
      this.isListening = false;
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
        } else if (this.OPTIONAL_WORDS.has(target)) {
          idx++;
        } else if (this.OPTIONAL_WORDS.has(said)) {
          j++;
        } else {
          break;
        }
      }
      return { advanced: idx - startIdx, consumed: j };
    },
    setNextHighlight() {
      this.setHighlight();
    },
    handleRecognitionResult(event) {
      if (!this.isListening) return;
      // Construye el array de palabras
      const allWords = this.stories.length ? this.stories[this.selectedStoryId].english.flatMap(p => this.splitWords(p).filter(w => w.trim())) : [];
      const res = event.results[event.results.length - 1];
      const text = res[0].transcript.trim().toLowerCase();
      if (!text) return;
      if (res.isFinal) {
        const spokenWords = text.split(/\s+/).filter(Boolean);
        if (this.currentWordIndex < this.wordStates.length) {
          const { advanced } = this.consumeMatches(spokenWords, this.wordStates, allWords, this.currentWordIndex);
          if (advanced > 0) {
            this.currentWordIndex += advanced;
          } else {
            this.wordStates[this.currentWordIndex] = 'incorrect';
          }
        }
        this.setNextHighlight();
      }
    },
    handleRecognitionError(event) {
      this.stopListening();
    },
    handleRecognitionEnd() {
      if (this.isListening) {
        this.recognition.start();
      }
    },
    onWordClick(word) {
      const utter = new window.SpeechSynthesisUtterance(word);
      utter.rate = parseFloat(this.speechRate);
      this.synth.speak(utter);
    },
    showTooltip(event, word) {
      // Traducción localStorage (opcional, aquí solo muestra la palabra)
      this.tooltip.text = word;
      this.tooltip.visible = true;
      this.tooltip.style = {
        top: event.clientY + 10 + 'px',
        left: event.clientX + 'px'
      };
    },
    hideTooltip() {
      this.tooltip.visible = false;
    }
  }
}
</script>
<style scoped>
.word {
  transition: background-color 0.3s;
  cursor: pointer;
}
.word-highlight {
  background-color: #fef08a;
}
.word-correct {
  background-color: #86efac;
}
.word-incorrect {
  background-color: #fca5a5;
}
.pronunciation {
  transition: background-color 0.3s;
}
.pronunciation-highlight {
  background-color: #bfdbfe;
}
.pronunciation-correct {
  background-color: #86efac;
}
.pronunciation-incorrect {
  background-color: #fca5a5;
}
</style>
