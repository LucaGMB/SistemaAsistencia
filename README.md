# Asistencia - Prácticas Profesionalizantes

Aplicación web de asistencia para la materia **Prácticas Profesionalizantes** del
E.T. N°3 D.E. 9° "María Sánchez de Thompson". Permite a los alumnos registrar su
propia asistencia (con conteo automático de horas en módulos de 30 minutos) y a
los profesores consultar el estado de todos los alumnos. Incluye un log de
auditoría de todas las acciones relevantes del sistema.

## Horarios y conteo de horas

| Día      | Horario       | Módulos (30min) | Horas acreditadas |
|----------|---------------|:---:|:---:|
| Martes   | 21:10 a 22:40 | 3 | 3hs |
| Jueves   | 18:00 a 19:30 | 3 | 3hs |
| Viernes  | 20:40 a 22:10 | 3 | 3hs |

- El botón para registrar asistencia se habilita recién cuando la clase del día
  ya comenzó, y se deshabilita cuando termina el horario de ese día.
- Un alumno no puede registrar asistencia de una clase que todavía no sucedió,
  ni ver habilitado el botón fuera del horario de clase.
- Solo se cuentan las horas registradas en el sistema.
- Cada 27hs acumuladas (9 clases) el alumno alcanza un hito y la app lo festeja
  con una animación de papelitos. No se muestra la meta total de la materia.

## Clases anuladas

Cuando una clase no se dicta (feriado, paro, suspensión), el profesor la anula
desde la pestaña **Anular clases**. Se pueden anular clases pasadas y futuras.

Las asistencias ya registradas en una fecha anulada **dejan de acreditar horas
pero no se borran**: quedan listadas como "Clase anulada" y, si la clase se
reactiva, vuelven a contar. Mientras una clase está anulada tampoco se puede
registrar ni cargar asistencia en esa fecha.

## Exportación de horas (CSV)

- **Alumno**: exporta su propio reporte, con dos columnas — `Fecha y hora`
  (fecha de la clase y su horario de inicio) y `Horas`.
- **Profesor**: exporta el reporte de un alumno concreto con esas mismas dos
  columnas, o el consolidado de todos los alumnos, que agrega `Alumno` y `DNI`
  al principio para poder distinguir a quién corresponde cada fila.

Las asistencias de clases anuladas no se exportan, porque no acreditan horas.
Los archivos usan punto y coma como separador y BOM UTF-8, que es lo que Excel
en español interpreta bien por defecto (Google Sheets abre ambos formatos).

## Contraseñas

Las cuentas se crean con el DNI como contraseña inicial. En el primer ingreso,
alumnos y profesores tienen que definir su propia contraseña: hasta que lo
hagan, un cartel bloquea la app. Ese cambio se puede hacer **una sola vez**,
así nadie queda con el DNI como clave y después nadie conoce la de los demás.

Si hace falta rehabilitar el cambio (por ejemplo, si alguien tocó la clave de
otro), al restablecer la contraseña de ese alumno el cartel le vuelve a
aparecer en el siguiente ingreso.

Tras 5 intentos fallidos seguidos, un DNI queda bloqueado 10 minutos. El
bloqueo se guarda en memoria del proceso, así que un reinicio del contenedor
lo limpia; si algún día la app corre en más de una instancia, esto hay que
mover a la base de datos.

## Roles

- **Alumno**: inicia sesión con DNI + contraseña, registra su propia
  asistencia, ve su calendario semanal (qué clases se vienen y cuáles están
  anuladas), su historial y total de horas, y exporta su reporte en CSV.
- **Profesor**: ve el listado de todos los alumnos con sus totales de horas e
  historial de asistencias, consulta la asistencia de una clase puntual (quién
  vino y quién no, con filtros), puede anular y reactivar clases, y puede
  exportar los reportes de horas. No puede modificar asistencias individuales.

## Correcciones y actualización de las pantallas

Las asistencias se pueden corregir sin límite hacia atrás en el tiempo: se
puede cargar, editar o borrar la asistencia de cualquier clase que ya haya
sucedido, sin importar hace cuánto. Lo único que no se admite son clases
futuras y fechas de clases anuladas (para esas hay que reactivar la clase
primero); en esos casos los botones de edición no aparecen.

Hay dos caminos para hacerlo:

- **Desde la clase** (pestaña *Por clase*): se elige la fecha y cada fila
  tiene un botón para acreditar o quitar las horas de ese alumno. Es el camino
  natural cuando falta cargar la asistencia de varios alumnos de una misma
  clase.
- **Desde el alumno** (*Alumnos* → *Ver detalle*): permite además elegir una
  cantidad de horas distinta a la del día completo y borrar filas puntuales
  del historial.

Cualquier corrección se refleja sola en las pantallas que estén abiertas, sin
recargar: se revisan los datos cada 30 segundos y al volver a la pestaña. Para
no gastar batería, no se consulta nada mientras la pestaña está en segundo
plano. Las pantallas del profesor muestran la hora de la última actualización
y un botón para forzarla. Las respuestas de la API van con `Cache-Control:
no-store` para que el navegador nunca sirva una copia vieja.

## Vista móvil

La app está pensada para usarse desde el celular: la barra superior acorta el
nombre del colegio, las tarjetas y formularios se apilan en una columna, el
calendario pasa de tres columnas a una, y las tablas de datos se desplazan
horizontalmente dentro de su contenedor en lugar de desbordar la página.

## Stack técnico

- Next.js 14 (App Router) + TypeScript, todo en un único proyecto
  (frontend + backend vía API routes).
- Base de datos SQLite embebida (vía Prisma ORM), persistida en un volumen
  Docker — no requiere un servidor de base de datos aparte.
- Autenticación con NextAuth (Credentials: DNI + contraseña, sesiones JWT).
- Tailwind CSS con la paleta de colores del logo del colegio.

## Desarrollo local

```bash
npm install
cp .env.example .env   # completar las variables requeridas
npx prisma migrate dev
npm run dev
```

## Consola de administración (CLI)

Para realizar acciones administrativas exclusivas que no están permitidas desde la interfaz web (como eliminar definitivamente a un alumno), se provee una consola interactiva / ejecutable:

```bash
# Modo ejecutable directo:
npm run cli delete <dni>

# Modo interactivo:
npm run cli
```

## Deploy con Dokploy

1. Subí este repositorio a tu proveedor de git (GitHub/GitLab/etc).
2. En Dokploy, creá una nueva aplicación de tipo "Docker Compose" (o
   "Dockerfile") apuntando a este repo.
3. Configurá las variables de entorno (ver `.env.example`):
   - `NEXTAUTH_SECRET`: generar con `openssl rand -base64 32`.
   - `NEXTAUTH_URL`: la URL pública final de la app (con https).
4. Asegurate de que el volumen `asistencia_data` (definido en
   `docker-compose.yml`, montado en `/app/data`) sea persistente entre
   despliegues — ahí vive el archivo SQLite con todos los datos.
5. Desplegá. Al iniciar, el contenedor aplica las migraciones de Prisma
   (`prisma migrate deploy`) antes de levantar el servidor Next.js.

## Notas de seguridad

- Las contraseñas se guardan hasheadas con bcrypt (cost 10), nunca en texto
  plano: la base solo contiene el hash y el proceso es irreversible.
- Cambiá `NEXTAUTH_SECRET` antes de dar la app por operativa en producción.
- Next.js se mantiene en la última versión parcheada de la rama 14.x
  (`14.2.35`) disponible al momento de este desarrollo. Revisá periódicamente
  si hay actualizaciones de seguridad (`npm audit`) y aplicalas.
