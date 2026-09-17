import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGIN_BLOCKED"
  | "ATTENDANCE_SELF_CREATE"
  | "ATTENDANCE_ADMIN_CREATE"
  | "ATTENDANCE_ADMIN_UPDATE"
  | "ATTENDANCE_ADMIN_DELETE"
  | "CLASS_CANCELLED"
  | "CLASS_REACTIVATED"
  | "HOURS_EXPORTED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "PASSWORD_CHANGED_BY_USER"
  | "CLASS_CODE_GENERATED";

export async function logAudit(params: {
  actorId?: string | null;
  action: AuditAction;
  targetId?: string | null;
  details?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      targetId: params.targetId ?? null,
      details: params.details ?? null,
    },
  });
}
