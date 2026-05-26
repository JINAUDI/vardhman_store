import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const runtime = "nodejs";

const MAX_FILE_SIZE = 6 * 1024 * 1024;
const uploadDir = path.join(process.cwd(), "public", "uploads", "homepage-banners");
const allowedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { status: "fail", message: "Banner image file is required." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!allowedImageTypes[file.type]) {
      return NextResponse.json(
        { status: "fail", message: "Upload a JPG, PNG, WEBP, or GIF image." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { status: "fail", message: "Banner image must be 6 MB or smaller." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    await mkdir(uploadDir, { recursive: true });

    const extension = allowedImageTypes[file.type];
    const baseName = sanitizeFilename(file.name) || "homepage-banner";
    const filename = `${baseName}-${randomUUID()}.${extension}`;
    const filepath = path.join(uploadDir, filename);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(filepath, bytes);

    const relativeUrl = `/uploads/homepage-banners/${filename}`;
    const absoluteUrl = new URL(relativeUrl, request.nextUrl.origin).toString();

    return NextResponse.json(
      {
        status: "success",
        message: "Banner image uploaded successfully",
        data: {
          url: absoluteUrl,
          relativeUrl,
          filename,
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to upload banner image.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
