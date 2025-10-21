import { safeCreateURLSearchParams } from "./errorHandler";

export function useDevMode(): boolean {
  try {
    const params = safeCreateURLSearchParams(window.location.search);
    if (params) {
      const q = params.get("dev");
      if (q === "1" || q === "true") return true;
    }
  } catch (error) {
    console.warn('Invalid URL search params in useDevMode:', window.location.search, error);
  }
  
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