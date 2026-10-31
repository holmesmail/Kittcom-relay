// kittcom-relay — Deno Deploy edition (non-Cloudflare).
//
// Fetches the Broadcastify HLS feed for feed 2317 (KITTCOM) from Deno's
// network and passes playlist + audio segments through. Whether Deno's
// egress IPs are blocked by Broadcastify the same way this VM's and
// Google's are is UNPROVEN — the first live test after deployment is
// the whole point of this route.
//
// Access is gated by a secret path token so the relay is not an open
// proxy. The token is NOT stored in this file: set it as the
// RELAY_TOKEN environment variable on the Deno Deploy project.
// (The old Playground edition of this file, which hard-coded a token
// and told you to paste into dash.deno.com, is obsolete — Deno Deploy
// Classic / Playground shut down 2026-07-20.)
//
// Deploy (new platform, console.deno.com):
//   Option A — GitHub integration (no CLI needed on your side beyond
//   the repo): put this file in a GitHub repo, go to console.deno.com,
//   create a project linked to that repo with entrypoint main.ts, set
//   the RELAY_TOKEN env var, deploy.
//   Option B — CLI: install Deno, then from this directory run
//   `deno deploy --prod` (requires a Deno Deploy token from
//   console.deno.com), with RELAY_TOKEN set on the project.
// The VM fetcher then uses:
//   https://<your-project>.deno.net/k/<RELAY_TOKEN>/s0/feed/2317/playlist.m3u8
// as its playlist URL; segment URIs in the playlist are relative, so
// they resolve against the relay automatically — no URL rewriting needed.

const TOKEN = Deno.env.get("RELAY_TOKEN");
const ORIGIN = "https://hls-o2.broadcastify.com";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

Deno.serve(async (req: Request): Promise<Response> => {
  if (!TOKEN) {
    return new Response("relay not configured", { status: 500 });
  }
  const PREFIX = `/k/${TOKEN}/`;
  const url = new URL(req.url);
  if (!url.pathname.startsWith(PREFIX)) {
    return new Response("not found", { status: 404 });
  }
  // Strip "/k/<token>" and keep the rest, e.g.
  // /s0/feed/2317/playlist.m3u8 or /s0/feed/2317/<session>/segment-N.ts
  const path = url.pathname.slice(PREFIX.length - 1);
  if (!path.startsWith("/s0/feed/2317/")) {
    return new Response("not found", { status: 404 });
  }
  const upstream = await fetch(ORIGIN + path + url.search, {
    headers: { "User-Agent": UA, "Accept": "*/*" },
  });
  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
});