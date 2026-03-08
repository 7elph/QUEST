import { AdminScope, Role } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerAuthSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role as Role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function requireAdminScope(scopes: AdminScope[]) {
  const session = await requireRole([Role.ADMIN]);
  const scope = session.user.adminScope as AdminScope | null | undefined;
  // Backward compatibility: legacy admin users without scope keep full access.
  if (scope && !scopes.includes(scope) && scope !== AdminScope.SUPER_ADMIN) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
