import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

// GitHub API requires a User-Agent header (https://developer.github.com/changes/2013-04-24-user-agent-required/)
// Patch fetch so requests to api.github.com include it (fixes "unable_to_get_user_info")
if (typeof globalThis.fetch === "function") {
  const origFetch = globalThis.fetch;
  globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url && url.startsWith("https://api.github.com")) {
      const headers = new Headers(init?.headers);
      if (!headers.has("User-Agent")) {
        headers.set("User-Agent", "ClipSync-Auth/1.0 (https://clipsync-auth.up.railway.app)");
      }
      init = { ...init, headers };
    }
    return origFetch.call(this, input, init);
  };
}

// Get DATABASE_URL from environment
const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // During build time, return a dummy URL (Next.js needs it for static analysis)
  // At runtime, Railway will provide the real DATABASE_URL
  if (process.env.NODE_ENV === 'production' && process.env.SKIP_ENV_VALIDATION) {
    return "postgresql://dummy:dummy@localhost:5432/dummy";
  }
  
  throw new Error(
    "DATABASE_URL is required but not set.\n" +
    "Make sure DATABASE_URL is set in your .env file or environment variables."
  );
};

let databaseUrl: string | null = null;
const getDatabaseUrlLazy = (): string => {
  if (!databaseUrl) {
    databaseUrl = getDatabaseUrl();
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = databaseUrl;
    }
  }
  return databaseUrl;
};

let prisma: PrismaClient | null = null;

const getPrisma = (): PrismaClient => {
  if (!prisma) {
    const dbUrl = getDatabaseUrlLazy();
    
    if (!process.env.DATABASE_URL && dbUrl) {
      process.env.DATABASE_URL = dbUrl;
    }
    
    // Use the connection URL directly (Railway Postgres handles SSL automatically)
    const connectionUrl = process.env.DATABASE_URL || dbUrl;
    
    console.log('Initializing Prisma Client...');
    console.log('Database host:', connectionUrl.replace(/:[^:@]+@/, ':****@').split('@')[1]?.split('/')[0] || 'unknown');
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      errorFormat: "pretty",
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
    });
    
    // Try to connect and log any errors
    prisma.$connect()
      .then(() => {
        console.log('Prisma Client connected successfully');
      })
      .catch((error) => {
        console.error("Prisma connection error:", error);
        console.error("Error code:", error.code);
        console.error("Connection URL host:", connectionUrl.replace(/:[^:@]+@/, ':****@').split('@')[1]?.split('/')[0] || 'unknown');
      });
  }
  return prisma;
};

// Get base URL for auth service
const getBaseURL = (): string => {
  return process.env.BETTER_AUTH_BASE_URL || 
         process.env.AUTH_SERVICE_URL || 
         "http://localhost:3001";
};


const getTrustedOrigins = (): string[] => {
  // Build comprehensive list of trusted origins
  // Include baseURL and common patterns
  // CORS headers allow ALL origins, but Better-auth needs specific origins listed
  const baseURL = getBaseURL();
  const origins: string[] = [];
  
  // Always include baseURL origin for internal calls
  if (baseURL) {
    try {
      const baseOrigin = new URL(baseURL).origin;
      origins.push(baseOrigin);
    } catch (e) {
      console.error("Invalid baseURL:", baseURL, e);
    }
  }
  
  // Add common localhost origins (both http and https)
  const commonOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://localhost:3000",
    "https://localhost:3001",
    "https://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
  ];
  
  origins.push(...commonOrigins);
  
  // Add origins from ALLOWED_ORIGINS if set
  const allowedOrigins = process.env.ALLOWED_ORIGINS || "";
  if (allowedOrigins) {
    const envOrigins = allowedOrigins
      .split(",")
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0 && !origins.includes(origin));
    origins.push(...envOrigins);
  }
  
  // Remove duplicates
  const uniqueOrigins = Array.from(new Set(origins));
  console.log("Trusted origins (CORS allows all, Better-auth trusts these):", uniqueOrigins);
  
  return uniqueOrigins;
};

export const auth = betterAuth({
  database: prismaAdapter(getPrisma(), {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET || "change-me-in-production",
  baseURL: getBaseURL(),
  basePath: "/api/auth",
  trustedOrigins: getTrustedOrigins(),
   emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      // read:user = profile (required for GET /user); user:email = email
      scope: ["read:user", "user:email"],
    },
  },
  // Handle OAuth errors and redirects properly
  onAPIError: {
    errorURL: (error: any, request: any) => {
      // Get the callbackURL from the request if available
      try {
        const url = new URL(request.url);
        const callbackURL = url.searchParams.get("callbackURL") || 
                           request.headers.get("referer") || 
                           "/";
        const errorURL = new URL(callbackURL);
        errorURL.searchParams.set("error", error.code || "oauth_error");
        errorURL.searchParams.set("error_description", error.message || "Authentication failed");
        return errorURL.toString();
      } catch {
        // Fallback to base URL if callbackURL parsing fails
        const baseURL = getBaseURL();
        const errorURL = new URL("/", baseURL);
        errorURL.searchParams.set("error", error.code || "oauth_error");
        errorURL.searchParams.set("error_description", error.message || "Authentication failed");
        return errorURL.toString();
      }
    },
  },
});
