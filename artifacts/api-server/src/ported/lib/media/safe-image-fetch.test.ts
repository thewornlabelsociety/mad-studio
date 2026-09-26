import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchPublicImage,
  isPublicAddress,
  resolvePublicAddress,
  type SafeImageDependencies,
} from "./safe-image-fetch.ts";

test("rejects loopback, private, link-local, reserved, and mapped private IPs", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("rejects hostnames with any private DNS answer before making a request", async () => {
  await assert.rejects(
    resolvePublicAddress("image.attacker.test", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "169.254.169.254", family: 4 },
    ]),
    /only to public IP addresses/
  );
});

test("revalidates every redirect and pins the request to the vetted DNS address", async () => {
  const targets: string[] = [];
  let requestCount = 0;
  const dependencies: SafeImageDependencies = {
    lookup: async (hostname) => {
      targets.push(hostname);
      if (hostname === "image.attacker.test") {
        return [{ address: "93.184.216.34", family: 4 }];
      }
      return [{ address: "127.0.0.1", family: 4 }];
    },
    request: async (url, address) => {
      requestCount += 1;
      assert.equal(address.address, "93.184.216.34");
      return {
        status: 302,
        headers: { location: "http://metadata.attacker.test/latest/meta-data/" },
        bytes: Buffer.alloc(0),
      };
    },
  };
  await assert.rejects(
    fetchPublicImage("https://image.attacker.test/photo.jpg", dependencies),
    /only to public IP addresses/
  );
  assert.deepEqual(targets, ["image.attacker.test", "metadata.attacker.test"]);
  assert.equal(requestCount, 1);
});

test("accepts a supported raster image from a public pinned address", async () => {
  const image = Buffer.from("test-image");
  const result = await fetchPublicImage("https://images.example.test/photo.webp", {
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async (_url, address) => {
      assert.equal(address.address, "93.184.216.34");
      return {
        status: 200,
        headers: { "content-type": "image/webp", "content-length": image.length },
        bytes: image,
      };
    },
  });
  assert.equal(result.contentType, "image/webp");
  assert.deepEqual(result.bytes, image);
});