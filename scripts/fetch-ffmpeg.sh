#!/usr/bin/env bash
# Downloads a static ffmpeg/ffprobe into rocktz-api/bin (not committed).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/rocktz-api/bin"
mkdir -p "$dest"
if [[ -x "$dest/ffmpeg" && -x "$dest/ffprobe" ]]; then
  echo "ffmpeg already at $dest/ffmpeg"
  exit 0
fi
arch="$(uname -m)"
if [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
  url="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz"
else
  url="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "Downloading $url"
curl -fL --retry 3 -o "$tmp/ffmpeg.tar.xz" "$url"
tar -xJf "$tmp/ffmpeg.tar.xz" -C "$tmp"
cp -f "$tmp"/ffmpeg-*-static/ffmpeg "$dest/ffmpeg"
cp -f "$tmp"/ffmpeg-*-static/ffprobe "$dest/ffprobe"
chmod 755 "$dest/ffmpeg" "$dest/ffprobe"
"$dest/ffmpeg" -version | head -1
