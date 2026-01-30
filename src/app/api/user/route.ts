import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { addCorsHeaders } from "@/lib/cors";
import { auth } from "@/lib/auth";

const prisma = new PrismaClient();

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const response = new NextResponse(null, { status: 200 });
  return addCorsHeaders(response, origin);
}

type AuthSource = "session" | "jwt" | null;

async function getUserIdFromRequest(
  request: NextRequest
): Promise<{ userId: string | null; source: AuthSource }> {
  const headers = new Headers();
  request.headers.forEach((value, key) => headers.set(key, value));
  const session = await auth.api.getSession({ headers });
  if (session?.user?.id) return { userId: session.user.id, source: "session" };

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { userId: null, source: null };
  const token = authHeader.slice(7);
  const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
    const id = decoded.userId ?? null;
    return { userId: id, source: id ? "jwt" : null };
  } catch {
    return { userId: null, source: null };
  }
}

export async function GET(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    const { userId, source } = await getUserIdFromRequest(request);

    if (!userId) {
      const response = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      return addCorsHeaders(response, origin);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
    });

    if (!user) {
      // Stale session/JWT (e.g. user deleted, or token from different DB). Return 401 so client re-auths.
      console.warn("[api/user] User not in DB (stale auth?), userId:", userId, "source:", source);
      const response = NextResponse.json(
        { error: "Session invalid or expired", code: "SESSION_INVALID" },
        { status: 401 }
      );
      return addCorsHeaders(response, origin);
    }

    const response = NextResponse.json({
      id: user.id,
      email: user.email || "",
      name: user.name,
      image: user.image,
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error("Get user error:", error);
    const response = NextResponse.json({ error: "Failed to get user" }, { status: 500 });
    return addCorsHeaders(response, request.headers.get("origin"));
  }
}
