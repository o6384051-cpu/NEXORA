package ai.nexora.mobile

import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.CookieHandler
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal object NexoraConfig {
    const val API_BASE_URL = "https://nexora-o6384051-cpuosama.vercel.app"
}

internal class ApiException(val statusCode: Int, message: String) : Exception(message)

internal object ApiClient {
    private val cookies = CookieManager(null, CookiePolicy.ACCEPT_ALL).also {
        CookieHandler.setDefault(it)
    }

    suspend fun login(password: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val response = post("/api/auth/login", JSONObject().put("password", password))
            if (response.optBoolean("ok")) Unit else throw ApiException(401, "تعذر تسجيل الدخول.")
        }
    }

    suspend fun chat(message: String): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val response = post("/api/chat", JSONObject().put("message", message))
            response.optString("reply").takeIf { it.isNotBlank() }
                ?: throw IllegalStateException("وصل رد فارغ من الخادم.")
        }
    }

    fun clearSession() {
        cookies.cookieStore.removeAll()
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val connection = (URL(NexoraConfig.API_BASE_URL + path).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 65_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("Accept", "application/json")
        }
        try {
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.use { input ->
                BufferedReader(InputStreamReader(input, Charsets.UTF_8)).readText()
            }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrElse { JSONObject() }
            if (status !in 200..299) {
                val message = json.optString("error").ifBlank { "فشل الاتصال بالخادم (HTTP $status)." }
                throw ApiException(status, message)
            }
            return json
        } finally {
            connection.disconnect()
        }
    }
}
