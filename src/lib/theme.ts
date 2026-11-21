import { getKV, setKV } from '../db'

export type ThemePref = 'system' | 'light' | 'dark'

const LS_KEY = 'nb-theme'

function systemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Apply the theme to the page (and the iPhone status bar color). */
export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
  const dark = pref === 'dark' || (pref === 'system' && systemDark())
  const color = dark ? '#1C1A26' : '#F6F3EE'
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
}

/** Called before React renders, so there's no flash of the wrong theme. */
export function applySavedThemeEarly() {
  let pref: ThemePref = 'system'
  try {
    pref = (localStorage.getItem(LS_KEY) as ThemePref) || 'system'
  } catch {
    /* storage unavailable */
  }
  applyTheme(pref)
  // The database is the source of truth (it's what gets backed up).
  getKV<ThemePref>('theme').then((saved) => {
    if (saved && saved !== pref) {
      applyTheme(saved)
      try {
        localStorage.setItem(LS_KEY, saved)
      } catch {
        /* ignore */
      }
    }
  })
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme((document.documentElement.dataset.theme as ThemePref) || 'system')
  })
}

export async function saveTheme(pref: ThemePref) {
  applyTheme(pref)
  try {
    localStorage.setItem(LS_KEY, pref)
  } catch {
    /* ignore */
  }
  await setKV('theme', pref)
}
