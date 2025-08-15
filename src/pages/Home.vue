<template>
  <div class="text-center py-10">
    <h2 class="text-3xl font-bold text-blue-600 mb-4">Bienvenido a Aprender Inglés</h2>
    <p class="text-lg">Practica cuentos, pronunciación y más.</p>

    <RandomFlashcardsSlider :cards="cards" :count="10" />
  </div>
</template>
<script>
import RandomFlashcardsSlider from '@/components/RandomFlashcardsSlider.vue'
export default {
  name: 'Home',
   components: { RandomFlashcardsSlider },
   data(){ return { cards: [] } },
   mounted() {
     fetch('/flashcards_vue.json')
      .then(res => res.json())
      .then(data => {
        this.cards = data
      });
   } 
}
</script>
