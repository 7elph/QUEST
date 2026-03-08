import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADVENTURER" | "PATRON" | "ADMIN";
      adminScope?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE" | "OPS" | null;
      status: "ACTIVE" | "SUSPENDED" | "BANNED";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: "ADVENTURER" | "PATRON" | "ADMIN";
    adminScope?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE" | "OPS" | null;
    status: "ACTIVE" | "SUSPENDED" | "BANNED";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "ADVENTURER" | "PATRON" | "ADMIN";
    adminScope?: "SUPER_ADMIN" | "MODERATOR" | "FINANCE" | "OPS" | null;
    status?: "ACTIVE" | "SUSPENDED" | "BANNED";
  }
}
