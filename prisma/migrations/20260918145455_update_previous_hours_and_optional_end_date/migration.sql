-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Internship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "roleOrTask" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "weeklySchedule" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Internship_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Internship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Internship" ("active", "company", "createdAt", "createdById", "endDate", "id", "note", "roleOrTask", "startDate", "studentId", "updatedAt", "weeklySchedule") SELECT "active", "company", "createdAt", "createdById", "endDate", "id", "note", "roleOrTask", "startDate", "studentId", "updatedAt", "weeklySchedule" FROM "Internship";
DROP TABLE "Internship";
ALTER TABLE "new_Internship" RENAME TO "Internship";
CREATE INDEX "Internship_studentId_idx" ON "Internship"("studentId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ALUMNO',
    "selfPasswordChangeUsed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "previousTeacherHours" INTEGER NOT NULL DEFAULT 0,
    "previousTeacherHoursLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("active", "apellido", "createdAt", "dni", "id", "nombre", "passwordHash", "role", "selfPasswordChangeUsed", "updatedAt") SELECT "active", "apellido", "createdAt", "dni", "id", "nombre", "passwordHash", "role", "selfPasswordChangeUsed", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
