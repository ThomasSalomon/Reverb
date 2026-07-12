# 🎵 Ride The Music (MusicBox)

> Tu Diario de Escucha Personal. Una plataforma premium para calificar, reseñar y descubrir música, diseñada con una estética visual de primer nivel.

![Hero Image / Mockup](https://via.placeholder.com/1200x600?text=Ride+The+Music+Mockup)

**Ride The Music** (también conocida como MusicBox) es una aplicación web interactiva inspirada en plataformas como Letterboxd, pero dedicada exclusivamente al mundo de la música. Permite a los usuarios llevar un registro detallado de los álbumes y canciones que escuchan, con una interfaz de usuario inmersiva que destaca el arte visual de la música a través de efectos 3D fluidos.

---

## ✨ Features Destacadas

### 📖 Diario de Escucha
Registra múltiples reseñas para un mismo álbum a lo largo del tiempo. Convierte tu perfil en un verdadero diario de tu viaje musical, recordando exactamente qué sentiste al escuchar ese disco en diferentes momentos de tu vida.

### ⭐ Sistema de Calificación Híbrido
- **Para los Críticos:** Sistema detallado de 5 estrellas (con incrementos de medias estrellas).
- **Para los Casuales:** Un simple botón de "Corazón" (Me gusta) para guardar rápidamente tus favoritos.

### 🎨 UI Inmersiva con Efectos 3D
Hemos dejado de lado el diseño recargado de texto de otras plataformas. Nuestra interfaz **Poster-Grid** pone el arte de los álbumes en primera plana. Interactúa con las portadas mediante un efecto de inclinación 3D (tilt) ultra-fluido que responde al movimiento del cursor, construido para funcionar a más de 60 FPS sin comprometer el rendimiento.

---

## 📸 Galería

*(Nota: Reemplazar los enlaces de abajo con rutas a capturas reales de tu proyecto)*

| Feed de Actividad | Detalle de Álbum (Efecto 3D) | Perfil de Usuario |
| :---: | :---: | :---: |
| ![Feed](https://via.placeholder.com/400x300?text=Captura+del+Feed) | ![Detalle](https://via.placeholder.com/400x300?text=Captura+del+Album) | ![Perfil](https://via.placeholder.com/400x300?text=Captura+del+Perfil) |

---

## 🛠️ Tech Stack

Aunque el enfoque principal de la aplicación es brindar una experiencia visual inmersiva, cuenta con un backend robusto, modular y seguro.

- **Frontend:** Next.js 14 (App Router), React 18, CSS Modules, Framer Motion.
- **Backend:** Next.js API Routes.
- **Base de Datos & ORM:** SQLite + Prisma ORM (arquitectura diseñada para migrar fácilmente a PostgreSQL).
- **Autenticación:** JWT (JSON Web Tokens) almacenados en Cookies HttpOnly + BcryptJS.
- **Internacionalización:** next-intl.

---

## 🚀 Inicio Rápido (Desarrollo local)

Sigue estos pasos para levantar el proyecto en tu máquina local.

### 1. Clonar el repositorio
```bash
git clone https://github.com/ThomasSalomon/Reverb.git
cd Reverb
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Duplica el archivo `.env.example` y renómbralo a `.env`:
```bash
cp .env.example .env
```
*(Asegúrate de definir un `JWT_SECRET` en tu nuevo archivo `.env` para que funcione la autenticación)*

### 4. Preparar la Base de Datos
El proyecto utiliza Prisma con SQLite local (`dev.db`). Prepara la base de datos con:
```bash
npx prisma generate
npx prisma db push
```

### 5. Iniciar el servidor
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.

---

*Desarrollado por Thomas Salomon*
