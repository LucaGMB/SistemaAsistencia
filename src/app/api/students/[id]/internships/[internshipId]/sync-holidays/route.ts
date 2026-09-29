import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/apiAuth";
import { syncInternshipHolidays } from "@/lib/syncHolidays";

export async function POST(
  req: Request,
  { params }: { params: { id: string; internshipId: string } }
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const isStaff = session!.user.role === "PROFESOR" || session!.user.role === "ADMIN";
  if (!isStaff && session!.user.id !== params.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const internship = await prisma.internship.findUnique({
    where: { id: params.internshipId },
  });

  if (!internship || internship.studentId !== params.id) {
    return NextResponse.json({ error: "Pasantía no encontrada." }, { status: 404 });
  }

  const result = await syncInternshipHolidays(internship.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Error al sincronizar feriados." }, { status: 400 });
  }

  return NextResponse.json(result);
}
