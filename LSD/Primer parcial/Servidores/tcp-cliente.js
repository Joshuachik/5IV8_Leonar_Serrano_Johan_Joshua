const net = require('net'); //abri puetops y abris solicitudes 
const HOST = process.env.HOST || '127.0.0.1';
const PUERTO = process.env.PUERTO || 5000;  

const socket = new net.connect(PUERTO, HOST, () => { //creamos el socket para la comunicacion
    console.log(`[TCP] Conectado al HOST ${HOST}:${PUERTO}`);
    //jvamos a enviar un mensaje 
    ['UNO', 'Dos', 'Habia una vez', 'un', 'Patito,', 'que decia mia mia'].forEach((mensaje) => socket.write(`${mensaje}\n`));
    socket.end();
});

socket.on('data', (datos) => {
   process.stdout.write(`[TCP] ${datos.toString()}`);
});

socket.on('close', () => {
    console.log(`[TCP] Conexion cerrada con el Servidor`);
});

socket.on('error', (error) => {
    console.log(`[TCP] No se puede conectar, ${error.message}`);
});