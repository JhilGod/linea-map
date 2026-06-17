// --- VARIABLES GLOBALES ---
let map, baseLayer, userMarker = null, currentLatLng = null, destinationMarker = null;
let isDarkMode = false;
let rutasColectivos = []; // Ahora guardará { nombre, color, featureData, capa, visible }

// --- 1. CONFIGURACIÓN FIREBASE (Tus credenciales reales) ---
const firebaseConfig = {
    apiKey: "AIzaSyDaourUoy1CgLslN9UxO-9DyTz3IjhRVpI",
    authDomain: "linea-map.firebaseapp.com",
    projectId: "linea-map",
    storageBucket: "linea-map.firebasestorage.app",
    messagingSenderId: "350770978437",
    appId: "1:350770978437:web:cf2ef2b5e9b4c6a33e13ec",
    measurementId: "G-LD6E7P550C"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- 2. GESTIÓN DE PANTALLAS ---
window.entrarInvitado = function() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('map').style.display = 'block';
    document.getElementById('top-ui').style.display = 'flex';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('btn-theme').style.display = 'block';
    document.querySelector('.btn-locate').style.display = 'flex';
    initMap();
}

// --- 3. MODO OSCURO (Controlado por CSS) ---
window.toggleTheme = function() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-theme');
    document.getElementById('btn-theme').innerText = isDarkMode ? '☀️' : '🌙';
};

// --- 4. INICIALIZACIÓN DEL MAPA ---
function initMap() {
    const surOeste = L.latLng(-18.55, -70.35);
    const norEste = L.latLng(-18.35, -70.20);
    const limites = L.latLngBounds(surOeste, norEste);

    map = L.map('map', { center: [-18.4783, -70.3126], zoom: 14, minZoom: 13, maxBounds: limites, maxBoundsViscosity: 1.0, zoomControl: false });
    baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: 'Linea Map' }).addTo(map);

    descargarRutas();

    const gpsIcon = L.divIcon({ className: 'user-location-icon', iconSize: [18, 18], iconAnchor: [9, 9] });
    userMarker = L.marker([0, 0], { icon: gpsIcon }).addTo(map);

    map.locate({ watch: true, setView: false, enableHighAccuracy: true }); 
    map.on('locationfound', (e) => {
        currentLatLng = e.latlng;
        userMarker.setLatLng(e.latlng);
    });

    window.centrarEnUsuario = function() {
        if (currentLatLng) map.setView(currentLatLng, 16);
    };
}

// --- 5. LECTURA DE BASE DE DATOS Y VISIBILIDAD ---
function descargarRutas() {
    db.collection("lineas").get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            const datos = doc.data();
            const featureData = {
                "type": "Feature",
                "properties": { "nombre": datos.nombre, "color": datos.color },
                "geometry": { "type": "LineString", "coordinates": JSON.parse(datos.coordenadas) }
            };
            
            // Dibuja la ruta, la añade al mapa y guarda la referencia
            const capa = L.geoJSON(featureData, {
                style: { color: datos.color, weight: 6, opacity: 0.85 }
            }).addTo(map);
            
            capa.on('click', function() {
                abrirSheet(`🚕 ${datos.nombre}`, `<b>Información de ruta:</b><br>Trazado de la línea seleccionada en el mapa.`);
            });

            // Agregamos al arreglo de control
            rutasColectivos.push({
                nombre: datos.nombre,
                color: datos.color,
                featureData: featureData,
                capa: capa,
                visible: true // Por defecto, todas empiezan encendidas
            });
        });
    }).catch(e => console.error("Error conectando a Firebase:", e));
}

// Función que se activa al tocar un interruptor
window.toggleLinea = function(index) {
    let ruta = rutasColectivos[index];
    if (ruta.visible) {
        map.removeLayer(ruta.capa);
        ruta.visible = false;
    } else {
        ruta.capa.addTo(map);
        ruta.visible = true;
    }
}

// --- 6. GESTIÓN DEL BOTTOM SHEET (Panel Deslizable) ---
function abrirSheet(titulo, contenido) {
    document.getElementById('sheet-title').innerHTML = titulo;
    document.getElementById('sheet-content').innerHTML = contenido;
    document.getElementById('bottom-sheet').classList.add('active');
}

window.cerrarSheet = function() {
    document.getElementById('bottom-sheet').classList.remove('active');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item')[0].classList.add('active');
}

window.mostrarLineasEnSheet = function() {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item')[1].classList.add('active');
    
    let html = `<b>Control de Visibilidad:</b><br>Enciende o apaga las líneas en el mapa.<ul style="list-style:none; padding:0; margin-top:15px;">`;
    
    if(rutasColectivos.length === 0) {
        html += `<li>Aún no se han cargado líneas desde el servidor.</li>`;
    } else {
        rutasColectivos.forEach((ruta, index) => {
            // Verifica si la ruta está visible para dejar el botón en ON u OFF
            let isChecked = ruta.visible ? "checked" : "";
            
            html += `
            <li style="margin-bottom:15px; display:flex; justify-content:space-between; align-items:center; font-size:16px;">
                <div>
                    <span style="display:inline-block; width:16px; height:16px; background:${ruta.color}; border-radius:50%; margin-right:12px; vertical-align:middle; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"></span>
                    ${ruta.nombre}
                </div>
                <label class="switch">
                  <input type="checkbox" ${isChecked} onchange="toggleLinea(${index})">
                  <span class="slider round"></span>
                </label>
            </li>`;
        });
    }
    html += `</ul>`;
    abrirSheet("Directorio de Líneas", html);
}

// --- 7. BUSCADOR INTELIGENTE Y CÁLCULO DE RUTAS ---
window.buscarRapido = function(lugar) {
    document.getElementById('dest-input').value = lugar;
    buscarDestino();
}

window.buscarDestino = async function() {
    const query = document.getElementById('dest-input').value;
    if (!query) return;

    const btn = document.getElementById('btn-search');
    btn.innerText = "⏳";

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&city=Arica&limit=1`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        btn.innerText = "Ir";

        if (data.length > 0) {
            const destLatLng = L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
            
            if (destinationMarker) map.removeLayer(destinationMarker);
            destinationMarker = L.marker(destLatLng).addTo(map);
            
            map.setView(destLatLng, 15);
            evaluarRutaIdeal(destLatLng, query);
        } else {
            abrirSheet("Sin resultados", "No encontramos esa ubicación en Arica. Intenta usar nombres de calles específicos (Ej: '21 de Mayo, Arica').");
        }
    } catch (error) {
        btn.innerText = "Ir";
        abrirSheet("Error", "Tuvimos un problema de conexión buscando la dirección.");
    }
};

function evaluarRutaIdeal(destLatLng, nombreLugar) {
    if (rutasColectivos.length === 0) {
        abrirSheet("Aviso", "Aún no se han cargado las rutas desde el servidor.");
        return;
    }

    let minDistDestino = Infinity, lineaRecomendada = "", rutaObjRecomendada = null;

    // Calcular qué línea deja más cerca del destino
    rutasColectivos.forEach(rutaObj => {
        rutaObj.featureData.geometry.coordinates.forEach(coord => {
            let puntoRuta = L.latLng(coord[1], coord[0]);
            let distancia = destLatLng.distanceTo(puntoRuta);
            if (distancia < minDistDestino) {
                minDistDestino = distancia;
                lineaRecomendada = rutaObj.nombre;
                rutaObjRecomendada = rutaObj;
            }
        });
    });

    let mensajeHTML = "";

    if (minDistDestino <= 400) {
        mensajeHTML += `📍 La <b>${lineaRecomendada}</b> te deja a ${Math.round(minDistDestino)}m de tu destino.`;

        // Inteligencia de UX: Si la ruta recomendada estaba apagada, la encendemos para el usuario
        if (!rutaObjRecomendada.visible) {
            rutaObjRecomendada.capa.addTo(map);
            rutaObjRecomendada.visible = true;
            mensajeHTML += `<br><small style="color:#8ab4f8;"><i>(Hemos encendido esta línea en tu mapa para que puedas verla)</i></small>`;
        }

        if (currentLatLng) {
            let minDistOrigen = Infinity;
            rutaObjRecomendada.featureData.geometry.coordinates.forEach(coord => {
                let puntoRuta = L.latLng(coord[1], coord[0]);
                let distancia = currentLatLng.distanceTo(puntoRuta);
                if (distancia < minDistOrigen) minDistOrigen = distancia;
            });

            if (minDistOrigen <= 400) {
                mensajeHTML += `<br><br><span style="color:#27ae60; font-weight:bold;">✅ ¡Pasa cerca de ti!</span><br>Acércate a <b>${Math.round(minDistOrigen)}m</b> para tomar el colectivo.`;
            } else {
                mensajeHTML += `<br><br><span style="color:#f39c12; font-weight:bold;">⚠️ Lejos de tu origen</span><br>La ruta pasa a <b>${Math.round(minDistOrigen)}m</b> de ti. Tendrás que caminar para tomar esta línea.`;
            }
            map.fitBounds(L.latLngBounds(currentLatLng, destLatLng), { padding: [50, 50] });
        } else {
            mensajeHTML += `<br><br><i>(Activa tu GPS pulsando el botón 🎯 para saber si pasa cerca de ti)</i>`;
        }
    } else {
        mensajeHTML += `❌ Ningún colectivo guardado te deja cerca. La ruta más próxima está a ${Math.round(minDistDestino)}m.`;
    }

    abrirSheet(`Ruta hacia: ${nombreLugar.toUpperCase()}`, mensajeHTML);
}