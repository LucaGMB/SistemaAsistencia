import { describe, it, expect } from "vitest";
import { syncInternshipHolidays, syncClassHolidays } from "../src/lib/syncHolidays";
import { prisma } from "../src/lib/prisma";

describe("Holiday synchronization", () => {
  it("should sync class holidays for 2026", async () => {
    const result = await syncClassHolidays();
    expect(result.ok).toBe(true);
    expect(result.totalHolidaysFound).toBeGreaterThan(0);

    const cancelled = await prisma.cancelledClass.findMany();
    expect(cancelled.length).toBeGreaterThan(0);
  });

  it("should sync internship holidays upon creation", async () => {
    // Create a dummy student first
    const student = await prisma.user.create({
      data: {
        dni: "test_dni_999",
        nombre: "Test",
        apellido: "Student",
        passwordHash: "hash123",
        role: "ALUMNO",
      },
    });

    const internship = await prisma.internship.create({
      data: {
        studentId: student.id,
        company: "Test Company",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        weeklySchedule: JSON.stringify({ "1": 4, "2": 4, "3": 4, "4": 4, "5": 4 }),
      },
    });

    const syncResult = await syncInternshipHolidays(internship.id);
    expect(syncResult.ok).toBe(true);

    const exceptions = await prisma.internshipException.findMany({
      where: { internshipId: internship.id },
    });

    // September 2026 includes 2026-09-11 (Día del Maestro) and 2026-09-21 (Día del Estudiante)
    expect(exceptions.length).toBeGreaterThan(0);

    // Clean up
    await prisma.internshipException.deleteMany({ where: { internshipId: internship.id } });
    await prisma.internship.delete({ where: { id: internship.id } });
    await prisma.user.delete({ where: { id: student.id } });
  });
});
