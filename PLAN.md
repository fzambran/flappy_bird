# Juego de obstáculos controlado por el tono de voz

## Objetivo y alcance

Construir un prototipo jugable para navegador de PC con TypeScript, Vite y Canvas 2D. El pájaro avanzará entre obstáculos: un tono más agudo lo llevará hacia arriba y uno más grave hacia abajo. Durante el silencio mantendrá la última altura objetivo y los obstáculos seguirán avanzando.

La primera versión incluirá calibración, práctica libre, obstáculos, colisiones, puntuación y reinicio. Usará gráficos simples y originales. Quedan para después el acabado visual, móviles, música, cuentas y publicación.

**Criterio de éxito:** poder calibrar una voz y completar una partida de al menos un minuto, esquivando obstáculos mediante cambios de tono, sin controles manuales de altura ni saltos frecuentes provocados por errores de detección.

## Diseño del control y arquitectura

- **Entrada vocal:** comenzar con vocales sostenidas o tarareo. Detectar la frecuencia fundamental; el volumen servirá únicamente para distinguir señal y silencio. No se requiere reconocimiento de palabras.
- **Calibración:** medir dos segundos de ruido ambiente y luego al menos dos segundos de voz válida por tono grave/agudo. Cada tono empieza mediante un botón y una preparación de dos segundos, sin límite de espera ni de captura. Mostrar reconocimiento y progreso; no contar silencios. Usar muestras fiables y sus medianas. Si el rango es menor de cinco semitonos o faltan muestras, explicar el problema y permitir repetir.
- **Conversión a altura:** normalizar el tono en escala logarítmica entre los extremos calibrados. Mapear el grave al límite inferior y el agudo al superior, reservando márgenes para el tamaño del pájaro. Limitar los tonos fuera del rango a esos extremos.
- **Estabilidad:** aplicar una mediana de cinco lecturas válidas y una aproximación gradual a la altura objetivo, inicialmente con una constante de 120 ms. Descartar lecturas poco fiables; conservar el último objetivo durante silencio o señal inválida.
- **Juego:** mantener fija la posición horizontal del pájaro y desplazar los obstáculos hacia la izquierda. El control vertical será directo, sin gravedad ni impulsos.
- **Audio:** capturar el micrófono con `getUserMedia`, procesar mediante Web Audio y un `AudioWorklet`, y estimar el tono con YIN. Solicitar acceso desde un botón explícito. El acceso al micrófono requiere un contexto seguro; usar localhost en desarrollo y HTTPS si se publica. [Referencia de getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- **Separación técnica:** módulos de captura y detección, calibración y control, simulación y renderizado, y pantallas. La entrada al control será `{ frequencyHz, confidence, rms, timestamp }`; la salida será una altura normalizada entre 0 y 1. Esto permitirá probar el juego con señales sintéticas.
- **Estados:** inicio → calibración → práctica → partida → fin. Añadir pausa explícita y pausar al ocultar la pestaña o perder el dispositivo de audio. Procesar todo localmente, sin grabar ni enviar audio.

## Hoja de ruta con entregables verificables

| Hito | Trabajo concreto | Condición para avanzar |
|---|---|---|
| **1. Base del juego** | Configurar TypeScript y Vite; dibujar pájaro y escenario; implementar bucle independiente de la tasa de cuadros. Añadir un control de altura de desarrollo. | El movimiento mantiene la misma velocidad con distintas tasas de cuadros y puede pausarse y reiniciarse. |
| **2. Prueba del micrófono** | Capturar audio y mostrar tono en Hz, nivel y confianza, sin obstáculos. Gestionar permisos denegados y micrófono ausente. | Tres tonos cómodos y sostenidos producen lecturas diferenciadas y estables; el silencio no genera un tono válido. |
| **3. Calibración y vuelo** | Implementar calibración, mapeo logarítmico, filtrado y práctica libre con indicador de altura objetivo. | Se puede alcanzar y sostener una posición baja, media y alta durante dos segundos cada una; respirar no altera el objetivo. |
| **4. Partida completa** | Incorporar obstáculos, colisiones, puntuación, fin de partida y reinicio. | Cada obstáculo superado suma exactamente un punto; una colisión termina la partida; reiniciar limpia el estado y conserva la calibración. |
| **5. Ajuste y validación** | Ajustar sensibilidad y dificultad con partidas reales; corregir saltos, retrasos y errores de permisos. Documentar cómo ejecutar el proyecto. | Tres personas con registros vocales diferentes completan calibración y práctica; se cumple el criterio de éxito de un minuto. |

Primero se validará el control vocal en los hitos 2 y 3. El diseño de obstáculos dependerá de la velocidad de movimiento que resulte cómoda en esa prueba.

Como punto de partida, el primer obstáculo llegará después de cuatro segundos; habrá tres segundos entre obstáculos y una abertura equivalente al 40 % de la altura jugable. La variación entre centros consecutivos no superará el 20 % de esa altura. Estos valores serán constantes configurables y se ajustarán en el hito 5, sin añadir dificultad progresiva todavía.

## Pruebas y criterios de aceptación

- **Detección:** probar señales sintéticas de 100, 200 y 400 Hz, con un error máximo del 3 % en condiciones limpias; comprobar silencio, ruido y señales con armónicos.
- **Mapeo:** verificar extremos, punto medio logarítmico, límites fuera del rango y conservación del objetivo sin señal.
- **Respuesta:** con un tono sostenido, buscar oscilaciones menores al 3 % de la altura jugable y una respuesta perceptible en menos de 200 ms. Medirlas en el equipo de referencia; son metas de validación.
- **Juego:** comprobar colisiones, conteo único de puntos, pausa y reinicio. Usar secuencias reproducibles de obstáculos para depurar.
- **Uso real:** probar voz grave y aguda, cambios de volumen con tono constante, respiraciones y ruido ambiente moderado.
- **Fallos:** verificar permiso rechazado, dispositivo desconectado y pestaña oculta, con mensajes claros y recuperación mediante una acción del usuario.

## Supuestos y límites de la primera versión

- Se parte de una carpeta sin implementación existente.
- Chrome de escritorio será el navegador de referencia; otros navegadores se evaluarán después.
- Se utilizará un solo micrófono y una sola voz, en un entorno relativamente tranquilo.
- La calibración se conservará durante la sesión y podrá repetirse desde la pausa.
- No habrá música ni reproducción del micrófono durante el juego.
- La planificación avanzará por hitos aprobados, sin fijar fechas hasta conocer la disponibilidad de desarrollo.
