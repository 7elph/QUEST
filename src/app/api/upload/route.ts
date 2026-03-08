import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/rbac";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_USER_STORAGE_CAP_BYTES = 100 * 1024 * 1024;
type AllowedFileType = "image/png" | "image/jpeg" | "application/pdf" | "text/plain";

const fileTypeExtensionMap: Record<AllowedFileType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

function isLikelyText(buffer: Buffer) {
  if (buffer.length === 0) return false;
  let printable = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    // tab, lf, cr
    if (byte === 9 || byte === 10 || byte === 13) {
      printable += 1;
      continue;
    }
    if (byte >= 32 && byte <= 126) {
      printable += 1;
      continue;
    }
    if (byte === 0) {
      return false;
    }
  }
  return printable / buffer.length >= 0.9;
}

function detectFileType(buffer: Buffer): AllowedFileType | null {
  if (buffer.length >= 8) {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47];
    if (pngSignature.every((value, idx) => buffer[idx] === value)) {
      return "image/png";
    }
  }
  if (buffer.length >= 3) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
  }
  if (buffer.length >= 4) {
    const pdfSignature = [0x25, 0x50, 0x44, 0x46];
    if (pdfSignature.every((value, idx) => buffer[idx] === value)) {
      return "application/pdf";
    }
  }
  if (isLikelyText(buffer)) {
    return "text/plain";
  }
  return null;
}

function getUserStorageCapBytes() {
  const parsed = Number(process.env.UPLOAD_USER_MAX_BYTES ?? DEFAULT_USER_STORAGE_CAP_BYTES);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_USER_STORAGE_CAP_BYTES;
  }
  return Math.floor(parsed);
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const rate = await checkRateLimit(
      getClientKey(req, `upload:${session.user.id}`),
      30,
      10 * 60 * 1000,
    );
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas de upload. Tente mais tarde." }, { status: 429 });
    }

    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatorio." }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Arquivo excede 5MB." }, { status: 400 });
    }

    const userStorageCapBytes = getUserStorageCapBytes();
    const usage = await prisma.uploadedAsset.aggregate({
      where: { userId: session.user.id },
      _sum: { sizeBytes: true },
    });
    const currentUsageBytes = usage._sum.sizeBytes ?? 0;
    if (currentUsageBytes + file.size > userStorageCapBytes) {
      const maxMb = Math.floor(userStorageCapBytes / (1024 * 1024));
      return NextResponse.json(
        { error: `Limite de armazenamento excedido para o usuario (${maxMb}MB).` },
        { status: 413 },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const detectedType = detectFileType(buffer);
    if (!detectedType) {
      return NextResponse.json({ error: "Tipo de arquivo nao permitido." }, { status: 400 });
    }
    if (file.type && file.type !== detectedType) {
      return NextResponse.json({ error: "Tipo de arquivo inconsistente." }, { status: 400 });
    }

    const ext = fileTypeExtensionMap[detectedType];
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    const filePath = path.join(dir, fileName);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
    const url = `/uploads/${fileName}`;

    await prisma.uploadedAsset.create({
      data: {
        userId: session.user.id,
        url,
        fileName,
        mimeType: detectedType,
        sizeBytes: file.size,
      },
    });

    return NextResponse.json({ url, mimeType: detectedType }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    return NextResponse.json({ error: "Falha no upload." }, { status: 500 });
  }
}
