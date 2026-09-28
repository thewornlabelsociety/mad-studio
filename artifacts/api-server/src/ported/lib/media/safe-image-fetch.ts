import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

import { createPinnedLookup } from "@/lib/media/pinned-dns-lookup";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type Address = { address: string; family: number };
export type PinnedAddress = { address: string; family: 4 | 6 };
type Lookup = (hostname: string) => Promise<Address[]>;
type ImageResponse = {
  status: number;
  headers: Record<string, string | string[] | number | undefined>;
  bytes: Buffer;
};
export type SafeImageDependencies = {
  lookup?: Lookup;
  request?: (url: URL, address: Address | PinnedAddress) => Promise<ImageResponse>;
};

function ipv4IsPublic(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b, c] = octets;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 2 || b === 88 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function ipv6Bytes(value: string): number[] | null {
  let input = value.toLowerCase().split("%")[0] ?? "";
  if (input.includes(".")) {
    const lastColon = input.lastIndexOf(":");
    const v4 = input.slice(lastColon + 1);
    if (!ipv4IsPublic(v4)) return null;
    const octets = v4.split(".").map(Number);
    input = `${input.slice(0, lastColon)}:${((octets[0]! << 8) | octets[1]!).toString(16)}:${((octets[2]! << 8) | octets[3]!).toString(16)}`;
  }

  const [leftRaw, rightRaw] = input.split("::");
  const left = leftRaw ? leftRaw.split(":") : [];
  const right = rightRaw ? rightRaw.split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((input.includes("::") && missing < 1) || (!input.includes("::") && missing !== 0)) return null;
  const words = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  return words.flatMap((word) => {
    const number = Number.parseInt(word, 16);
    return [number >> 8, number & 0xff];
  });
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family !== 6) return false;
  const bytes = ipv6Bytes(address);
  if (!bytes) return false;

  // IPv4-mapped IPv6 inherits the IPv4 address's public/private status.
  if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 255 && bytes[11] === 255) {
    return ipv4IsPublic(bytes.slice(12).join("."));
  }

  // Only globally allocated unicast space is allowed; block documentation and
  // protocol-special 2001:: ranges as well as all local/multicast scopes.
  const globalUnicast = (bytes[0]! & 0xe0) === 0x20;
  const protocolSpecial =
    (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && (bytes[3]! & 0xfe) === 0) ||
    (bytes[0] === 0x20 && bytes[1] === 0x02) ||
    (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b);
  const documentation = bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8;
  return globalUnicast && !protocolSpecial && !documentation;
}

export async function resolvePublicAddress(hostname: string, lookup: Lookup = (host) =>
  dnsLookup(host, { all: true, verbatim: true })
): Promise<PinnedAddress> {
  const normalized = hostname.replace(/^\[|\]$/g, "").trim();
  if (!normalized) {
    throw new Error("Media URL is missing a hostname.");
  }
  const literalFamily = isIP(normalized);
  const records: Address[] = literalFamily
    ? [{ address: normalized, family: literalFamily }]
    : await lookup(normalized);
  if (!records.length || records.some(({ address }) => !address || !isPublicAddress(address))) {
    throw new Error("Image source must resolve only to public IP addresses.");
  }
  const record = records.find((row) => row.address?.trim()) ?? records[0]!;
  return normalizePinnedAddress(record, normalized);
}

/** Normalize DNS results for Node HTTP pinned lookup (family must be 4 or 6). */
export function normalizePinnedAddress(
  record: Address | Address[],
  hostnameForErrors: string
): PinnedAddress {
  const rec = Array.isArray(record) ? record[0] : record;
  const address = rec?.address?.trim();
  if (!address) {
    throw new Error(`Could not resolve ${hostnameForErrors}.`);
  }
  const familyHint = isIP(address);
  if (!familyHint) {
    throw new Error(`Could not resolve ${hostnameForErrors}.`);
  }
  if (!isPublicAddress(address)) {
    throw new Error("Image source must resolve only to public IP addresses.");
  }
  const family: 4 | 6 =
    rec.family === 6 || familyHint === 6
      ? 6
      : 4;
  return { address, family };
}

function requestOnce(url: URL, address: Address | PinnedAddress): Promise<ImageResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
    const pinnedIp = address.address;
    const pinnedLookup = createPinnedLookup(pinnedIp);
    const outgoing = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || undefined,
        method: "GET",
        path: `${url.pathname}${url.search}`,
        headers: { Accept: "image/*" },
        lookup: pinnedLookup as never,
        servername: url.hostname.replace(/^\[|\]$/g, ""),
        agent: false,
      },
      (response) => {
        const status = response.statusCode ?? 500;
        if ([301, 302, 303, 307, 308].includes(status)) {
          response.resume();
          resolve({ status, headers: response.headers, bytes: Buffer.alloc(0) });
          return;
        }

        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (declaredLength > MAX_IMAGE_BYTES) {
          outgoing.destroy(new Error("Image source exceeds the 15 MB limit."));
          response.resume();
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buffer.length;
          if (total > MAX_IMAGE_BYTES) {
            outgoing.destroy(new Error("Image source exceeds the 15 MB limit."));
            response.destroy();
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => resolve({
          status,
          headers: response.headers,
          bytes: Buffer.concat(chunks),
        }));
        response.on("error", reject);
      },
    );
    outgoing.setTimeout(10_000, () => outgoing.destroy(new Error("Image source timed out.")));
    outgoing.on("error", reject);
    outgoing.end();
  });
}

export async function fetchPublicImage(
  initialUrl: string,
  dependencies: SafeImageDependencies = {}
): Promise<{ contentType: string; bytes: Buffer }> {
  let target: URL;
  try {
    target = new URL(initialUrl);
  } catch {
    throw new Error("Image source URL is invalid.");
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (
      !["http:", "https:"].includes(target.protocol) ||
      target.username ||
      target.password
    ) {
      throw new Error("Image source must be a public HTTP(S) URL.");
    }
    const address = await resolvePublicAddress(
      target.hostname.replace(/^\[|\]$/g, ""),
      dependencies.lookup
    );
    const response = await (dependencies.request ?? requestOnce)(target, address);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const rawLocation = response.headers.location;
      const location = Array.isArray(rawLocation)
        ? rawLocation[0]
        : typeof rawLocation === "string"
          ? rawLocation
          : undefined;
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("Image source has too many or invalid redirects.");
      }
      target = new URL(location, target);
      continue;
    }

    const contentType = String(response.headers["content-type"] ?? "")
      .split(";")[0]
      ?.trim()
      .toLowerCase();
    if (response.status < 200 || response.status >= 300) {
      throw new Error("Could not fetch source image.");
    }
    if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
      throw new Error("Image source did not return a supported raster image.");
    }
    return { contentType, bytes: response.bytes };
  }
  throw new Error("Image source has too many redirects.");
}