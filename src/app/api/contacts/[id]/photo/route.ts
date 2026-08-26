import { apiBaseUrl, API_TIMEOUT_MS } from "@/lib/apiClient";

/**
 * Streams a contact's photo from the Contacts API.
 *
 * The list endpoint deliberately no longer inlines base64 images, so avatars
 * point here instead. Proxying rather than linking the backend directly keeps
 * `API_BASE_URL` server-only and avoids CORS, exactly like the rest of the data
 * access in this app.
 *
 * The upstream ETag is forwarded in both directions, so a repeat view costs a
 * 304 with no body.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const inbound = request.headers.get("if-none-match");

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl}/api/v1/contacts/${id}/photo`, {
      headers: inbound ? { "if-none-match": inbound } : undefined,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return new Response("Upstream unavailable", { status: 502 });
  }

  if (upstream.status === 304) {
    return new Response(null, { status: 304 });
  }
  if (!upstream.ok) {
    // 404 covers both "no such contact" and "no photo"; the avatar falls back
    // to initials either way.
    return new Response("Not found", { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const etag = upstream.headers.get("etag");
  if (contentType) headers.set("content-type", contentType);
  if (etag) headers.set("etag", etag);
  headers.set("cache-control", "private, max-age=0, must-revalidate");

  return new Response(upstream.body, { status: 200, headers });
}
