import { NextResponse } from "next/server";


function getAllowedOrigins(): string[] {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || "";
  
  if (!allowedOriginsEnv) {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://127.0.0.1:3002",
    ];
  }

  return allowedOriginsEnv
    .split(",")
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
}

export function addCorsHeaders(response: NextResponse, origin?: string | null): NextResponse {
  // ALWAYS allow ALL origins - echo back the origin if provided
  // Note: We can't use * with credentials, so we echo back the origin
  // This allows requests from ANY origin (localhost:3000, etc.)
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  } else {
    // If no origin header (same-origin request), allow all
    response.headers.set("Access-Control-Allow-Origin", "*");
  }

  // Set all required CORS headers
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400");
  
  // Allow preflight caching
  response.headers.set("Vary", "Origin");

  return response;
}
