package com.jarvis.companion

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class WearableSnapshot(
    val capturedAt: Instant = Instant.now(),
    val steps: Long? = null,
    val latestHeartRate: Long? = null,
    val sleepMinutes: Long? = null,
    val caloriesKcal: Double? = null,
    val distanceMeters: Double? = null,
    val oxygenPercent: Double? = null,
    val weightKg: Double? = null,
    val availableMetrics: Set<String> = emptySet()
) {
    fun hasAnyData() = listOf(steps, latestHeartRate, sleepMinutes, caloriesKcal, distanceMeters, oxygenPercent, weightKg).any { it != null }
}

class HealthConnectReader(context: Context) {
    val client = HealthConnectClient.getOrCreate(context)

    private suspend fun <T> safe(block: suspend () -> T): T? = try { block() } catch (_: SecurityException) { null } catch (_: Exception) { null }

    suspend fun readToday(): WearableSnapshot {
        val now = Instant.now()
        val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant()
        val range = TimeRangeFilter.between(start, now)
        val available = linkedSetOf<String>()

        val steps = safe { client.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records.sumOf { it.count } }?.also { available += "steps" }
        val hr = safe { client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range)).records.flatMap { it.samples }.maxByOrNull { it.time }?.beatsPerMinute }?.also { available += "heart_rate" }
        val sleep = safe { client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records.sumOf { java.time.Duration.between(it.startTime, it.endTime).toMinutes() } }?.also { available += "sleep" }
        val calories = safe { client.readRecords(ReadRecordsRequest(TotalCaloriesBurnedRecord::class, range)).records.sumOf { it.energy.inKilocalories } }?.also { available += "calories" }
        val distance = safe { client.readRecords(ReadRecordsRequest(DistanceRecord::class, range)).records.sumOf { it.distance.inMeters } }?.also { available += "distance" }
        val oxygen = safe { client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, range)).records.maxByOrNull { it.time }?.percentage?.value }?.also { available += "spo2" }
        val weight = safe { client.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records.maxByOrNull { it.time }?.weight?.inKilograms }?.also { available += "weight" }

        return WearableSnapshot(now, steps, hr, sleep, calories, distance, oxygen, weight, available)
    }
}
