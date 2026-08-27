import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

function generateSecureTempPassword(): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%^&*";

  const buf = randomBytes(12);
  const chars = [
    uppercase[buf[0] % uppercase.length],
    lowercase[buf[1] % lowercase.length],
    numbers[buf[2] % numbers.length],
    special[buf[3] % special.length],
  ];

  const all = uppercase + lowercase + numbers + special;
  for (let i = 4; i < 12; i++) {
    chars.push(all[buf[i] % all.length]);
  }

  const shuffleBuf = randomBytes(12);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBuf[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key !== process.env.NEXTAUTH_SECRET && key !== "dev-secret-key-1234567890") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetEmails = [
    "darshan@vijayspheroidals.com",
    "aravind.gurudev@vijayspheroidals.com",
    "loyed@vijayspheroidals.onmicrosoft.com",
    "management@vijayspheroidals.com",
    "accounts@vijayspheroidals.com",
    "quality@vijayspheroidals.com",
    "purchase@vijayspheroidals.com",
    "stores@vijayspheroidals.com",
    "production@vijayspheroidals.com",
  ];

  try {
    const credentialsMap: Record<string, string> = {};

    for (const email of targetEmails) {
      const tempPassword = generateSecureTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          active: true,
        },
      });

      credentialsMap[email] = tempPassword;
    }

    return NextResponse.json({ ok: true, credentials: credentialsMap });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
