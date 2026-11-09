// Runs before the page paints, so the saved theme never flashes the wrong colors.
try {
  var saved = localStorage.getItem('theme')
  document.documentElement.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
} catch {
  document.documentElement.dataset.theme = 'light'
}
