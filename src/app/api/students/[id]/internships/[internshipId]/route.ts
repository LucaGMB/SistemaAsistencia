import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";
import { calculateInternshipHours } from "@/lib/hours";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; internshipId: string } }
) {
  const { session, error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

  const internship = await prisma.internship.findUnique({
    where: { id: params.internshipId },
    include: { student: { select: { nombre: true, apellido: true } } },
  });

  if (!internship || internship.studentId !== params.id) {
    return NextResponse.json({ error: "Pasantía no encontrada." }, { status: 404 });
  }

  await prisma.internship.delete({
    where: { id: params.internshipId },
  });

  await logAudit({
    actorId: session!.user.id,
    action: "INTERNSHIP_DELETED",
    targetId: params.id,
    details: `Pasantía ${internship.company} de ${internship.student.apellido}, ${internship.student.nombre}`,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; internshipId: string } }
) {
  const { session, error } = await requireSession(["PROFESOR", "ADMIN"]);
  if (error) return error;

  const internship = await prisma.internship.findUnique({
    where: { id: params.internshipId },
    include: { exceptions: true },
  });

  if (!internship || internship.studentId !== params.id) {
    return NextResponse.json({ error: "Pasantía no encontrada." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const active = typeof body?.active === "boolean" ? body.active : undefined;

  const updated = await prisma.internship.update({
    where: { id: params.internshipId },
    data: {
      ...(active !== undefined ? { active } : {}),
    },
    include: { exceptions: true },
  });

  return NextResponse.json({
    internship: {
      ...updated,
      calculation: calculateInternshipHours(updated),
    },
  });
}
