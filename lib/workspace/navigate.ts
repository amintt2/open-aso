export function reloadTo(path: string) {
  window.location.assign(new URL(path, window.location.origin).href);
}
