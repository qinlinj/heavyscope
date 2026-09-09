import {
  handleLiveProxyRequest,
  isLiveProxyProvider,
} from "../../../src/adapters/liveProxyForward";

export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const provider = parts[2] ?? "";
  if (!isLiveProxyProvider(provider)) {
    return new Response("Not found", { status: 404 });
  }
  const rest = `/${parts.slice(3).join("/")}`;
  return handleLiveProxyRequest(req, provider, rest);
}
