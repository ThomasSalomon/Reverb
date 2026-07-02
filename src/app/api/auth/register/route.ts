import { NextResponse } from "next/server";
import { prisma } from "@/services/db";
import { signToken } from "@/utils/auth";
import { hashPassword } from "@/utils/crypto";
import { rateLimit, getIP } from "@/utils/rateLimit";

export async function POST(req: Request) {
  try {
    const ip = getIP(req);
    const { success } = rateLimit(ip, { windowMs: 60 * 60 * 1000, max: 10 }); // 10 registrations per hour
    
    if (!success) {
      return NextResponse.json({ error: "Demasiados registros desde esta IP. Intenta más tarde." }, { status: 429 });
    }

    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Todos los campos son obligatorios" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "El correo electrónico no tiene un formato válido" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "El usuario debe tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "El nombre de usuario o email ya está en uso" },
        { status: 400 }
      );
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
    });

    // Generate JWT token
    const token = await signToken({ userId: user.id, username: user.username });

    const response = NextResponse.json({
      message: "Registro exitoso",
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
