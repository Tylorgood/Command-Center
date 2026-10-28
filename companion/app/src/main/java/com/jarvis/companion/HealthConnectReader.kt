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
    val weightKg: Double? = null
)

class HealthConnectReader(context: Context) {
    val client = HealthConnectClient.getOrCreate(context)

    suspend fun readToday(): WearableSnapshot {
        val now = Instant.now()
        val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant()
        val range = TimeRangeFilter.between(start, now)

        val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, range)).records.sumOf { it.count }
        val hr = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, range)).records
            .flatMap { it.samples }.maxByOrNull { it.time }?.beatsPerMinute
        val sleep = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, range)).records
            .sumOf { java.time.Duration.between(it.startTime, it.endTime).toMinutes() }
        val calories = client.readRecords(ReadRecordsRequest(TotalCaloriesBurnedRecord::class, range)).records
            .sumOf { it.energy.inKilocalories }
        val distance = client.readRecords(ReadRecordsRequest(DistanceRecord::class, range)).records
            .sumOf { it.distance.inMeters }
        val oxygen = client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, range)).records
            .maxByOrNull { it.time }?.percentage?.value
        val weight = client.readRecords(ReadRecordsRequest(WeightRecord::class, range)).records
            .maxByOrNull { it.time }?.weight?.inKilograms

        return WearableSnapshot(now, steps, hr, sleep, calories, distance, oxygen, weight)
    }
}
