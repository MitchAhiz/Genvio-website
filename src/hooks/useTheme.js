import { useLayoutEffect } from 'react'

// Applies a section theme by setting data-theme on <html>. Pass null for the
// default (Women's) tokens. Cleans up when the owning route unmounts.
export function useTheme(theme) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.theme
    if (theme) root.dataset.theme = theme
    else delete root.dataset.theme
    return () => {
      if (previous) root.dataset.theme = previous
      else delete root.dataset.theme
    }
  }, [theme])
}
