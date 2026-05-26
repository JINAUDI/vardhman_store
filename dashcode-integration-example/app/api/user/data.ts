export type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
  resetToken?: string | null;
  resetTokenExpiry?: string | null;
  profile?: unknown;
};

export const user: User[] = [];
