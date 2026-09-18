const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnv();

const { PrismaClient } = require("@prisma/client");
const readline = require("readline");

const prisma = new PrismaClient();

async function deleteStudentByDni(dniInput) {
  const dni = String(dniInput || "").trim();
  if (!dni) {
    console.log("Error: Debes especificar un DNI. Uso: delete <dni>");
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { dni } });

    if (!user) {
      console.log(`Error: No se encontró ningún usuario con el DNI ${dni}.`);
      return;
    }

    if (user.role !== "ALUMNO") {
      console.log(
        `Error: El usuario con DNI ${dni} (${user.apellido}, ${user.nombre}) es ${user.role}. Solo se pueden eliminar alumnos.`
      );
      return;
    }

    await prisma.user.delete({
      where: { id: user.id },
    });

    await prisma.auditLog.create({
      data: {
        action: "USER_DELETED",
        details: `Alumno ${user.apellido}, ${user.nombre} (DNI ${dni}) eliminado desde CLI`,
      },
    });

    console.log(
      `✓ Alumno ${user.apellido}, ${user.nombre} (DNI: ${dni}) fue eliminado correctamente.`
    );
  } catch (err) {
    console.error("Error al intentar eliminar el alumno:", err.message || err);
  }
}

function showHelp() {
  console.log("\nComandos disponibles en la consola:");
  console.log("  delete <dni>   Borra al alumno con el DNI especificado.");
  console.log("  help           Muestra esta ayuda.");
  console.log("  exit / quit    Sale de la consola.\n");
}

async function handleCommand(input) {
  const line = input.trim();
  if (!line) return true;

  const parts = line.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  if (command === "delete") {
    await deleteStudentByDni(args[0]);
  } else if (command === "help") {
    showHelp();
  } else if (command === "exit" || command === "quit") {
    return false;
  } else {
    console.log(`Comando desconocido: "${command}". Escribe "help" para ver los comandos disponibles.`);
  }

  return true;
}

async function startInteractive() {
  console.log("=== Consola de Administración (Asistencia CLI) ===");
  console.log('Escribe "help" para ver la lista de comandos disponibles, o "exit" para salir.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "asistencia-cli> ",
  });

  rl.prompt();

  rl.on("line", async (line) => {
    const shouldContinue = await handleCommand(line);
    if (!shouldContinue) {
      rl.close();
      return;
    }
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("Saliendo de la consola.");
    prisma.$disconnect().then(() => process.exit(0));
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length > 0) {
    const command = args[0].toLowerCase();
    if (command === "delete") {
      await deleteStudentByDni(args[1]);
    } else if (command === "help") {
      showHelp();
    } else {
      console.log(`Comando desconocido: "${command}". Uso: delete <dni>`);
    }
    await prisma.$disconnect();
  } else {
    await startInteractive();
  }
}

main().catch((err) => {
  console.error("Error fatal en CLI:", err);
  prisma.$disconnect().then(() => process.exit(1));
});
