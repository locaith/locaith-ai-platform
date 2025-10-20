export function useDevMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("dev");
  if (q === "1" || q === "true") return true;
  try {
    const v = localStorage.getItem("locaith.dev");
    if (v === "1" || v === "true") return true;
  } catch {}
  return false;
}

export function setDevMode(on: boolean) {
  try {
    localStorage.setItem("locaith.dev", on ? "1" : "0");
  } catch {}
}