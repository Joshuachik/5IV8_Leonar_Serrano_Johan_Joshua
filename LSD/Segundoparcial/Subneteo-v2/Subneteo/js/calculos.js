/*
 * calculos.js
 * Funciones de subneteo IPv4. Aquí solo se hacen cuentas, nada de HTML.
 *
 * Idea principal: una IP son 32 bits, así que la guardamos como un número entero.
 * Con operadores de bits (&, |, ~, <<) sacamos red, broadcast y máscaras.
 * El ">>> 0" al final convierte el resultado a entero SIN signo (JavaScript
 * trabaja los bits con signo y sin esto salen números negativos).
 */

const Red = {
  // "192.168.1.10" -> 3232235786
  aNumero(ip) {
    const octetos = String(ip).trim().split('.');
    if (octetos.length !== 4) {
      throw new Error(`"${ip}" no es una IP: debe tener 4 octetos separados por punto`);
    }
    let numero = 0;
    for (const texto of octetos) {
      if (!/^\d{1,3}$/.test(texto) || Number(texto) > 255) {
        throw new Error(`El octeto "${texto}" no es válido (debe ir de 0 a 255)`);
      }
      numero = ((numero << 8) | Number(texto)) >>> 0;
    }
    return numero;
  },

  // 3232235786 -> "192.168.1.10"
  aTexto(numero) {
    return [
      (numero >>> 24) & 255,
      (numero >>> 16) & 255,
      (numero >>> 8) & 255,
      numero & 255,
    ].join('.');
  },

  // 192 -> "11000000"
  octetoBinario(octeto) {
    return octeto.toString(2).padStart(8, '0');
  },

  // "192.168.1.10" -> "11000000.10101000.00000001.00001010"
  ipBinario(ip) {
    return this.aTexto(this.aNumero(ip)).split('.').map((o) => this.octetoBinario(Number(o))).join('.');
  },

  // Método de restas: por cada peso (128, 64...) ¿cabe? -> 1 y se resta, si no -> 0
  metodoRestas(octeto) {
    let queda = octeto;
    return [128, 64, 32, 16, 8, 4, 2, 1].map((peso) => {
      const cabe = queda >= peso;
      if (cabe) queda -= peso;
      return { peso, bit: cabe ? 1 : 0, queda };
    });
  },

  // /24 -> número de la máscara (24 unos seguidos de 8 ceros)
  mascara(prefijo) {
    return prefijo === 0 ? 0 : (0xFFFFFFFF << (32 - prefijo)) >>> 0;
  },

  // Acepta "/26", "26" o "255.255.255.192" y regresa 26
  leerPrefijo(texto) {
    const limpio = String(texto).trim().replace('/', '');
    if (limpio.includes('.')) {
      const bits = this.ipBinario(limpio).replaceAll('.', '');
      if (!/^1*0*$/.test(bits)) throw new Error(`${limpio} no es una máscara válida: los unos deben ir juntos`);
      return bits.split('').filter((b) => b === '1').length;
    }
    const prefijo = Number(limpio);
    if (limpio === '' || !Number.isInteger(prefijo) || prefijo < 0 || prefijo > 32) {
      throw new Error(`/${limpio} no es un prefijo válido (debe ir de /0 a /32)`);
    }
    return prefijo;
  },

  // Hosts útiles = 2^(bits de host) - 2 (se quitan red y broadcast)
  hostsUtiles(prefijo) {
    if (prefijo >= 31) return prefijo === 31 ? 2 : 1;
    return 2 ** (32 - prefijo) - 2;
  },

  // Menor cantidad de bits de host que alcanza para "hosts" equipos
  bitsNecesarios(hosts) {
    if (!Number.isInteger(hosts) || hosts < 1) throw new Error(`"${hosts}" no es una cantidad de hosts válida`);
    let bits = 2;
    while (2 ** bits - 2 < hosts) bits++;
    return bits;
  },

  claseHistorica(ip) {
    const primero = this.aNumero(ip) >>> 24;
    if (primero < 128) return primero === 127 ? 'Loopback' : 'A';
    if (primero < 192) return 'B';
    if (primero < 224) return 'C';
    if (primero < 240) return 'D (multicast)';
    return 'E (experimental)';
  },

  esPrivada(ip) {
    const n = this.aNumero(ip);
    const dentroDe = (red, prefijo) => ((n & this.mascara(prefijo)) >>> 0) === this.aNumero(red);
    return dentroDe('10.0.0.0', 8) || dentroDe('172.16.0.0', 12) || dentroDe('192.168.0.0', 16);
  },

  // Toda la información de una subred a partir de su dirección de red
  datosSubred(red, prefijo, nombre = '') {
    const broadcast = (red | ~this.mascara(prefijo)) >>> 0;
    const usaHosts = prefijo <= 30;
    return {
      nombre,
      red: this.aTexto(red),
      prefijo,
      mascara: this.aTexto(this.mascara(prefijo)),
      primero: this.aTexto(usaHosts ? red + 1 : red),
      ultimo: this.aTexto(usaHosts ? broadcast - 1 : broadcast),
      broadcast: this.aTexto(broadcast),
      hosts: this.hostsUtiles(prefijo),
      bloque: 2 ** (32 - prefijo),
    };
  },

  // ¿A qué red pertenece? -> IP AND máscara
  redDeIp(ip, prefijo) {
    const red = (this.aNumero(ip) & this.mascara(prefijo)) >>> 0;
    return this.datosSubred(red, prefijo);
  },

  // Revisa que la IP sea dirección de red (todos los bits de host en 0)
  comprobarRed(ip, prefijo) {
    const n = this.aNumero(ip);
    const red = (n & this.mascara(prefijo)) >>> 0;
    if (n !== red) {
      throw new Error(`${ip} no es dirección de red para /${prefijo}. La correcta sería ${this.aTexto(red)}/${prefijo}`);
    }
    return red;
  },

  /*
   * FLSM: todas las subredes del mismo tamaño.
   * modo "subredes": se piden N subredes -> bits prestados = log2(N) redondeado hacia arriba
   * modo "hosts": se piden N hosts por subred -> se calculan los bits de host y lo demás se presta
   */
  flsm(ip, prefijo, modo, cantidad) {
    const base = this.comprobarRed(ip, prefijo);
    if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('La cantidad debe ser un número entero mayor que 0');

    const prestados = modo === 'hosts'
      ? 32 - prefijo - this.bitsNecesarios(cantidad)
      : Math.ceil(Math.log2(cantidad));
    const nuevo = prefijo + prestados;

    if (prestados < 0 || nuevo > 30) {
      throw new Error(`No se puede: haría falta un /${nuevo} y solo se vale de /${prefijo} a /30`);
    }

    const salto = 2 ** (32 - nuevo);
    const total = 2 ** prestados;
    const subredes = [];
    for (let i = 0; i < total; i++) {
      subredes.push(this.datosSubred(base + i * salto, nuevo, `Subred ${i + 1}`));
    }
    return { prestados, nuevo, total, salto, hosts: this.hostsUtiles(nuevo), subredes };
  },

  /*
   * VLSM: cada área recibe el bloque más pequeño que le alcanza.
   * 1. Se ordenan de más hosts a menos hosts.
   * 2. A cada una se le calcula su prefijo con bitsNecesarios.
   * 3. Se van acomodando una tras otra desde la red base.
   */
  vlsm(ip, prefijo, areas) {
    const base = this.comprobarRed(ip, prefijo);
    const limite = base + 2 ** (32 - prefijo);
    if (areas.length === 0) throw new Error('Agrega por lo menos un área');

    const ordenadas = [...areas].sort((a, b) => b.hosts - a.hosts);
    let actual = base;

    const subredes = ordenadas.map((area) => {
      const bits = this.bitsNecesarios(area.hosts);
      const nuevo = 32 - bits;
      const tamano = 2 ** bits;
      if (actual + tamano > limite) {
        throw new Error(`Ya no alcanza la red: "${area.nombre}" necesita un /${nuevo} (${tamano} direcciones) y no cabe`);
      }
      const subred = { ...this.datosSubred(actual, nuevo, area.nombre), pedidos: area.hosts };
      actual += tamano;
      return subred;
    });

    return {
      subredes,
      total: limite - base,
      usadas: actual - base,
      libres: limite - actual,
      siguienteLibre: actual < limite ? this.aTexto(actual) : 'ninguna',
    };
  },
};
