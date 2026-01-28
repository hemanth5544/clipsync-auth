import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

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
    
    // Use the connection URL directly (should include SSL params for Neon)
    const connectionUrl = process.env.DATABASE_URL || dbUrl;
    
    // For Neon and other cloud databases, ensure SSL is enabled
    // Neon connection strings usually include ?sslmode=require
    // If not present, add it
    let finalUrl = connectionUrl;
    if (connectionUrl.includes('neon.tech') || connectionUrl.includes('neon.tech')) {
      if (!connectionUrl.includes('sslmode=')) {
        finalUrl = connectionUrl.includes('?') 
          ? `${connectionUrl}&sslmode=require`
          : `${connectionUrl}?sslmode=require`;
      }
    }
    
    console.log('Initializing Prisma Client...');
    console.log('Database host:', finalUrl.replace(/:[^:@]+@/, ':****@').split('@')[1]?.split('/')[0] || 'unknown');
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
      errorFormat: "pretty",
      datasources: {
        db: {
          url: finalUrl,
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
        console.error("Connection URL host:", finalUrl.replace(/:[^:@]+@/, ':****@').split('@')[1]?.split('/')[0] || 'unknown');
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
  const allowedOrigins = process.env.ALLOWED_ORIGINS || "";
  if (allowedOrigins) {
    const origins = allowedOrigins
      .split(",")
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
    if (origins.length > 0) {
      return origins;
    }
  }
  // Default: list common localhost origins explicitly
  // Avoid using "*" wildcard as it may cause "i.includes is not a function" error
  // Better-auth will also trust the baseURL automatically
  const baseURL = getBaseURL();
  const baseOrigin = baseURL ? new URL(baseURL).origin : "";
  
  const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
  ];
  
  // Add baseURL origin if it's different
  if (baseOrigin && !defaultOrigins.includes(baseOrigin)) {
    defaultOrigins.push(baseOrigin);
  }
  
  return defaultOrigins;
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
      // GitHub scope - user:email is required for email access
      scope: ["user:email"],
    },
  },
  // Handle OAuth errors and redirects properly
  onAPIError: {
    errorURL: (error: any, request:   any) => {
      // Get the callbackURL from the request if available
      const url = new URL(request.url);
      const callbackURL = url.searchParams.get("callbackURL") || 
                         request.headers.get("referer") || 
                         "/";
      const errorURL = new URL(callbackURL);
      errorURL.searchParams.set("error", error.code || "oauth_error");
      errorURL.searchParams.set("error_description", error.message || "Authentication failed");
      return errorURL.toString();
    },
  },
});
