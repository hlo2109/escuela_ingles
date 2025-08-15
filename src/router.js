import { createRouter, createWebHistory } from 'vue-router';
import Home from './pages/Home.vue';
import Stories from './pages/Stories.vue';

import Flashcards from './pages/Flashcards.vue';

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/stories', name: 'Stories', component: Stories },
  { path: '/verbs', name: 'Flashcards', component: Flashcards }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
