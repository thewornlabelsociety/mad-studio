import { useLocation } from "wouter"

export { Link as default } from "wouter"

export function useRouter() {
  // These names mirror the old navigation contract while using client-side routes.
  return {
    push: (path: string, _options?: { scroll?: boolean }) => { window.location.assign(path) },
    replace: (path: string, _options?: { scroll?: boolean }) => { window.location.replace(path) },
    refresh: () => { window.dispatchEvent(new Event("mad:refresh")) },
    back: () => { window.history.back() },
  }
}

export function usePathname() {
  const [pathname] = useLocation()
  return pathname
}

export function useSearchParams() {
  useLocation()
  return new URLSearchParams(window.location.search)
}

export function redirect(path: string): never {
  window.location.replace(path)
  throw new Error("MAD_REDIRECT")
}

export async function cookies() {
  return {
    get(name: string) {
      const value = document.cookie.split("; ").find((cookie) => cookie.startsWith(`${name}=`))
      return value ? { value: decodeURIComponent(value.slice(name.length + 1)) } : undefined
    },
  }
}