// Script de diagnóstico simple para verificar el servidor
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🔍 Iniciando diagnóstico del servidor...');

// Middleware básico
app.use(express.json());
app.use(express.static('.'));

// Ruta de prueba
app.get('/test', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor de prueba corriendo en http://localhost:${PORT}`);
    console.log(`📍 Directorio: ${__dirname}`);
    console.log('🔗 Prueba: http://localhost:' + PORT + '/test');
}).on('error', (err) => {
    console.error('❌ Error al iniciar servidor:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.log('💡 El puerto 3000 ya está en uso. Intenta cerrar otros servidores o usar otro puerto.');
    }
});

// Manejo de errores
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada:', reason);
});
