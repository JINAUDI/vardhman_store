"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EditableProfile = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
  role: string;
  phone: string;
  jobTitle: string;
  location: string;
  bio: string;
};

type ProfileFormProps = {
  initialProfile: EditableProfile;
};

const FALLBACK_AVATAR = "/images/avatar/avatar-1.png";
const MAX_AVATAR_SIZE = 3 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const profileValue = (value: unknown, fallback = "") => String(value || fallback).trim();

const ProfileForm = ({ initialProfile }: ProfileFormProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(initialProfile.avatarUrl || FALLBACK_AVATAR);
  const [isSaving, setIsSaving] = useState(false);

  const updateField = (key: keyof EditableProfile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error("Use a JPG, PNG, or WebP image for the profile picture.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Profile picture must be 3MB or smaller.");
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullName = profile.fullName.trim();
    if (!fullName) {
      toast.error("Name is required.");
      return;
    }

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("full_name", fullName);
      formData.append("phone", profile.phone.trim());
      formData.append("job_title", profile.jobTitle.trim());
      formData.append("location", profile.location.trim());
      formData.append("bio", profile.bio.trim());
      formData.append("avatar_url", profile.avatarUrl.trim());

      if (avatarFile) {
        formData.append("avatar_file", avatarFile);
      }

      const response = await fetch("/api/admin/profile", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.profile) {
        throw new Error(result.error || "Unable to update profile.");
      }

      const nextProfile = result.profile;
      const nextAvatar = profileValue(nextProfile.image, profile.avatarUrl || FALLBACK_AVATAR);
      const nextState = {
        id: profileValue(nextProfile.id, profile.id),
        email: profileValue(nextProfile.email, profile.email),
        fullName: profileValue(nextProfile.name, profile.fullName),
        avatarUrl: nextAvatar,
        role: profileValue(nextProfile.role, profile.role),
        phone: profileValue(nextProfile.phone),
        jobTitle: profileValue(nextProfile.jobTitle),
        location: profileValue(nextProfile.location),
        bio: profileValue(nextProfile.bio),
      };

      setProfile(nextState);
      setAvatarPreview(nextAvatar || FALLBACK_AVATAR);
      setAvatarFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      window.dispatchEvent(new CustomEvent("dashcode:profile-updated", { detail: nextState }));
      toast.success("Profile updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update profile.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit Profile</CardTitle>
        <CardDescription>Change the name, profile picture, and admin details shown in Dashcode.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <img
              src={avatarPreview || FALLBACK_AVATAR}
              alt={profile.fullName || "Admin"}
              className="h-24 w-24 rounded-full object-cover ring-4 ring-default-100"
              onError={(event) => {
                event.currentTarget.src = FALLBACK_AVATAR;
              }}
            />
            <div className="flex-1 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="avatar_file">Profile picture</Label>
                <Input
                  ref={fileInputRef}
                  id="avatar_file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarChange}
                  disabled={isSaving}
                />
                <p className="text-xs text-default-400">JPG, PNG, or WebP. Maximum size 3MB.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatar_url">Profile picture URL</Label>
                <Input
                  id="avatar_url"
                  value={profile.avatarUrl}
                  onChange={(event) => {
                    updateField("avatarUrl", event.target.value);
                    if (!avatarFile) setAvatarPreview(event.target.value || FALLBACK_AVATAR);
                  }}
                  placeholder="https://..."
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Name</Label>
              <Input
                id="full_name"
                value={profile.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                disabled={isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={profile.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="job_title">Role title</Label>
              <Input
                id="job_title"
                value={profile.jobTitle}
                onChange={(event) => updateField("jobTitle", event.target.value)}
                placeholder="Store owner, Admin, Support lead"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Support or admin phone"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profile.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="City, State"
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bio">Details</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(event) => updateField("bio", event.target.value)}
                placeholder="Short admin profile note"
                className="min-h-[110px]"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-default-400">Saved changes update the active Dashcode admin profile.</p>
            <Button type="submit" color="primary" className="gap-2" disabled={isSaving}>
              {isSaving ? <Icon icon="heroicons:arrow-path" className="h-4 w-4 animate-spin" /> : <Icon icon="heroicons:check" className="h-4 w-4" />}
              {isSaving ? "Saving" : "Save Profile"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProfileForm;
