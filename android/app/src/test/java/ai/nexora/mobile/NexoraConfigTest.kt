package ai.nexora.mobile

import org.junit.Assert.assertTrue
import org.junit.Test

class NexoraConfigTest {
    @Test
    fun productionApiUsesHttps() {
        assertTrue(NexoraConfig.API_BASE_URL.startsWith("https://"))
    }
}
