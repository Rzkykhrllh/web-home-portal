import { useEffect } from 'react'
import { JUMP_TIME } from './config.js'
import { input, player, uiStore } from './store.js'
import { enterPortal } from './portal-nav.js'
import { setPhoto } from './photo.js'
import { buyDrink } from './vending.js'

const MOVE = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'])

export function jump() {
  if (player.leaving < 0 && player.jump > JUMP_TIME * 0.8) player.jump = 0
}
export function spin() {
  if (player.leaving < 0) player.hop = 0
}

export function useInput() {
  useEffect(() => {
    const down = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t.closest?.('input, textarea, select, [contenteditable]')) return
      const onControl = t.closest?.('a, button')
      const k = e.key.toLowerCase()
      if (MOVE.has(k)) {
        input.keys.add(k)
        player.path = []
        e.preventDefault()
      } else if (k === ' ' && !onControl) {
        e.preventDefault()
        if (!e.repeat) jump()
      } else if ((k === 'k' || k === 'x') && !e.repeat) {
        spin()
      } else if ((k === 'e' || (k === 'enter' && !onControl)) && !e.repeat) {
        const ui = uiStore.get()
        if (ui.near) enterPortal(ui.near)
        else if (ui.vend) buyDrink()
      } else if (k === 'p' && !e.repeat) {
        setPhoto(!uiStore.get().photo)
      } else if (k === 'escape' && uiStore.get().photo) {
        setPhoto(false)
      }
    }
    const up = (e) => input.keys.delete(e.key.toLowerCase())
    const clear = () => input.keys.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])
}
