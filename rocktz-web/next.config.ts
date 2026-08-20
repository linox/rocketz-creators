import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

function isPrivateIpv4(host: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

function allowedDevOrigins(): string[] {
  const hosts = new Set(["localhost", "127.0.0.1"]);

  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal && isPrivateIpv4(addr.address)) {
        hosts.add(addr.address);
      }
    }
  }

  const extra = process.env.ALLOWED_DEV_ORIGINS ?? process.env.NEXT_PUBLIC_APP_URL;
  if (extra) {
    for (const value of extra.split(",")) {
      try {
        hosts.add(new URL(value.trim()).hostname);
      } catch {
        const host = value.trim().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0];
        if (host) {
          hosts.add(host);
        }
      }
    }
  }
  return [...hosts];
}

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === "production" ? { output: "export" as const } : {}),
  allowedDevOrigins: allowedDevOrigins(),
  turbopack: {
    root: path.join(__dirname),
  },
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
    ],
  },
};

export default nextConfig;