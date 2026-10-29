package com.jarvis.companion

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class HealthSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        val store = CompanionStore(applicationContext)
        val token = store.pairingCode
        if (token.isBlank()) return Result.success()
        if (HealthConnectClient.getSdkStatus(applicationContext) != HealthConnectClient.SDK_AVAILABLE) return Result.success()
        return try {
            val snapshot = HealthConnectReader(applicationContext).readToday()
            if (!snapshot.hasAnyData()) return Result.success()
            val result = JarvisApi.sync(snapshot, token)
            if (result.first) {
                store.lastSyncAt = System.currentTimeMillis()
                Result.success()
            } else Result.retry()
        } catch (_: SecurityException) {
            // Background-read permission has not been granted yet. Foreground/manual sync remains available.
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val WORK_NAME = "jarvis_health_auto_sync"

        fun schedule(context: Context) {
            val constraints = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
            // Android WorkManager's supported periodic floor is 15 minutes. It may run later under Doze/battery policy.
            val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
        }
    }
}
