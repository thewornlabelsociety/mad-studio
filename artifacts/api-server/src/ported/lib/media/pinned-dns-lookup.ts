import net from "node:net"

/** Node HTTP(S) custom lookup — supports `(hostname, options, cb)` and `(hostname, cb)`. */
export function createPinnedLookup(targetIp: string) {
  return function pinnedLookup(
    hostname: string,
    options: unknown,
    callback?: (...args: any[]) => void
  ) {
    const cb = typeof options === "function" ? (options as Function) : callback
    if (typeof cb !== "function") return

    const family = net.isIP(targetIp)
    if (!targetIp || !family) {
      const err: NodeJS.ErrnoException = new Error(`Invalid IP address: ${targetIp}`)
      err.code = "ENOTFOUND"
      return cb(err, "", 4)
    }

    const opts = typeof options === "object" && options !== null ? (options as Record<string, any>) : {}
    if (opts.all) {
      return cb(null, [{ address: targetIp, family }])
    }

    return cb(null, targetIp, family)
  }
}
