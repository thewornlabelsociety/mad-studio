import net from "node:net"

/** Node HTTP(S) custom lookup — supports `(hostname, options, cb)` and `(hostname, cb)`. */
export function createPinnedLookup(targetIp: string) {
  return function pinnedLookup(
    hostname: string,
    options: unknown,
    callback?: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  ) {
    const cb = typeof options === "function" ? options : callback
    if (typeof cb !== "function") return

    if (!targetIp || !net.isIP(targetIp)) {
      const err: NodeJS.ErrnoException = new Error(`Invalid IP address: ${targetIp}`)
      err.code = "ENOTFOUND"
      return cb(err, "", 4)
    }

    const family = net.isIP(targetIp)
    return cb(null, targetIp, family)
  }
}
