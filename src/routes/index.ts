import { createRouter, createWebHistory } from 'vue-router'

import HomePage from '@/pages/homePage.vue'
import LoginRedirect from '@/pages/loginRedirect.vue'
import SignIn from '@/pages/signIn.vue'
import SignMessage from '@/pages/signMessage.vue'

const routes = [
  {
    path: '/:appId/login',
    component: SignIn,
  },
  {
    path: '/:appId/redirect/',
    component: LoginRedirect,
  },
  {
    path: '/:appId/',
    component: HomePage,
  },
  {
    name: 'signMessage',
    path: '/:appId/signMessage',
    component: SignMessage,
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
