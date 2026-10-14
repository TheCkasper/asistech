package gt.edu.asistech

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import gt.edu.asistech.ui.theme.ASISTECHTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.OffsetDateTime
import java.util.UUID

private const val API_ASISTENCIA =
    "http://127.0.0.1:8000/api/asistencia"

class MainActivity : ComponentActivity() {

    private var nfcAdapter: NfcAdapter? = null

    private var actualizarUid: ((String) -> Unit)? = null
    private var actualizarEstadoNfc: ((String) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        setContent {
            ASISTECHTheme {
                PantallaPrincipal(
                    registrarCallbackUid = { callback ->
                        actualizarUid = callback
                    },
                    registrarCallbackEstadoNfc = { callback ->
                        actualizarEstadoNfc = callback
                    },
                    nfcDisponible = nfcAdapter != null
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()

        val adapter = nfcAdapter ?: return

        if (!adapter.isEnabled) {
            actualizarEstadoNfc?.invoke(
                "Activa NFC en los ajustes del teléfono."
            )
            return
        }

        adapter.enableReaderMode(
            this,
            { tag: Tag ->
                val uid = tag.id.joinToString("") { byte ->
                    "%02X".format(byte.toInt() and 0xFF)
                }

                runOnUiThread {
                    actualizarUid?.invoke(uid)
                    actualizarEstadoNfc?.invoke(
                        "Tarjeta detectada. UID: $uid"
                    )
                }
            },
            NfcAdapter.FLAG_READER_NFC_A or
                    NfcAdapter.FLAG_READER_NFC_B or
                    NfcAdapter.FLAG_READER_NFC_F or
                    NfcAdapter.FLAG_READER_NFC_V or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            Bundle()
        )

        actualizarEstadoNfc?.invoke(
            "NFC preparado. Acerca una tarjeta al teléfono."
        )
    }

    override fun onPause() {
        nfcAdapter?.disableReaderMode(this)
        super.onPause()
    }
}

@Composable
fun PantallaPrincipal(
    registrarCallbackUid: (((String) -> Unit) -> Unit),
    registrarCallbackEstadoNfc: (((String) -> Unit) -> Unit),
    nfcDisponible: Boolean
) {
    var uid by remember { mutableStateOf("") }
    var establecimiento by remember { mutableStateOf("1") }
    var tipoRegistro by remember { mutableStateOf("ENTRADA") }
    var estado by remember {
        mutableStateOf("Completa los datos para registrar la asistencia.")
    }
    var estadoNfc by remember {
        mutableStateOf(
            if (nfcDisponible) {
                "Preparando lector NFC..."
            } else {
                "Este dispositivo no dispone de NFC."
            }
        )
    }
    var cargando by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val azul = Color(0xFF123B67)

    SideEffect {
        registrarCallbackUid { nuevoUid ->
            uid = nuevoUid
        }
        registrarCallbackEstadoNfc { nuevoEstado ->
            estadoNfc = nuevoEstado
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color(0xFFF4F7FB)
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(20.dp))

            Text(
                text = "ASISTECH",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = azul
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = "Sistema de control de asistencia",
                color = Color(0xFF64748B),
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(28.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = Color.White
                )
            ) {
                Column(
                    modifier = Modifier.padding(22.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Registrar asistencia",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = azul
                    )

                    Text(
                        text = estadoNfc,
                        color = azul,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = uid,
                        onValueChange = { uid = it },
                        label = { Text("UID de tarjeta NFC") },
                        placeholder = { Text("Acerca una tarjeta NFC") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !cargando
                    )

                    OutlinedTextField(
                        value = establecimiento,
                        onValueChange = { establecimiento = it },
                        label = { Text("ID del establecimiento") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        enabled = !cargando
                    )

                    Text(
                        text = "Tipo de registro",
                        fontWeight = FontWeight.SemiBold,
                        color = azul
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = tipoRegistro == "ENTRADA",
                            onClick = { tipoRegistro = "ENTRADA" },
                            enabled = !cargando
                        )
                        Text(
                            "Entrada",
                            modifier = Modifier.weight(1f)
                        )

                        RadioButton(
                            selected = tipoRegistro == "SALIDA",
                            onClick = { tipoRegistro = "SALIDA" },
                            enabled = !cargando
                        )
                        Text("Salida")
                    }

                    Button(
                        onClick = {
                            val uidLimpio = uid.trim()
                            val id = establecimiento.toIntOrNull()

                            when {
                                uidLimpio.isEmpty() ->
                                    estado = "Lee una tarjeta o ingresa un UID."

                                uidLimpio.any { it.isWhitespace() } ->
                                    estado = "El UID no debe contener espacios."

                                uidLimpio.length > 100 ->
                                    estado = "El UID no puede superar 100 caracteres."

                                id == null || id <= 0 ->
                                    estado = "Ingresa un ID de establecimiento válido."

                                else -> {
                                    scope.launch {
                                        cargando = true
                                        estado = try {
                                            registrarAsistencia(
                                                uid = uidLimpio,
                                                idEstablecimiento = id,
                                                tipo = tipoRegistro
                                            )
                                        } catch (e: Exception) {
                                            "Error: ${e.message ?: "sin detalles"}"
                                        } finally {
                                            cargando = false
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !cargando,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            if (cargando) "Registrando..."
                            else "Registrar asistencia",
                            fontSize = 16.sp
                        )
                    }

                    HorizontalDivider()

                    Text(
                        text = estado,
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        color = azul
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            Text(
                text = "ASISTECH · Control de asistencia",
                color = Color(0xFF64748B),
                fontSize = 12.sp
            )

            Spacer(Modifier.height(20.dp))
        }
    }
}

suspend fun registrarAsistencia(
    uid: String,
    idEstablecimiento: Int,
    tipo: String
): String = withContext(Dispatchers.IO) {

    var conexion: HttpURLConnection? = null

    try {
        val datos = JSONObject().apply {
            put("id_evento", UUID.randomUUID().toString())
            put("uid_nfc", uid)
            put("id_establecimiento", idEstablecimiento)
            put("fecha_hora", OffsetDateTime.now().toString())
            put("tipo_registro", tipo)
        }

        conexion = (URL(API_ASISTENCIA).openConnection()
                as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10000
            readTimeout = 10000
            doOutput = true
            setRequestProperty(
                "Content-Type",
                "application/json; charset=UTF-8"
            )
            setRequestProperty("Accept", "application/json")
        }

        conexion.outputStream.use { salida ->
            salida.write(datos.toString().toByteArray(Charsets.UTF_8))
        }

        val codigo = conexion.responseCode
        val flujo = if (codigo in 200..299) {
            conexion.inputStream
        } else {
            conexion.errorStream
        }

        val respuesta = flujo?.bufferedReader()?.use {
            it.readText()
        }.orEmpty()

        if (codigo in 200..299) {
            val json = JSONObject(respuesta)
            val idRegistro = json.optLong("id_registro", -1L)

            when (json.optString("estado")) {
                "guardado" ->
                    "¡Asistencia guardada correctamente!\nNúmero de registro: $idRegistro"

                "ya_registrado" ->
                    "Este evento ya estaba registrado.\nNúmero de registro: $idRegistro"

                else -> "Respuesta de la API: $respuesta"
            }
        } else {
            val detalle = try {
                JSONObject(respuesta).optString("detail", respuesta)
            } catch (_: Exception) {
                respuesta
            }

            "No se pudo registrar (HTTP $codigo).\n$detalle"
        }
    } catch (e: Exception) {
        "Error de conexión: ${e.message ?: e.javaClass.simpleName}"
    } finally {
        conexion?.disconnect()
    }
}