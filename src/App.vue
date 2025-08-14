<template>
  <div class="bg-gray-50 min-h-screen">
    <nav class="bg-white shadow mb-6">
      <div class="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 class="text-2xl font-bold text-blue-600">Aprender Inglés</h1>
        <div class="space-x-4">
          <router-link to="/ingles/" class="text-blue-500 hover:underline">Inicio</router-link>
          <router-link to="/ingles/stories" class="text-blue-500 hover:underline">Cuentos</router-link>
          <router-link to="/ingles/flashcards" class="text-blue-500 hover:underline">Flashcards</router-link>
        </div>
      </div>
    </nav>
    <div class="container mx-auto px-4 py-8 max-w-4xl">
      <router-view />
    </div>
  </div>
</template>

<script>
import { RouterView, RouterLink } from 'vue-router';
export default {
  components: {
    RouterView,
    RouterLink
  }
};
</script>

<style scoped>
.word {
  background-color: #fef08a;
  transition: background-color 0.3s;
  cursor: pointer;
}
.pronunciation {
  background-color: #bfdbfe;
  transition: background-color 0.3s;
}
</style>
