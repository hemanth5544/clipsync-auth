import { NextResponse } from "next/server";

export const AUTH_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin, User-Agent",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
} as const;

export function corsPreflightResponse(origin: string | null): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Origin", origin || "*");
  Object.entries(AUTH_CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}


export function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {

  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*");
  }

  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin, User-Agent");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  
  response.headers.set("Vary", "Origin");

  return response;
}
