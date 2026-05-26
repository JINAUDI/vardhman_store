import { NextResponse } from "next/server";
import { getSupabaseAdminSession } from "@/lib/supabase/admin-session";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const AVATAR_BUCKET = "admin-avatars";
const MAX_AVATAR_SIZE = 3 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type UploadedAvatar = File;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUploadedAvatar(value: FormDataEntryValue | null): value is UploadedAvatar {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number" &&
    typeof (value as File).type === "string"
  );
}

function extensionForFile(file: UploadedAvatar) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  if (byType[file.type]) return byType[file.type];

  const extension = file.name?.split(".").pop()?.toLowerCase();
  return extension && ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
}

async function ensureAvatarBucket(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { error } = await supabase.storage.getBucket(AVATAR_BUCKET);

  if (!error) return;

  const { error: createError } = await supabase.storage.createBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: MAX_AVATAR_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_AVATAR_TYPES),
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(createError.message);
  }
}

async function uploadAvatar(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string, file: UploadedAvatar) {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    throw new Error("Profile picture must be a JPG, PNG, or WebP image.");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Profile picture must be 3MB or smaller.");
  }

  await ensureAvatarBucket(supabase);

  const extension = extensionForFile(file);
  const filePath = `${userId}/profile-${Date.now()}.${extension}`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function POST(request: Request) {
  try {
    const session = await getSupabaseAdminSession();

    if (!session) {
      return NextResponse.json({ error: "You must be signed in as a Dashcode admin." }, { status: 401 });
    }

    const formData = await request.formData();
    const supabase = createSupabaseAdminClient();

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(session.id);

    if (userError || !userData.user) {
      return NextResponse.json({ error: userError?.message || "Unable to load the admin profile." }, { status: 404 });
    }

    const existingMetadata = userData.user.user_metadata || {};
    const fullName = formString(formData, "full_name") || String(existingMetadata.full_name || existingMetadata.name || session.name || "Admin").trim();
    const phone = formString(formData, "phone");
    const jobTitle = formString(formData, "job_title");
    const location = formString(formData, "location");
    const bio = formString(formData, "bio");
    let avatarUrl = formString(formData, "avatar_url") || String(existingMetadata.avatar_url || session.image || "").trim();

    const avatarEntry = formData.get("avatar_file");
    if (isUploadedAvatar(avatarEntry) && avatarEntry.size > 0) {
      avatarUrl = await uploadAvatar(supabase, session.id, avatarEntry);
    }

    const nextMetadata = {
      ...existingMetadata,
      full_name: fullName,
      name: fullName,
      phone,
      job_title: jobTitle,
      location,
      bio,
      avatar_url: avatarUrl,
    };

    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(session.id, {
      user_metadata: nextMetadata,
    });

    if (updateError || !updateData.user) {
      return NextResponse.json({ error: updateError?.message || "Unable to update the admin profile." }, { status: 400 });
    }

    return NextResponse.json({
      profile: {
        id: updateData.user.id,
        email: updateData.user.email,
        name: fullName,
        image: avatarUrl,
        phone,
        jobTitle,
        location,
        bio,
        role: session.role,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the admin profile.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

