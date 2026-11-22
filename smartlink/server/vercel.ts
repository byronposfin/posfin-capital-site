import { dispatch } from "./dispatch";

export const config = { maxDuration: 30 };

type NodeReq = {
  url?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator](): AsyncIterator<Buffer | string>;
};
type NodeRes = {
  statusCode: number;
  setHeader(name: string, value: string | number): void;
  end(body?: Buffer | string): void;
};

/** Vercel Node handler. Live traffic is rewritten from /api/forms/:form/:token onto this file. */
export default async function handler(req: NodeReq, res: NodeRes) {
  try {
    const host = header(req, "x-forwarded-host") || header(req, "host") || "localhost";
    const proto = header(req, "x-forwarded-proto") || "https";
    const url = new URL(req.url || "/", `${proto}://${host}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
      else headers.set(k, v);
    }
    let body: Buffer | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (chunks.length) body = Buffer.concat(chunks);
    }
    const request = new Request(url, { method: req.method, headers, body: body ? new Uint8Array(body) : undefined });
    const response = await dispatch(request);
    const buf = Buffer.from(await response.arrayBuffer());
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key === "transfer-encoding" || key === "content-length") return;
      res.setHeader(key, value);
    });
    res.setHeader("content-length", buf.length);
    res.end(buf);
  } catch (e) {
    console.error(`[smartlink] unhandled: ${(e as Error).message}`);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ error: "server error" }));
  }
}

function header(req: NodeReq, name: string) {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}
