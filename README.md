# Liga Panameña de Clubes Pro - Sistema de Clips en Tiempo Real

## 🚀 Descripción

Sistema completo para subir y visualizar clips de fútbol virtual en tiempo real. Los usuarios pueden subir videos, ver estadísticas actualizadas al instante y recibir notificaciones cuando otros usuarios suben contenido.

## ✨ Características

- **Subida real de videos** - Los usuarios pueden subir archivos MP4, AVI, MOV, etc.
- **Tiempo real** - Actualizaciones instantáneas usando WebSockets
- **Estadísticas dinámicas** - Clips totales, visualizaciones y likes se actualizan automáticamente
- **Categorización** - Clips organizados por tipo (goles, asistencias, atajadas, etc.)
- **Clubes de la liga** - Sistema completo con los 10 equipos reales de la LPCP
- **Responsive** - Funciona en móviles, tablets y escritorio

## 📋 Requisitos

- Node.js 14.0.0 o superior
- NPM (incluido con Node.js)

## 🛠️ Instalación

### 1. Instalar Node.js
Si no tienes Node.js instalado:
- Ve a [nodejs.org](https://nodejs.org/)
- Descarga la versión LTS
- Ejecuta el instalador

### 2. Instalar dependencias
Abre PowerShell en la carpeta del proyecto y ejecuta:

```bash
npm install
```

### 3. Iniciar el servidor
```bash
npm start
```

O para desarrollo con auto-reinicio:
```bash
npm run dev
```

## 🌐 Uso

1. **Abrir la página**: Ve a `http://localhost:3000`
2. **Subir clips**: Haz clic en "Subir Clip" y llena el formulario
3. **Ver en tiempo real**: Las estadísticas se actualizan automáticamente

## 🚀 Deployment (Subir a Internet)

### Opción 1: Heroku (Recomendado)
1. Crear cuenta en [heroku.com](https://heroku.com)
2. Instalar [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Ejecutar comandos:
```bash
heroku login
heroku create tu-app-lpcp
git add .
git commit -m "Deploy LPCP"
git push heroku main
```

### Opción 2: Railway
1. Crear cuenta en [railway.app](https://railway.app)
2. Conectar tu repositorio de GitHub
3. Deploy automático

### Opción 3: Render
1. Crear cuenta en [render.com](https://render.com)
2. Conectar GitHub y seleccionar tu repositorio
3. Configurar:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node

### Variables de Entorno (si es necesario)
- `PORT`: Puerto del servidor (automático en la mayoría de plataformas)
- `NODE_ENV`: production

## 📁 Estructura del Proyecto

```
lpcp-info-web/
├── server.js          # Servidor principal
├── package.json       # Dependencias
├── Procfile          # Configuración Heroku
├── index.html        # Página principal
├── clips.html        # Página de clips
├── standings.html    # Tabla de posiciones
├── styles.css        # Estilos
├── clips.js          # JavaScript de clips
├── standings.js      # JavaScript de posiciones
├── data/             # Datos JSON
└── uploads/          # Clips subidos
```
4. **Compartir**: Otros usuarios verán tus clips instantáneamente

## 📁 Estructura del Proyecto

```
lpcp-info-web/
├── server.js          # Servidor backend con Express y Socket.IO
├── package.json       # Dependencias y scripts
├── index.html         # Página principal
├── clips.html         # Página de clips
├── clips.js           # JavaScript del frontend con tiempo real
├── styles.css         # Estilos CSS
├── uploads/           # Carpeta para videos subidos (se crea automáticamente)
├── data/              # Carpeta para base de datos JSON (se crea automáticamente)
└── README.md          # Este archivo
```

## 🔧 Configuración para Producción

### Variables de Entorno
Puedes configurar el puerto usando:
```bash
PORT=8080 npm start
```

### Despliegue en Hosting
Para subir a un hosting como Heroku, Netlify, o DigitalOcean:

1. **Heroku**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   heroku create tu-app-lpcp
   git push heroku main
   ```

2. **Netlify** (para frontend):
   - Usa el comando `npm run build` si agregas un script de build
   - Sube la carpeta dist/build generada

3. **DigitalOcean/VPS**:
   - Sube los archivos al servidor
   - Instala Node.js en el servidor
   - Ejecuta `npm install` y `npm start`
   - Configura PM2 para mantener el servidor corriendo

## 📊 API Endpoints

- `GET /api/clips` - Obtener clips con paginación
- `POST /api/upload` - Subir nuevo clip
- `GET /api/stats` - Obtener estadísticas
- `POST /api/clips/:id/like` - Dar/quitar like
- `POST /api/clips/:id/view` - Incrementar vistas

## 🔄 WebSocket Events

- `newClip` - Nuevo clip subido
- `likeUpdate` - Actualización de likes
- `viewUpdate` - Actualización de vistas
- `statsUpdate` - Actualización de estadísticas

## 🎮 Equipos de la Liga

1. ACP 507
2. Coiner FC
3. FC WEST SIDE
4. Humacao Fc
5. Punta Coco Fc
6. Pura Vibra
7. Raven Law
8. Rayos X Fc
9. Tiki Taka Fc
10. fly city

## 🐛 Resolución de Problemas

### El servidor no inicia
- Verifica que Node.js esté instalado: `node --version`
- Instala las dependencias: `npm install`
- Verifica que el puerto 3000 esté libre

### Los clips no se suben
- Verifica que la carpeta `uploads` tenga permisos de escritura
- Revisa que el archivo sea un video válido (MP4, AVI, MOV, etc.)
- Verifica que el archivo no supere 100MB

### No hay actualizaciones en tiempo real
- Verifica que Socket.IO esté conectado (revisa la consola del navegador)
- Asegúrate de que no haya firewall bloqueando WebSockets

## 📞 Soporte

Para reportar problemas o solicitar nuevas características, contacta al equipo de desarrollo de LPCP.

## 📄 Licencia

MIT License - Libre para uso y modificación.
