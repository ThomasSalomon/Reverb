# Guía de Despliegue de Reverb

Esta guía contiene los pasos necesarios para clonar, configurar e iniciar la aplicación **Reverb** en otra computadora desde cero.

---

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en el sistema:

1. **Node.js** (Versión 18.x o superior recomendada)
2. **npm** (Viene integrado con Node.js)
3. **Git** (Para clonar el repositorio)

---

## Pasos para la Instalación

### 1. Clonar el Repositorio
Clona el repositorio desde GitHub y accede a la carpeta del proyecto:
```bash
git clone https://github.com/ThomasSalomon/Reverb.git
cd Reverb
```

### 2. Instalar las Dependencias
Instala los paquetes de Node.js necesarios para el proyecto:
```bash
npm install
```

### 3. Configurar las Variables de Entorno
Copia el archivo de plantilla `.env.example` para crear tu archivo `.env` de configuración local:
* **En Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
* **En Linux/macOS o Bash:**
  ```bash
  cp .env.example .env
  ```

Abre el archivo `.env` creado y configura las siguientes variables según corresponda:
- `DATABASE_URL`: Ubicación de la base de datos (por defecto `file:./dev.db` para SQLite).
- `JWT_SECRET`: Llave de seguridad usada para firmar las sesiones. *Obligatorio cambiar en producción*.

### 4. Configurar y Preparar la Base de Datos
Esta aplicación utiliza Prisma como ORM junto con una base de datos local SQLite. Ejecuta los siguientes comandos para crear la base de datos local y sincronizar el esquema:

```bash
# Generar el cliente Prisma en tu máquina local
npx prisma generate

# Crear la base de datos SQLite (dev.db) y sincronizar el esquema de tablas
npx prisma db push
```

*(Opcional)* Si quieres pre-cargar datos de prueba (seed) en la base de datos si el proyecto cuenta con un script de semilla:
```bash
npx prisma db seed
```

---

## Ejecutar la Aplicación

### Modo Desarrollo
Para ejecutar la aplicación localmente con recarga en vivo (Hot Reload) y herramientas de depuración:
```bash
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### Modo Producción
Para desplegar la aplicación simulando un entorno productivo de alto rendimiento:

1. **Compilar el proyecto de Next.js:**
   ```bash
   npm run build
   ```
2. **Iniciar el servidor optimizado:**
   ```bash
   npm run start
   ```
La aplicación correrá de forma optimizada en [http://localhost:3000](http://localhost:3000).

---

## Solución de Problemas Comunes

* **Error de Prisma Client no inicializado:**
  Si al hacer una petición recibes un error relacionado con Prisma Client, asegúrate de haber ejecutado `npx prisma generate` antes de iniciar el servidor.
* **Error de sesión JWT en producción:**
  Si ejecutas el build en producción y olvidas definir un `JWT_SECRET` en el archivo `.env`, la aplicación se cerrará por seguridad. Asegúrate de configurar una cadena aleatoria larga en esa variable.
