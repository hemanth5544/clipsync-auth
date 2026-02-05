import "./patch-github-fetch";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { sendWelcomeEmail } from "@/lib/email";
const getDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
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
    
    const connectionUrl = process.env.DATABASE_URL || dbUrl;
    
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      errorFormat: "pretty",
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
    });
    
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

const getBaseURL = (): string => {
  return process.env.BETTER_AUTH_BASE_URL || 
         process.env.AUTH_SERVICE_URL || 
         "http://localhost:3001";
};


const getTrustedOrigins = (): string[] => {

  const baseURL = getBaseURL();
  const origins: string[] = [];
  
  if (baseURL) {
    try {
      const baseOrigin = new URL(baseURL).origin;
      origins.push(baseOrigin);
    } catch (e) {
      console.error("Invalid baseURL:", baseURL, e);
    }
  }
  
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
    "http://192.168.0.107:3001", // auth base when testing from device
    "http://localhost:8081",
    "http://192.168.0.107:8081",
    "https://clipsync-auth.up.railway.app",
    "https://clipsync-production.up.railway.app",
    "https://clipsync.up.railway.app",
    "exp://.",
    "exp://192.168.0.107:8081",
    "exp://localhost:8081",
    "app://.",
    "app://localhost",
  ];
  
  origins.push(...commonOrigins);
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS || "";
  if (allowedOrigins) {
    const envOrigins = allowedOrigins
      .split(",")
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0 && !origins.includes(origin));
    origins.push(...envOrigins);
  }
  
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
    advanced: {
    useSecureCookies: true,
    cookies: {
      session_token: {
        attributes: {
          sameSite: "none",
          secure: true,
        },
      },
    },
  },
   emailAndPassword: {
    enabled: true,
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scope: ["read:user", "user:email"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail({ email: user.email, name: user.name });
        },
      },
    },
  },
  onAPIError: {
    errorURL: (error: any, request: any) => {
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
