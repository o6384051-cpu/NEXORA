package ai.nexora.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                androidx.compose.runtime.CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    NexoraApp()
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun NexoraApp() {
    val scope = rememberCoroutineScope()
    var signedIn by remember { mutableStateOf(false) }
    var password by remember { mutableStateOf("") }
    var prompt by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("اتصل بخدمات NEXORA الآمنة.") }
    val messages = remember { mutableStateListOf<Pair<String, String>>() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("NEXORA AI", style = MaterialTheme.typography.headlineLarge)
            Text("مساعدك الذكي — تطبيق Android أصلي", style = MaterialTheme.typography.bodyLarge)
            if (!signedIn) {
                Text("تسجيل دخول المسؤول", style = MaterialTheme.typography.titleLarge)
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text("كلمة مرور المسؤول") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Button(
                    onClick = {
                        if (!busy && password.isNotBlank()) {
                            busy = true
                            status = "جارٍ التحقق من بيانات الدخول..."
                            scope.launch {
                                ApiClient.login(password).onSuccess {
                                    signedIn = true
                                    password = ""
                                    status = "تم تسجيل الدخول. يمكنك بدء المحادثة."
                                }.onFailure {
                                    status = it.message ?: "تعذر تسجيل الدخول."
                                }
                                busy = false
                            }
                        }
                    },
                    enabled = !busy && password.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                ) { Text(if (busy) "جارٍ الاتصال..." else "دخول آمن") }
            } else {
                Text("المحادثة الذكية", style = MaterialTheme.typography.titleLarge)
                Column(
                    modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    messages.forEach { (speaker, content) ->
                        Text(if (speaker == "user") "أنت: $content" else "NEXORA: $content")
                    }
                }
                OutlinedTextField(
                    value = prompt,
                    onValueChange = { prompt = it },
                    label = { Text("اكتب طلبك") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            val text = prompt.trim()
                            if (!busy && text.isNotEmpty()) {
                                messages.add("user" to text)
                                prompt = ""
                                busy = true
                                status = "يفكر NEXORA..."
                                scope.launch {
                                    ApiClient.chat(text).onSuccess {
                                        messages.add("assistant" to it)
                                        status = "اكتملت الاستجابة من الخادم."
                                    }.onFailure {
                                        messages.add("assistant" to (it.message ?: "تعذر تنفيذ الطلب."))
                                        if (it is ApiException && it.statusCode == 401) {
                                            ApiClient.clearSession()
                                            signedIn = false
                                            status = "انتهت الجلسة. سجّل الدخول مرة أخرى."
                                        } else status = "فشل الطلب؛ لم يتم تسجيل نجاح غير حقيقي."
                                    }
                                    busy = false
                                }
                            }
                        },
                        enabled = !busy && prompt.isNotBlank()
                    ) { Text(if (busy) "جارٍ التنفيذ..." else "إرسال") }
                    Button(onClick = {
                        ApiClient.clearSession()
                        signedIn = false
                        messages.clear()
                        status = "تم إنهاء الجلسة على هذا الجهاز."
                    }, enabled = !busy) { Text("خروج") }
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(status, style = MaterialTheme.typography.bodySmall)
            Text("يتصل التطبيق بخادم NEXORA عبر HTTPS. لا تُخزّن كلمة المرور محلياً.", style = MaterialTheme.typography.bodySmall)
        }
    }
}
