const net = require('net'); //abri puetops y abris solicitudes 

const PUERTO = process.env.PUERTO || 5000;   //necesitamos un puerto de comunicacion
const servidor = net.createServer((socket) => {
    const cliente = `${socket.remoteAddress}:${socket.remotePort}`;
    // ele evento de cconexio se dispara emn el momento en el que el cliente y serviodr estavblece therre web a traves de taskweb el apreton de manos es el momneto en el que el cliente hace una peticion envia el datagrama y salusda a lservidor, el servidor le responde ecreando la sesion 
    console.log(`[TCP] Conexion Establecida con el Cliente ${cliente}`);

    socket.on('data', (datos) => {
        const crudo = datos.toString();
        //
        console.log(`[TCP ] Datos Recibidos asi crudisimos: ${datos.length} bytes ${JSON.stringify(crudo)}`);
        const lineas = crudo.split('\n').map((linea) => linea.trim()).filter(Boolean);

        lineas.forEach((Linea) => {
            console.log(`[TCP] Mensaje: ${Linea}`);
            socket.write(`Eco TCP: ${Linea}\n`);
        });
    });

    socket.on('close', () => {
        console.log(`[TCP] Conexion Cerrada con el Cliente ${cliente}`);
    });

    socket.on('error', (error) => {
        console.log(`[TCP] Error con ${cliente}: ${error.message}`);
    });
});

servidor.listen(PUERTO, () => {
    console.log(`[TCP] Servidor escuchando en el puerto ${PUERTO}`);
});
// aplucacion que se encarga de emiter respuesta a emisiones 
// este codigo nos permite hacer hilos para poder recivir y emitir la informacion de las peticiones que se hace en el servidor
//notas un hilo deb etener tiempo , tiene un tiempo de espera 
//el socket lo que hace es abrir y cerrar la conexion para compartir recursos

