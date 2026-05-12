# Bot de WhatsApp - Traslado de Materiales

1. Crea un archivo `.env` en este directorio.
2. Agrega las siguientes variables:
   ```env
   GROUP_ID=tu_id_de_grupo_aqui (el bot lo imprimirá en consola al recibir un mensaje)
   GOOGLE_APPS_SCRIPT_URL=tu_url_de_apps_script_aqui
   ```
3. Ejecuta `npm start` para iniciar el bot.
4. Escanea el código QR desde tu WhatsApp.
5. Asegúrate de que el bot sea **Administrador** del grupo para que pueda borrar los mensajes intermedios y mantener el grupo limpio.

Comandos:
- `!traslado`: Inicia el flujo de solicitud.
