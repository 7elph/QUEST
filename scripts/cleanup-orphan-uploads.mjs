import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseNumberFlag(flag, fallback) {
  const entry = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (!entry) return fallback;
  const value = Number(entry.split("=")[1]);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function resolveUploadPath(url) {
  if (!url.startsWith("/uploads/")) {
    return null;
  }

  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const target = path.normalize(path.join(process.cwd(), "public", url.replace(/^\/+/, "")));
  const uploadsRootNormalized = path.normalize(uploadsRoot).toLowerCase();
  const targetNormalized = target.toLowerCase();

  if (!targetNormalized.startsWith(`${uploadsRootNormalized}${path.sep}`)) {
    return null;
  }

  return target;
}

async function main() {
  const ttlHours = parseNumberFlag("--hours", Number(process.env.UPLOAD_ORPHAN_TTL_HOURS ?? 24));
  const batchSize = parseNumberFlag("--limit", Number(process.env.UPLOAD_ORPHAN_BATCH_SIZE ?? 300));
  const dryRun = process.argv.includes("--dry-run");
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);

  const assets = await prisma.uploadedAsset.findMany({
    where: {
      submissionId: null,
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      url: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  let deletedFiles = 0;
  let missingFiles = 0;
  let skippedUnsafe = 0;
  const idsToDelete = [];

  for (const asset of assets) {
    const filePath = resolveUploadPath(asset.url);
    if (!filePath) {
      skippedUnsafe += 1;
      continue;
    }

    try {
      await fs.unlink(filePath);
      deletedFiles += 1;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        missingFiles += 1;
      } else {
        continue;
      }
    }

    idsToDelete.push(asset.id);
  }

  if (!dryRun && idsToDelete.length > 0) {
    await prisma.uploadedAsset.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }

  const reclaimedBytes = assets
    .filter((asset) => idsToDelete.includes(asset.id))
    .reduce((sum, asset) => sum + asset.sizeBytes, 0);

  console.log(
    JSON.stringify(
      {
        dryRun,
        ttlHours,
        cutoff: cutoff.toISOString(),
        scanned: assets.length,
        deletedAssets: idsToDelete.length,
        deletedFiles,
        missingFiles,
        skippedUnsafe,
        reclaimedBytes,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("UPLOAD_CLEANUP_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
