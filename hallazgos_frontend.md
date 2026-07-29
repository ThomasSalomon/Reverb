# Hallazgos de auditoría frontend

## Resumen ejecutivo

Ride The Music tiene una identidad visual sólida y reconocible: estética cyber-retro, portadas protagonistas, verde y violeta neón, tipografía display y recursos como tilt 3D, scanlines y recap.

Los principales problemas no provienen de una falta de diseño, sino de decisiones estructurales, responsive y de accesibilidad que interrumpen tareas centrales como identificar un álbum, calificarlo, publicar una reseña, iniciar sesión o navegar mediante teclado.

| Prioridad | Hallazgo | Impacto |
|---|---|---|
| P1 | En móvil, el álbum muestra portada, estadísticas y reproductor antes del título | El usuario recorre casi tres pantallas antes de identificar el álbum o poder calificarlo |
| P1 | La calificación por estrellas y los tags de reseña dependen del puntero | La acción central del producto no es operable por teclado ni se anuncia correctamente a lectores de pantalla |
| P1 | Login y registro no asocian programáticamente labels e inputs | Barrera de acceso y autocompletado deficiente |
| P1 | La mayoría de los modales no gestionan foco, Escape ni aislamiento del fondo | El usuario de teclado puede navegar detrás del modal |
| P1 | La búsqueda de inicio se mezcla con el feed social | Los resultados pierden jerarquía y la página se vuelve extremadamente larga en móvil |
| P2 | Las pestañas del perfil son estado local, no navegación | No admiten deep-link, refresh ni historial; las traducciones largas se deforman en móvil |
| P2 | La discografía de artista renderiza hasta 50 álbumes inicialmente | Alto coste de imágenes y navegación móvil excesivamente extensa |
| P2 | Los errores de Explore se presentan como resultados vacíos | El usuario no distingue entre falta de resultados y una falla de conexión |
| P2 | El color de texto muted tiene contraste insuficiente | Fechas, duraciones y metadata pequeña quedan por debajo de WCAG AA |
| P3 | Motion, breakpoints y componentes básicos se resuelven de forma fragmentada | Aumenta la deriva visual y el coste de futuras mejoras |

## Hallazgos detallados

### 1. Jerarquía rota en el detalle de álbum móvil

**Prioridad:** P1 — Alta

En escritorio, el detalle presenta una composición clara: portada a la izquierda y título, acciones y tracks a la derecha.

Al colapsar a una columna en móvil se conserva el orden del DOM:

1. Portada.
2. Estadísticas.
3. Reproductor de Deezer.
4. Título y contenido principal.

En la inspección a 360 × 800 px, el título aparecía aproximadamente en la posición vertical `y=1049`. El usuario debe atravesar varias pantallas antes de confirmar qué álbum está viendo o encontrar la acción de calificación.

**Evidencia en código:**

- `src/app/[locale]/albums/[id]/AlbumDetailClient.tsx`, secciones `leftCol` y `rightCol`.
- `src/app/[locale]/albums/[id]/page.module.css`, colapso del grid bajo 900 px.

**Recomendación:**

- En móvil, ordenar: título y artista → calificación/acción primaria → portada y estadísticas → tracks → reproductor externo.
- Mantener la composición lateral actual en escritorio.
- Evitar que un iframe externo anteceda la identidad y acción principal.

**Criterio de aceptación:**

En 360 × 800 px deben verse el título, el artista y el inicio de la acción primaria en el primer viewport. El reproductor nunca debe aparecer antes del título.

### 2. Calificaciones y reseñas no plenamente operables

**Prioridad:** P1 — Alta

El componente `RatingStars` utiliza un `div` con eventos de mouse y click. No ofrece foco, interacción por teclado, rol ni valor accesible.

Los tags de reseña también son `div` clickeables. La textarea depende del placeholder en lugar de tener una etiqueta programáticamente asociada.

Esto afecta directamente a la acción principal del producto: calificar música y publicar reseñas.

**Evidencia en código:**

- `src/components/RatingStars/RatingStars.tsx`.
- `src/components/ReviewForm/ReviewForm.tsx`.
- `src/components/SliderRating/SliderRating.tsx`.

**Recomendación:**

- Implementar las estrellas como radio group, botones segmentados o slider accesible.
- Soportar flechas, Home/End y una descripción como “3,5 de 5”.
- Representar tags como botones toggle o checkboxes con estado anunciado.
- Asociar label, error y ayuda con `aria-describedby`, `aria-invalid` y regiones vivas.

**Criterio de aceptación:**

Una reseña completa debe poder publicarse utilizando solamente el teclado. El valor de la calificación y los tags seleccionados deben ser comprensibles con lector de pantalla.

### 3. Formularios de acceso sin asociación programática

**Prioridad:** P1 — Alta

En login y registro, los labels no tienen `htmlFor` y los inputs no tienen `id` ni `name`. En el árbol accesible, el nombre termina dependiendo del placeholder.

**Evidencia en código:**

- `src/app/[locale]/login/page.tsx`.
- `src/app/[locale]/register/page.tsx`.

**Recomendación:**

- Añadir `id`, `name`, `htmlFor` y `autocomplete` apropiados.
- Enlazar errores con cada campo y anunciar fallos de envío.
- Aplicar el mismo patrón a edición de perfil, listas, diario y ajustes de cuenta.

**Criterio de aceptación:**

Cada input debe conservar un nombre accesible cuando desaparece el placeholder. Los gestores de contraseñas deben reconocer correctamente usuario, email y contraseña.

### 4. Modales sin un modelo común de foco

**Prioridad:** P1 — Alta

El modal de compartir declara `role="dialog"` y `aria-modal`, pero mantiene el foco en el botón disparador y permite alcanzar elementos del fondo.

Recap, ajustes de cuenta, edición de perfil, listas, diario, rating móvil, comentarios y confirmaciones destructivas no aplican de manera consistente:

- Semántica de dialog.
- Foco inicial.
- Contención de Tab.
- Cierre con Escape.
- Restauración del foco.
- Fondo inerte.
- Bloqueo del scroll.

**Evidencia en código:**

- `src/components/ShareModal/ShareModal.tsx`.
- `src/components/RecapModal/RecapModal.tsx`.
- `src/components/AccountSettingsModal/`.
- `src/components/EditFavoritesModal/`.
- `src/components/EditProfileModal/`.
- `src/components/AddToListModal/`.
- `src/components/MobileRatingSheet/`.
- `src/components/ReviewCard/ReviewCard.tsx`.

**Recomendación:**

Crear un comportamiento compartido mínimo para dialogs y bottom sheets:

- Título accesible.
- Foco inicial y restauración al cerrar.
- Contención de Tab.
- Escape para cerrar.
- Fondo `inert`.
- Bloqueo consistente del scroll.

**Criterio de aceptación:**

El foco nunca debe salir del modal mientras está abierto. Escape debe cerrarlo y devolver el foco exactamente al elemento que lo abrió.

### 5. La búsqueda principal compite con el feed

**Prioridad:** P1 — Media

La home reemplaza únicamente la sección musical cuando existe una consulta, pero sigue mostrando toda la actividad reciente.

Una búsqueda de “radiohead” produjo una página móvil de aproximadamente 5753 px. En escritorio, los resultados también quedan confinados a la columna musical en vez de utilizar el ancho disponible.

**Evidencia en código:**

- `src/app/[locale]/page.tsx`.

**Recomendación:**

- Crear un verdadero modo de búsqueda de ancho completo.
- Colapsar temporalmente el feed social.
- Incorporar una acción visible para limpiar la consulta.
- Llevar la query a la URL para compartir y recuperar resultados.
- En móvil, mostrar una pista visual de que las filas de álbumes se desplazan horizontalmente.

**Criterio de aceptación:**

Al buscar, los resultados y estados de búsqueda deben dominar la página. Refresh y back/forward deben preservar la consulta.

### 6. Navegación frágil en el perfil

**Prioridad:** P2 — Media

El perfil mantiene `activeTab` exclusivamente en memoria. No existe URL compartible para Reviews, Lists, Diary, Stats o Listen Later.

Las pestañas tampoco tienen semántica de tablist ni `aria-selected`. En 360 px, textos como “Metrics and statistics” y “Métricas e estatísticas” ocupan varias líneas y elevan excesivamente el control.

**Evidencia en código:**

- `src/app/[locale]/users/[username]/page.tsx`.
- `src/app/[locale]/users/[username]/page.module.css`.

**Recomendación:**

- Utilizar `?tab=stats` o rutas anidadas.
- Añadir semántica de tabs y navegación por flechas.
- Mantener etiquetas en una línea dentro de un contenedor horizontal.
- Mostrar una affordance clara de desplazamiento.
- Recordar la sección al volver desde un álbum o una lista.

### 7. Discografía excesivamente densa

**Prioridad:** P2 — Media

La página de artista mapea toda la respuesta de álbumes. En el artista inspeccionado se renderizaron 50 álbumes y 58 imágenes. En móvil, muchas tarjetas quedaron en una única columna cercana a 300 px, generando una página superior a 8700 px.

**Evidencia en código:**

- `src/app/[locale]/artists/[id]/ArtistDetailClient.tsx`.
- `src/app/[locale]/artists/[id]/page.tsx`.

**Recomendación:**

- Mostrar inicialmente entre 12 y 20 lanzamientos.
- Agrupar álbumes, singles y compilados.
- Añadir “cargar más”.
- Evaluar dos columnas compactas en móvil.
- Optimizar imágenes remotas con tamaños, `srcset` y fallback.

**Criterio de aceptación:**

La carga inicial no debe superar 20 lanzamientos. El usuario debe poder entender el tipo y orden de la discografía antes de solicitar más contenido.

### 8. Estados de error y feedback insuficientes

**Prioridad:** P2 — Media

Explore captura errores y solamente los escribe en consola. Después muestra el mismo estado que una búsqueda legítimamente vacía.

Los toasts:

- Desaparecen automáticamente a los cuatro segundos.
- No declaran `status` o `alert`.
- Tienen un botón de cierre sin nombre accesible.
- Se cierran al hacer click en cualquier parte del toast.

**Evidencia en código:**

- `src/app/[locale]/explore/ExploreTabs.tsx`.
- `src/components/Toast/ToastListener.tsx`.

**Recomendación:**

- Separar claramente loading, empty, error y stale-data.
- Añadir retry contextual.
- Anunciar success con `status` y error con `alert`.
- Etiquetar el cierre.
- Pausar el temporizador durante hover o foco.

### 9. Contraste insuficiente en metadata

**Prioridad:** P2 — Media

El token `--text-muted: #62627a` ofrece aproximadamente 3,38:1 contra el fondo `#08080a`, por debajo del mínimo 4,5:1 para texto normal.

Este color se utiliza en fechas, duraciones, contadores y metadata pequeña.

**Evidencia en código:**

- `src/app/globals.css`.

**Recomendación:**

Elevar el contraste del token muted hasta al menos 4,5:1. Mantener `--text-secondary` para información secundaria que deba conservar mayor presencia.

### 10. Reduced motion incompleto

**Prioridad:** P2 — Media

El CSS global contempla `prefers-reduced-motion`, pero no necesariamente detiene transformaciones aplicadas desde JavaScript o Framer Motion.

El tilt de `Cover3D`, por ejemplo, modifica estilos directamente durante el movimiento del puntero.

**Evidencia en código:**

- `src/app/globals.css`.
- `src/components/Cover3D/Cover3D.tsx`.
- `src/app/[locale]/artists/[id]/ArtistDetailClient.tsx`.

**Recomendación:**

Consultar reduced motion dentro de los componentes animados. Conviene preservar tilt, parallax y recap, pero convertirlos en mejoras opcionales.

### 11. Defecto puntual de localización

**Prioridad:** P2 — Baja

El recap traduce las etiquetas de interfaz, pero imprime `data.topTag` sin normalización. En inglés apareció el tag español “Enérgico”.

**Evidencia en código:**

- `src/components/RecapModal/RecapModal.tsx`.

**Recomendación:**

La API debería devolver una clave estable, como `energetic`, y la interfaz traducirla según el locale. Los tests deberían cubrir contenido categórico procedente de datos, además de las claves de mensajes.

### 12. Targets táctiles pequeños

**Prioridad:** P2 — Media

Acciones como like, comentarios, compartir, editar y eliminar presentan áreas interactivas cercanas a 24–34 px en algunas superficies.

**Recomendación:**

Mantener el icono visual actual, pero ampliar su área interactiva hasta al menos 44 × 44 px mediante padding o pseudo-elementos.

### 13. Fragmentación del sistema visual

**Prioridad:** P3 — Media

La base visual es coherente, pero existen:

- Colores raw repetidos.
- Estilos inline.
- Variantes similares de botones y formularios.
- Breakpoints en 480, 500, 600, 640, 768, 800, 900, 968 y 1024 px.
- Diferencias de comportamiento entre modales.
- Componentes cliente muy grandes.

El perfil supera las 1500 líneas y `ReviewCard` y `AlbumDetailClient` también concentran múltiples responsabilidades.

**Recomendación:**

Consolidar cinco primitivas:

1. `Button`.
2. `Field`.
3. `Dialog/Sheet`.
4. `Tabs`.
5. `AsyncState`.

También conviene incorporar tokens semánticos para danger, success, overlay y focus, y reducir la cantidad de breakpoints.

## Evaluación por superficie

| Superficie | Fortalezas | Principal oportunidad |
|---|---|---|
| Inicio | Hero reconocible, buscador protagonista y portadas con carácter | Separar búsqueda y feed; reducir longitud de la grilla desktop |
| Explore | Navegación simple y grillas claras | Persistir tab/query, mejorar errores y semántica |
| Álbum | Excelente presencia de portada en escritorio | Corregir orden móvil y elevar la calificación |
| Artista | Hero inmersivo y fuerte identidad musical | Paginar y agrupar discografía |
| Perfil | Color y contenido personalizado transmiten pertenencia | Convertir pestañas en navegación recuperable |
| Login/registro | Formularios visualmente simples y legibles | Accesibilidad, autocomplete y asociación de errores |
| Recap | Superficie distintiva y memorable | Dialog accesible y localización de tags |
| Modales | Lenguaje visual razonablemente coherente | Unificar comportamiento, jerarquía y foco |

## Sistema visual: elementos a preservar

- La combinación de fondo oscuro, verde eléctrico y violeta.
- Rajdhani para títulos y JetBrains Mono como firma del producto.
- Las portadas grandes y el tratamiento 3D.
- El hero de artistas.
- Scanlines y noise utilizados con moderación.
- El recap y el color temático de los perfiles.
- Bordes, radios y sombras cuando expresan capas reales.

No es recomendable extender el glassmorphism a todas las superficies. El blur tiene sentido en navegación flotante y overlays; en formularios y tarjetas de contenido puede reducir nitidez y añadir coste de render.

## Cinco correcciones prioritarias

1. Reordenar el detalle de álbum móvil para colocar identidad y calificación arriba.
2. Reconstruir estrellas, tags y editor de reseña como controles operables por teclado.
3. Corregir labels, autocomplete y errores de login y registro.
4. Introducir una base común y accesible para dialogs y bottom sheets.
5. Transformar la búsqueda de inicio en un estado de navegación independiente del feed.

## Roadmap sugerido

### Fase 1 — Flujo crítico y accesibilidad

- Álbum móvil.
- Rating y reseña.
- Login y registro.
- Modales y sheets.
- Pruebas de teclado y lector de pantalla sobre estos recorridos.

### Fase 2 — Navegación y estados

- Búsqueda con estado en URL.
- Perfil y Explore con tabs persistentes.
- Estados loading, empty, error y retry.
- Toasts accesibles.
- Corrección del tag localizado del recap.

### Fase 3 — Responsive y rendimiento

- Paginación de discografía.
- Optimización y fallback de imágenes.
- Validación sistemática en 360, 768, 1024 y 1440 px.
- Revisión de reduced motion.
- Medición Lighthouse y RUM antes y después.

### Fase 4 — Consolidación

- Extraer primitivas compartidas.
- Dividir el perfil y otros componentes cliente grandes.
- Unificar breakpoints, tokens y patrones de formularios.
- Añadir pruebas de regresión accesible y responsive.

## Riesgos actuales

- La función nuclear de calificar presenta una barrera severa de accesibilidad.
- La jerarquía móvil puede reducir la conversión hacia reseñas y ratings.
- La carga de imágenes y discografías escala mal con artistas prolíficos.
- Los componentes cliente grandes aumentan regresiones y dificultan la coherencia.
- Los errores presentados como estados vacíos pueden ocultar problemas reales de servicio.
- Los valores categóricos sin localizar pueden mezclar idiomas aunque las traducciones estén completas.

## Preguntas de producto

- ¿La acción primaria del detalle móvil debe ser calificar, escuchar o agregar a una lista?
- ¿La home pretende priorizar descubrimiento por búsqueda o actividad social?
- ¿La discografía debe ser exhaustiva o curada por relevancia y tipo de lanzamiento?
- ¿Las secciones de perfil deberían ser URLs compartibles?
- ¿Los tags son categorías canónicas traducibles o texto libre creado por usuarios?
- ¿WCAG 2.2 AA será un criterio formal de aceptación?

## Verificación realizada

- TypeScript: correcto.
- Tests: 10 de 10 tests existentes aprobados.
- Build de producción: correcto.
- Lint: correcto, con advertencias repetidas por imágenes sin optimización y dependencias de efectos.
- Inspección de producción y entorno local.
- Idiomas inspeccionados: español, inglés y portugués.
- Viewports inspeccionados: desktop 1440 × 900 y móvil 360 × 800.

El build reportó aproximadamente:

- Home: 163 kB de First Load JS.
- Artista: 156 kB.
- Perfil: 131 kB.
- Álbum: 127 kB.
- Explore: 112 kB.
- JavaScript compartido: 87,1 kB.

## Limitaciones de la auditoría

- La validación tablet se limitó a la revisión de breakpoints en código.
- No se ejecutaron mutaciones autenticadas sobre producción.
- No se probaron dispositivos físicos, VoiceOver, NVDA ni Safari.
- No se ejecutó una medición Lighthouse o RUM.
- La captura automática de screenshots no estuvo disponible; la evidencia visual se obtuvo mediante interacción, DOM y estilos computados.
- El contenido dinámico de catálogo difería entre local y producción, aunque no se detectaron divergencias relevantes de interfaz o código.

