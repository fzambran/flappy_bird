# Estado de validación

## Evidencia automatizada

- 18 pruebas automatizadas pasan: detector YIN a 100/200/400 Hz, armónicos, silencio/ruido, independencia del volumen, calibración, mapeo, mantenimiento del objetivo, mediana, suavizado independiente de FPS, primera llegada, puntuación única, colisión, reinicio, un minuto reproducible y velocidad independiente de FPS. La prueba de integración recorre un minuto de simulación con tonos cambiantes, armónicos y silencios, pasando por YIN y el control suavizado sin asignar manualmente la altura del pájaro.
- TypeScript y build Vite sin errores.
- Chrome headless con audio sintético, tanto en desarrollo como en el build de producción: calibración 100–200 Hz; lectura 141 Hz y nivel aproximado de −17.8 dBFS; práctica, partida, pausa, desconexión y mensaje ante permiso denegado. Eventos simulados de pista terminada y pestaña oculta verifican recuperación, conservación de calibración, colisión, reinicio y liberación de pistas. Un NotFoundError simulado verifica el mensaje de dispositivo ausente.
- Inspección visual de la página a 1280 px de ancho: canvas, telemetría y acciones visibles, sin superposiciones incorrectas.

## Criterios que requieren evidencia física

No verificados aún: tres personas con registros diferentes, alturas baja/media/alta sostenidas dos segundos, partida vocal de un minuto, latencia perceptible menor de 200 ms, oscilación menor del 3 %, respiraciones y ruido ambiente moderado, micrófono físico ausente/desconectado y cambio real de pestaña. El test sintético no demuestra estos criterios.

| Participante | Equipo / Chrome / micrófono | Rango Hz | Baja / media / alta 2 s | Partida ≥60 s | Saltos / oscilación | Latencia | Respiración / ruido |
|---|---|---|---|---|---|---|---|
| 1 | Pendiente | — | — | — | — | — | — |
| 2 | Pendiente | — | — | — | — | — | — |
| 3 | Pendiente | — | — | — | — | — | — |

Para medir respuesta, grabar externamente audio y pantalla de un cambio sostenido de tono y comparar el comienzo del tono con el primer movimiento visible; para oscilación, observar cinco segundos de tono sostenido y dividir el rango vertical por 540. No habilitar grabación de audio dentro del producto.

El hito 5 permanece pendiente. Ajustar dificultad y filtros según las pruebas reales antes de declarar terminado el proyecto.
