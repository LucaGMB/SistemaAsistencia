import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; conceptId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const concept = await prisma.hourConcept.findUnique({
    where: { id: params.conceptId },
    include: { student: { select: { nombre: true, apellido: true } } },
  });

  if (!concept || concept.studentId !== params.id) {
    return NextResponse.json({ error: "Concepto no encontrado." }, { status: 404 });
  }

  const isStaff = session!.user.role === "PROFESOR" || session!.user.role === "ADMIN";
  if (!isStaff) {
    if (session!.user.id !== params.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (concept.createdById && concept.createdById !== session!.user.id) {
      return NextResponse.json(
        { error: "No podés eliminar un concepto cargado por el docente." },
        { status: 403 }
      );
    }
  }

  await prisma.hourConcept.delete({
    where: { id: params.conceptId },
  });

  await logAudit({
    actorId: session!.user.id,
    action: "HOUR_CONCEPT_DELETED",
    targetId: params.id,
    details: `${concept.category} "${concept.title}" (-${concept.hours}hs) de ${concept.student.apellido}, ${concept.student.nombre}`,
  });

  return NextResponse.json({ ok: true });
}
