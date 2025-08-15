<template>
  <section class="relative">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-2xl font-bold">Tarjetas al azar</h2>
      <div class="flex items-center gap-2">
        <button
          class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
          @click="reshuffle"
        >
          Re-sortear
        </button>

        <div class="sm:flex gap-2">
          <button
            class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
            @click="scroll('left')"
          >
            ◀
          </button>
          <button
            class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
            @click="scroll('right')"
          >
            ▶
          </button>
        </div>
      </div>
    </div>

    <div
      ref="track"
      class="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-hide"
    >
      <article
        v-for="card in randomCards"
        :key="card.english"
        class="snap-center shrink-0 w-72 bg-white rounded-xl shadow border border-gray-100 p-4 hover:shadow-md transition cursor-pointer"
        @click="openModal(card)"
      >
        <header class="mb-2">
          <h3 class="text-xl font-semibold">{{ card.english }}</h3>
          <p class="text-blue-600">/{{ card.english_pronunciation }}/</p>
        </header>
        <p class="text-gray-600 mb-3">{{ card.spanish }}</p>
        <div class="text-sm text-gray-500">Toca para practicar</div>
      </article>

      <div v-if="!randomCards.length" class="text-gray-500">Sin tarjetas disponibles</div>
    </div>

    <!-- Modal -->
    <div
      v-if="modal.visible"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
    >
      <div
        class="bg-white rounded-lg shadow-lg p-6 max-w-xl w-full relative overflow-y-auto"
        style="max-height: 90vh"
      >
        <button
          class="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl"
          @click="closeModal"
        >
          &times;
        </button>

        <div class="flex items-center justify-between mb-3">
          <h2 class="text-2xl font-bold">
            <span
              class="cursor-pointer hover:text-blue-600"
              @click="playWord(modal.card.english)"
              >{{ modal.card.english }}</span
            >
            <span class="ml-2 text-gray-500 text-lg"
              >/{{ modal.card.english_pronunciation }}/</span
            >
            <button
              class="px-2 py-1 bg-blue-500 text-white rounded"
              @click="playWord(modal.card.english)"
            >
              <i class="fas fa-volume-up"></i>
            </button>
          </h2>
          <!-- ⬇️ Selector de velocidad (speechRate) -->
          <select
            v-model="speechRate"
            class="p-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="0.3">Lento</option>
            <option value="1">Normal</option>
            <option value="1.3">Rápido</option>
          </select>
        </div>

        <div class="flex items-center gap-2 mb-4">
          <div class="text-blue-600">{{ modal.card.spanish }}</div>
        </div>

        <!-- ⬇️ Definición -->
        <div v-if="modal.card.definition" class="prose prose-sm max-w-none mb-4">
          {{ modal.card.definition }}
        </div>

        <div class="mb-2" v-if="!speechSupported">
          <span class="text-red-500"
            >Reconocimiento de voz no soportado en este navegador.</span
          >
        </div>

        <div v-for="tense in tenses" :key="tense" class="mb-3">
          <h5 class="font-semibold capitalize text-left">{{ tense }}</h5>
          <div class="flex items-center gap-2">
            <!-- Texto -->
            <span>
              <template
                v-for="(word, idx) in (modal.card.examples[tense] || '').split(/\s+/)"
                :key="idx"
              >
                <span
                  :class="getExampleWordClass(tense, idx)"
                  @click.stop="playWord(word)"
                  class="cursor-pointer"
                  >{{ word }}</span
                ><span>&nbsp;</span>
              </template>
            </span>
            <!-- Pronunciación -->
            <span class="text-gray-500 italic">
              <template
                v-for="(word, idx2) in (
                  modal.card.examples[`${tense}_pronunciation_es_lat`] || ''
                ).split(/\s+/)"
                :key="`p-${tense}-${idx2}`"
              >
                <span :class="getExampleWordClass(tense, idx2)">{{ word }}</span
                ><span>&nbsp;</span>
              </template>
            </span>
            <!-- Botón practicar -->
            <button
              class="ml-auto px-3 py-1 bg-green-500 text-white rounded disabled:opacity-50"
              v-if="!isListening"
              @click.stop="startPracticeExample(tense)"
            >
              Practicar
            </button>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2">
          <button
            v-if="isListening"
            class="px-3 py-1 bg-gray-200 rounded"
            @click="stopPracticeExample"
          >
            Detener
          </button>
          <span v-if="isListening" class="text-sm text-gray-600">Escuchando...</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: "RandomFlashcardsSlider",
  props: {
    cards: { type: Array, default: () => [] },
    count: { type: Number, default: 10 },
  },
  data() {
    return {
      randomCards: [],
      modal: { visible: false, card: null },
      // ⬇️ control de TTS
      speechRate: "1",
      synth: null,
      // Reconocimiento
      recognition: null,
      speechSupported: true,
      isListening: false,
      isPracticing: false,
      practicingKey: null, // 'present' | 'past' | 'future'
      exampleStates: {},
      exampleProgress: {},
      tenses: ["present", "past", "future"],
    };
  },
  mounted() {
    this.reshuffle();
    if ("speechSynthesis" in window) this.synth = window.speechSynthesis;
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) throw new Error("no-sr");
      this.recognition = new SR();
      this.recognition.continuous = true;
      this.recognition.maxAlternatives = 5;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.recognition.onresult = this.handleRecognitionResult;
      this.recognition.onerror = this.handleRecognitionError;
      this.recognition.onend = this.handleRecognitionEnd;
    } catch {
      this.speechSupported = false;
    }
  },
  methods: {
    // Slider
    reshuffle() {
      const pool = [...this.cards];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      this.randomCards = pool.slice(0, this.count);
    },
    scroll(dir) {
      const el = this.$refs.track;
      if (!el) return;
      const dx = Math.min(640, el.clientWidth) * (dir === "left" ? -1 : 1);
      el.scrollBy({ left: dx, behavior: "smooth" });
    },

    // Modal
    openModal(card) {
      this.modal.visible = true;
      this.modal.card = card;
      this.resetPracticeState();
    },
    closeModal() {
      this.modal.visible = false;
      this.modal.card = null;
      this.stopPracticeExample();
    },

    // TTS
    playWord(word) {
      if (!this.synth) return;
      const u = new window.SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = parseFloat(this.speechRate || "1");
      this.synth.speak(u);
    },

    // === Helpers (alineados con tu Flashcards actual) ===
    norm(w) {
      return (w || "").toLowerCase().replace(/[.,?!;:\"'()]/g, "");
    },
    consumeMatches(spokenWords, statesArray, wordsArray, startIdx) {
      let idx = startIdx;
      let j = 0;
      while (j < spokenWords.length && idx < wordsArray.length) {
        const target = this.norm(wordsArray[idx]);
        const said = this.norm(spokenWords[j]);
        if (said === target) {
          statesArray[idx] = "correct";
          idx++;
          j++;
        } else {
          break;
        }
      }
      return { advanced: idx - startIdx, consumed: j };
    },

    // === Estados/práctica ===
    getExampleWordClass(key, idx) {
      if (this.practicingKey === key && this.exampleProgress[key] !== undefined) {
        if (idx < this.exampleProgress[key]) return "word word-correct";
        if (idx === this.exampleProgress[key]) return "word word-highlight";
      }
      const state = this.exampleStates[key];
      if (state === "correct") return "word word-correct";
      if (state === "incorrect") return "word word-incorrect";
      return "word";
    },
    resetPracticeState() {
      this.isListening = false;
      this.isPracticing = false;
      this.practicingKey = null;
      this.exampleStates = {};
      this.exampleProgress = {};
    },
    startPracticeExample(key) {
      this.isListening = true;
      this.isPracticing = true;
      this.practicingKey = key;
      this.exampleStates = { ...this.exampleStates, [key]: null };
      this.exampleProgress = { ...this.exampleProgress, [key]: 0 };
      if (this.recognition) this.recognition.start();
    },
    stopPracticeExample() {
      this.isListening = false;
      this.isPracticing = false;
      if (this.recognition) this.recognition.stop();
    },

    // === Reconocimiento (parcial acumulativo + auto-stop y mantiene verde) ===
    handleRecognitionResult(event) {
      if (!this.isListening || !this.practicingKey) return;

      const ex = this.modal.card.examples[this.practicingKey] || "";
      const targetWords = ex.split(/\s+/).filter(Boolean);

      // transcript completo
      let transcript = "";
      for (let i = 0; i < event.results.length; i++)
        transcript += (event.results[i][0]?.transcript || "") + " ";
      transcript = transcript.trim().toLowerCase();
      const spokenWords = transcript.split(/\s+/).filter(Boolean);

      // progreso parcial acumulativo
      const prev = this.exampleProgress[this.practicingKey] || 0;
      let progress = prev;
      for (let i = 0; i < spokenWords.length && progress < targetWords.length; i++) {
        if (this.norm(spokenWords[i]) === this.norm(targetWords[progress])) {
          progress++;
        }
      }
      this.exampleProgress = { ...this.exampleProgress, [this.practicingKey]: progress };

      // evaluación final + auto-stop manteniendo verde
      if (event.results[event.results.length - 1]?.isFinal) {
        const correct = progress === targetWords.length;
        this.exampleStates = {
          ...this.exampleStates,
          [this.practicingKey]: correct ? "correct" : "incorrect",
        };
        if (correct) {
          this.isListening = false;
          if (this.recognition) this.recognition.stop();
        }
      }
    },
    handleRecognitionError() {
      this.stopPracticeExample();
    },
    handleRecognitionEnd() {
      if (this.isListening && this.practicingKey) this.recognition.start();
    },
  },
};
</script>

<style scoped>
.scrollbar-hide {
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Clases visuales como en Flashcards */
.word {
  transition: background-color 0.3s;
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
</style>
