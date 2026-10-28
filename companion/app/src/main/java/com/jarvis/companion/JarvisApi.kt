package com.jarvis.companion

import java.net.HttpURLConnection
import java.net.URL

object JarvisApi {
    const val BASE_URL = "https://jarvis-v4-field-test.onrender.com"

    private fun value(v: Any?): String = v?.toString() ?: "null"

    fun toJson(s: WearableSnapshot): String = """{
      "source":"health_connect",
      "capturedAt":"${s.capturedAt}",
      "metrics":{
        "steps":${value(s.steps)},
        "heartRateBpm":${value(s.latestHeartRate)},
        "sleepMinutes":${value(s.sleepMinutes)},
        "caloriesKcal":${value(s.caloriesKcal)},
        "distanceMeters":${value(s.distanceMeters)},
        "oxygenPercent":${value(s.oxygenPercent)},
        "weightKg":${value(s.weightKg)}
      }
    }""".trimIndent()

    fun sync(snapshot: WearableSnapshot, pairingCode: String): Pair<Boolean,String> {
        val connection = URL("$BASE_URL/api/wearable/sync").openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.setRequestProperty("Authorization", "Bearer $pairingCode")
        connection.outputStream.use { it.write(toJson(snapshot).toByteArray()) }
        val ok = connection.responseCode in 200..299
        val stream = if (ok) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        return ok to body
    }
}
