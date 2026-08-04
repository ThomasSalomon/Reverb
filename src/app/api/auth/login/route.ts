import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { signToken } from "@/utils/auth";
import { comparePassword } from "@/utils/crypto";
import { rateLimit, getIP } from "@/utils/rateLimit";
import { readJsonObject, rejectUnknownFields, RequestBodyError } from "@/utils/request-body";

export async function POST(req: Request) {
  try {
    const ip = getIP(req);
    const { success } = rateLimit(ip, { windowMs: 15 * 60 * 1000, max: 10 }); // 10 attempts per 15 minutes
    
    if (!success) {
      return NextResponse.json({ error: "Demasiados intentos de inicio de sesión. Por favor, intenta de nuevo más tarde." }, { status: 429 });
    }

    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["usernameOrEmail", "password"]);
    const { usernameOrEmail, password } = body;

    if (typeof usernameOrEmail !== "string" || typeof password !== "string" || !usernameOrEmail || !password) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    // Find user by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameOrEmail },
          { email: usernameOrEmail },
        ],
      },
    });

    if (!user) {
      // Perform a dummy comparison to neutralize temporal side-channel timing attacks
      const dummyHash = "$2b$10$abcdefghijklmnopqrstuvwxyzaaaaaaaaaaaaaaaaaaaaa";
      await comparePassword(password, dummyHash);
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 400 }
      );
    }

    // Compare passwords
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 400 }
      );
    }

    // Generate JWT token
    const token = await signToken({ userId: user.id, username: user.username });

    const response = NextResponse.json({
      message: "Inicio de sesión exitoso",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });

    // Set cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
