package com.jarvis.companion

import java.net.HttpURLConnection
import java.net.URL

object JarvisApi {
    const val BASE_URL = "https://jarvis-v4-field-test.onrender.com"
    private fun value(v: Any?): String = v?.toString() ?: "null"
    private fun q(v: String) = v.replace("\\", " ").replace("\"", "'").replace("\n", " ").replace("\r", " ")

    fun toJson(s: WearableSnapshot): String = """{"source":"health_connect","capturedAt":"${s.capturedAt}","metrics":{"steps":${value(s.steps)},"heartRateBpm":${value(s.latestHeartRate)},"sleepMinutes":${value(s.sleepMinutes)},"caloriesKcal":${value(s.caloriesKcal)},"distanceMeters":${value(s.distanceMeters)},"oxygenPercent":${value(s.oxygenPercent)},"weightKg":${value(s.weightKg)}}}"""

    private fun post(payload: String, pairingCode: String): Pair<Boolean,String> {
        val connection = URL("$BASE_URL/api/wearable/sync").openConnection() as HttpURLConnection
        connection.requestMethod = "POST"; connection.connectTimeout = 15000; connection.readTimeout = 15000; connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("Authorization", "Bearer $pairingCode")
        connection.outputStream.use { it.write(payload.toByteArray()) }
        val ok = connection.responseCode in 200..299
        val stream = if (ok) connection.inputStream else connection.errorStream
        val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty(); connection.disconnect(); return ok to body
    }

    fun sync(snapshot: WearableSnapshot, pairingCode: String) = post(toJson(snapshot), pairingCode)

    fun syncMessage(id: String, packageName: String, sender: String, message: String, receivedAt: Long, pairingCode: String): Pair<Boolean,String> {
        val payload = """{"source":"sms_notification","messages":[{"id":"${q(id)}","packageName":"${q(packageName)}","sender":"${q(sender)}","body":"${q(message)}","receivedAt":$receivedAt}]}"""
        return post(payload, pairingCode)
    }
}
