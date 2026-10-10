# Vuelo vocal

Prototipo para Chrome de escritorio. TypeScript, Vite, Canvas 2D y Web Audio; detección YIN en AudioWorklet. El audio se procesa localmente: no se graba, transmite ni reproduce.

## Ejecutar

Requiere Node.js 22.12+ y pnpm. Ejecuta `pnpm install` y `pnpm dev`; abre la dirección localhost que muestra Vite. Usa `pnpm test` para pruebas y `pnpm build` para compilar. La carpeta `dist` requiere HTTPS al desplegarse. No abras index.html directamente.

Usa pnpm 11.25.0 (`npm install --global pnpm@11.25.0`). Para revisar el build localmente ejecuta `pnpm preview`.

## Demo y código público

- [Jugar en GitHub Pages](https://fzambran.github.io/flappy_bird/).
- [Repositorio público](https://github.com/fzambran/flappy_bird).

GitHub Actions ejecuta tests y build antes de desplegar `dist` en Pages con HTTPS. El build usa rutas relativas para funcionar bajo la ruta del repositorio, incluido el AudioWorklet. En forks, habilita Settings → Pages → Source: GitHub Actions; actualiza el enlace de la demo con tu usuario y repositorio.

## Convertir a Expo y monetizar

Abre [expo.md](expo.md), copia **todo su contenido** y pégalo en el chat de tu IDE con IA, con este repositorio clonado y abierto. El archivo encarga la implementación nativa iOS/Android, captura PCM, builds Expo/EAS y anuncios AdMob, con pruebas y una checklist comercial. No requiere un IDE específico.

Este repositorio contiene el juego web y el prompt de conversión; todavía no contiene una app Expo. La guía distingue integración técnica de activación comercial: cada persona aporta sus propias cuentas, identificadores, política de privacidad y firma, y verifica dispositivos y revisión de tiendas.

El código y la guía se distribuyen bajo [licencia MIT](LICENSE), que permite modificación y uso comercial conservando el aviso de licencia.

## Jugar

1. Pulsa **Conectar micrófono** y concede el permiso.
2. Guarda silencio dos segundos, sostiene un tono grave cómodo tres segundos y uno agudo cómodo tres segundos. Necesitas al menos cinco semitonos de diferencia; no fuerces la voz.
3. Practica tarareando: grave baja, agudo sube. En silencio se conserva la altura objetivo. Cambiar volumen no controla la altura.
4. Comienza la partida. Superar un obstáculo suma un punto. Usa Pausar para descansar y Recalibrar para cambiar el rango.

Ocultar la pestaña pausa el juego. Si se pierde el micrófono, reconecta mediante el botón; la calibración anterior se conserva salvo que estuvieras calibrando. Desconectar libera el micrófono. La calibración solo vive durante la sesión.

`?debug=1` habilita un deslizador de altura exclusivamente con el servidor de desarrollo, para depurar simulación. No está disponible en el build de producción.

## Arquitectura y parámetros

- `src/audio`: captura y YIN; marcos de 2048 muestras, aproximadamente 40 lecturas/s, rango de detección 65–1000 Hz.
- `src/control.ts`: validación de calibración, normalización logarítmica, mediana de cinco muestras y suavizado de 120 ms. Confianza mínima 0.85; umbral RMS máximo entre 0.003 y tres veces la mediana del ruido ambiente.
- `src/game.ts`: simulación sin gravedad; ancho lógico 960 × 540, primera llegada a 4 s, obstáculos cada 3 s, hueco de 40 % y cambios de centro de hasta 20 %.
- `src/main.ts`: estados, pausa, pantallas y renderizado. Sin servidor ni servicios externos.

## Validación

Automatizada: tonos de 100/200/400 Hz y armónicos (error <3 %), ruido, silencio, amplitud, calibración, mapeo, mediana, suavizado, colisiones, puntuación, reinicio y simulación reproducible de un minuto. La prueba de integración de un minuto pasa por el detector, el filtrado y la simulación con cambios de tono y respiraciones sintéticas.

**Pendiente de validación real, no equivalente a los tests sintéticos:**

- Tres personas de registros diferentes calibran y sostienen alturas baja/media/alta durante dos segundos cada una.
- Jugar un minuto usando únicamente voz, sin saltos frecuentes ni fatiga vocal.
- Medir respuesta perceptible menor de 200 ms y oscilación menor del 3 % en el equipo de referencia. Registrar navegador, dispositivo, micrófono y resultados.
- Probar respiraciones, cambios de volumen a tono constante y ruido moderado.
- Probar rechazo de permisos, micrófono ausente/desconectado y cambio de pestaña en Chrome real.

No se considera completado el hito de ajuste con usuarios hasta registrar esas pruebas. Los valores iniciales de dificultad y filtros pueden ajustarse después de esta evidencia.

### Comprobación de navegador reproducible

Con Chrome instalado y el servidor local activo, ejecuta `pnpm test:browser`. Playwright abre Chrome en modo headless con un micrófono sintético: verifica carga del AudioWorklet, calibración 100–200 Hz, lectura de 141 Hz, nivel de señal en dBFS, práctica, inicio, pausa y desconexión. Eventos simulados de pérdida de pista y cambio de visibilidad verifican reconexión, conservación de calibración, colisión y reinicio; un error simulado verifica el micrófono ausente. También verifica permiso denegado en un contexto sin autorización. `GAME_URL` permite apuntar al servidor de preview de producción. No utiliza tu micrófono físico.
