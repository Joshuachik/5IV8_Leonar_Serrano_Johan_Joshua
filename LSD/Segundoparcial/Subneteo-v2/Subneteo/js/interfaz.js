/*
 * interfaz.js
 * Lee lo que escribe el usuario, llama a las funciones de calculos.js
 * y dibuja los resultados en la página.
 */

const $ = (selector) => document.querySelector(selector);
const miles = (n) => n.toLocaleString('es-MX');

// Evita que un texto escrito por el usuario se interprete como HTML
function seguro(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function error(contenedor, e) {
  contenedor.innerHTML = `<p class="aviso">${seguro(e.message)}</p>`;
}

// Pinta los bits de red de un color y los de host de otro
function bitsColor(ip, prefijo) {
  const bits = Red.ipBinario(ip).replaceAll('.', '');
  let html = '';
  for (let i = 0; i < 32; i++) {
    if (i > 0 && i % 8 === 0) html += '<span class="punto">.</span>';
    html += `<span class="${i < prefijo ? 'b-red' : 'b-host'}">${bits[i]}</span>`;
  }
  return html;
}

function cuadros(lista) {
  return `<div class="cuadros">${lista.map(([titulo, valor]) => `
    <div class="cuadro"><span>${titulo}</span><strong>${valor}</strong></div>`).join('')}</div>`;
}

function infoBase(ip, prefijo) {
  return `
    <article class="caja">
      <h3>Red base ${seguro(ip)}/${prefijo}</h3>
      ${cuadros([
        ['Clase', Red.claseHistorica(ip)],
        ['Tipo', Red.esPrivada(ip) ? 'Privada' : 'Pública'],
        ['Máscara', Red.aTexto(Red.mascara(prefijo))],
        ['Direcciones', miles(2 ** (32 - prefijo))],
      ])}
      <div class="binarios">
        <div><span class="etq">IP</span><code>${bitsColor(ip, prefijo)}</code></div>
        <div><span class="etq">Máscara</span><code>${bitsColor(Red.aTexto(Red.mascara(prefijo)), prefijo)}</code></div>
      </div>
      <p class="nota"><span class="b-red">■</span> bits de red &nbsp; <span class="b-host">■</span> bits de host</p>
    </article>`;
}

function tabla(subredes, conPedidos) {
  return `
    <article class="caja">
      <div class="desliza">
        <table>
          <thead><tr>
            <th>Nombre</th>${conPedidos ? '<th>Pedidos</th>' : ''}<th>Red</th><th>Máscara</th>
            <th>Primer host</th><th>Último host</th><th>Broadcast</th><th>Útiles</th>
          </tr></thead>
          <tbody>${subredes.map((s) => `
            <tr>
              <td>${seguro(s.nombre)}</td>${conPedidos ? `<td>${miles(s.pedidos)}</td>` : ''}
              <td class="mono">${s.red}/${s.prefijo}</td><td class="mono">${s.mascara}</td>
              <td class="mono">${s.primero}</td><td class="mono">${s.ultimo}</td>
              <td class="mono">${s.broadcast}</td><td>${miles(s.hosts)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </article>`;
}

/* ---------- Menú de secciones ---------- */

function mostrar(id) {
  document.querySelectorAll('.menu button').forEach((b) => b.classList.toggle('activo', b.dataset.ir === id));
  document.querySelectorAll('.seccion').forEach((s) => (s.hidden = s.id !== id));
}

document.querySelectorAll('.menu button').forEach((boton) => {
  boton.addEventListener('click', () => mostrar(boton.dataset.ir));
});

/* ---------- 1. Decimal a binario ---------- */

$('#f-binario').addEventListener('submit', (e) => {
  e.preventDefault();
  const salida = $('#r-binario');
  try {
    const valor = $('#binario-valor').value.trim();
    let octetos;
    if (valor.includes('.')) {
      octetos = Red.aTexto(Red.aNumero(valor)).split('.').map(Number);
    } else {
      const n = Number(valor);
      if (valor === '' || !Number.isInteger(n) || n < 0 || n > 255) throw new Error('Escribe un número de 0 a 255 o una IP completa');
      octetos = [n];
    }
    salida.innerHTML = `<div class="rejilla">${octetos.map((o) => {
      const pasos = Red.metodoRestas(o);
      return `
        <article class="caja">
          <h3>${o} <span class="flecha">→</span> <code>${Red.octetoBinario(o)}</code></h3>
          <table class="restas">
            <tr><th>Peso</th>${pasos.map((p) => `<td>${p.peso}</td>`).join('')}</tr>
            <tr><th>Bit</th>${pasos.map((p) => `<td class="${p.bit ? 'uno' : ''}">${p.bit}</td>`).join('')}</tr>
            <tr><th>Queda</th>${pasos.map((p) => `<td>${p.queda}</td>`).join('')}</tr>
          </table>
        </article>`;
    }).join('')}</div>
    <p class="nota">Si lo que queda alcanza para el peso, se pone 1 y se resta; si no, se pone 0.</p>`;
  } catch (err) {
    error(salida, err);
  }
});

/* ---------- 2. FLSM ---------- */

$('#f-flsm').addEventListener('submit', (e) => {
  e.preventDefault();
  const salida = $('#r-flsm');
  try {
    const ip = $('#flsm-ip').value.trim();
    const prefijo = Red.leerPrefijo($('#flsm-prefijo').value);
    const modo = $('#flsm-modo').value;
    const r = Red.flsm(ip, prefijo, modo, Number($('#flsm-cantidad').value));
    salida.innerHTML = infoBase(ip, prefijo) + `
      <article class="caja">
        <h3>Resultado FLSM</h3>
        ${cuadros([
          ['Bits prestados', `${r.prestados} → 2^${r.prestados} = ${miles(r.total)} subredes`],
          ['Nuevo prefijo', `/${r.nuevo} (${Red.aTexto(Red.mascara(r.nuevo))})`],
          ['Hosts por subred', `2^${32 - r.nuevo} − 2 = ${miles(r.hosts)}`],
          ['Salto', `${miles(r.salto)} direcciones`],
        ])}
      </article>` + tabla(r.subredes, false);
  } catch (err) {
    error(salida, err);
  }
});

/* ---------- 3. VLSM ---------- */

function nuevaArea(nombre = '', hosts = '') {
  const fila = document.createElement('div');
  fila.className = 'area';
  fila.innerHTML = `
    <input type="text" class="area-nombre" placeholder="Nombre del área" value="${seguro(nombre)}">
    <input type="number" class="area-hosts" min="1" placeholder="Hosts" value="${hosts}">
    <button type="button" class="quitar" aria-label="Quitar área">×</button>`;
  fila.querySelector('.quitar').addEventListener('click', () => fila.remove());
  $('#areas').appendChild(fila);
}

function cargarAreas(lista) {
  $('#areas').innerHTML = '';
  lista.forEach(([nombre, hosts]) => nuevaArea(nombre, hosts));
}

$('#agregar-area').addEventListener('click', () => nuevaArea());

$('#f-vlsm').addEventListener('submit', (e) => {
  e.preventDefault();
  const salida = $('#r-vlsm');
  try {
    const ip = $('#vlsm-ip').value.trim();
    const prefijo = Red.leerPrefijo($('#vlsm-prefijo').value);
    const areas = [...document.querySelectorAll('#areas .area')].map((fila, i) => {
      const nombre = fila.querySelector('.area-nombre').value.trim() || `Área ${i + 1}`;
      const hosts = Number(fila.querySelector('.area-hosts').value);
      if (!Number.isInteger(hosts) || hosts < 1) throw new Error(`Falta un número de hosts válido en "${nombre}"`);
      return { nombre, hosts };
    });
    const r = Red.vlsm(ip, prefijo, areas);
    const porcentaje = ((r.usadas / r.total) * 100).toFixed(1);
    salida.innerHTML = infoBase(ip, prefijo) + `
      <article class="caja">
        <h3>Resultado VLSM</h3>
        ${cuadros([
          ['Áreas asignadas', `${r.subredes.length} (de mayor a menor)`],
          ['Usadas', `${miles(r.usadas)} de ${miles(r.total)} (${porcentaje}%)`],
          ['Libres', miles(r.libres)],
          ['Siguiente libre', r.siguienteLibre],
        ])}
        <div class="barra"><div style="width:${porcentaje}%"></div></div>
        <p class="nota">Cada área usa el menor n que cumple 2^n − 2 ≥ hosts pedidos; su prefijo es /(32 − n).</p>
      </article>` + tabla(r.subredes, true);
  } catch (err) {
    error(salida, err);
  }
});

/* ---------- 4. ¿A qué red pertenece? ---------- */

$('#f-ip').addEventListener('submit', (e) => {
  e.preventDefault();
  const salida = $('#r-ip');
  try {
    const ip = $('#ip-valor').value.trim();
    const prefijo = Red.leerPrefijo($('#ip-prefijo').value);
    const s = Red.redDeIp(ip, prefijo);
    salida.innerHTML = `
      <article class="caja">
        <h3>${seguro(ip)}/${prefijo}</h3>
        <div class="binarios">
          <div><span class="etq">IP</span><code>${bitsColor(ip, prefijo)}</code></div>
          <div><span class="etq">Máscara</span><code>${bitsColor(s.mascara, prefijo)}</code></div>
          <div><span class="etq">AND = Red</span><code>${bitsColor(s.red, prefijo)}</code></div>
        </div>
        ${cuadros([
          ['Red', `${s.red}/${prefijo}`],
          ['Primer host', s.primero],
          ['Último host', s.ultimo],
          ['Broadcast', s.broadcast],
          ['Hosts útiles', miles(s.hosts)],
        ])}
      </article>`;
  } catch (err) {
    error(salida, err);
  }
});

/* ---------- Ejemplos ---------- */

const ejemplos = {
  escuela() {
    $('#vlsm-ip').value = '192.168.50.0';
    $('#vlsm-prefijo').value = '/24';
    cargarAreas([['Laboratorio de Cómputo', 60], ['Sala de Maestros', 25], ['Control Escolar', 12],
      ['Biblioteca', 5], ['Enlace R1-R2', 2], ['Enlace R2-R3', 2]]);
    mostrar('vlsm');
    $('#f-vlsm').requestSubmit();
  },
  campus() {
    $('#vlsm-ip').value = '172.20.0.0';
    $('#vlsm-prefijo').value = '/16';
    cargarAreas([['Campus Norte', 2000], ['Campus Sur', 1000], ['Administración', 500],
      ['WiFi Visitantes', 200], ['Enlace Norte-Sur', 2]]);
    mostrar('vlsm');
    $('#f-vlsm').requestSubmit();
  },
  dieciseis() {
    $('#flsm-ip').value = '10.0.0.0';
    $('#flsm-prefijo').value = '/8';
    $('#flsm-modo').value = 'subredes';
    $('#flsm-cantidad').value = 16;
    mostrar('flsm');
    $('#f-flsm').requestSubmit();
  },
};

document.querySelectorAll('[data-ejemplo]').forEach((b) => {
  b.addEventListener('click', () => ejemplos[b.dataset.ejemplo]());
});

/* ---------- Al abrir la página ---------- */

cargarAreas([['Área 1', 50], ['Área 2', 20]]);
$('#f-binario').requestSubmit();
