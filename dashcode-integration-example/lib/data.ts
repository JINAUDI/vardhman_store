export type User = {
  id: string;
  name: string;
  email: string;
  image?: string;
};

export const getUserByEmail = (_email: string): User | undefined => undefined;
