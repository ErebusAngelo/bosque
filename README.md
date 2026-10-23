# 🔥 El Bosque Ardiente (Obra Interactiva para LiDAR / Mouse)

Una instalación artística digital e interactiva diseñada para sensores **LiDAR** o interacción directa por mouse/pantalla táctil. La obra transiciona de un bosque frondoso y vivo (**Estado 1**) a un bosque consumido por las llamas (**Estado 2**). Al pasar la mano o el cursor, se genera una estela fluida e irregular de fuego con física de combustión orgánica y partículas incandescentes, revelando la capa inferior y sanando progresivamente con el tiempo.

---

## ✨ Características Principales

- **Shader GLSL de Fuego y Combustión Orgánica**:
  - Ruido fraccional Simplex y perturbación de dominio para generar llamas irregulares y fluidas.
  - Gradiente térmico hiperrealista: núcleo blanco incandescente (`#ffffff`), amarillo fuego (`#ffbb33`), naranja brasa (`#ff4500`) y bordes carbonizados con ceniza oscura.
  - Distorsión de calor (*heat shimmer*) animada con coordenadas de textura ondulantes.

- **Física de Quemado Fluida y Regeneración**:
  - Máscara de combustión dinámica de alta resolución (1376x768).
  - Efecto de propagación orgánica: los puntos de contacto inician pequeños y se expanden con inercia.
  - Sistema de regeneración sutil del bosque frondoso tras el paso del usuario.

- **Sistema de Partículas de Ascuas (Embers)**:
  - Hasta 1000 partículas GPU de chispas y cenizas ardientes que flotan con turbulencia hacia arriba al contacto.

- **Paisaje Sonoro Procedural (Web Audio API)**:
  - Rugido de fuego continuo basado en ruido rosa filtrado (Lowpass Biquad).
  - Crepitaciones aleatorias (*sparks & crackles*) reactivas a la velocidad de movimiento sin necesidad de archivos de audio externos.

- **Panel de Calibración en Vivo ('P')**:
  - Permite ajustar en tiempo real el radio de quemado, intensidad de llamas, ancho de borde, regeneración y densidad de chispas.

---

## 🎮 Controles y Atajos de Teclado

| Tecla / Acción | Función |
| :--- | :--- |
| **P** | Abre / oculta el panel de parámetros en vivo |
| **F** | Activa / desactiva pantalla completa (Modo Exhibición) |
| **H** | Oculta / muestra la barra de navegación superior |
| **R** | Reinicia la obra al estado inicial |
| **B** | Dispara quemado de demostración (*Burn Showcase*) |
| **D** | Modo Demo interactivo autónomo |
| **M** | Silencia / activa el sonido procedural de fuego |

---

## 🚀 Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/ErebusAngelo/bosque.git
   cd bosque
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

4. **Compilar para producción**:
   ```bash
   npm run build
   ```

---

## 🛠️ Tecnologías

- **Three.js** (WebGL 2.0 / Custom Shaders GLSL)
- **Vite**
- **Web Audio API**
- **JavaScript (ES Modules)** / CSS3 Vanilla
