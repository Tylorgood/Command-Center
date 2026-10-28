package com.jarvis.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF55E7FF), secondary = Color(0xFF7DFFB2))) {
                CompanionScreen()
            }
        }
    }

    @Composable
    private fun CompanionScreen() {
        val scope = rememberCoroutineScope()
        val store = remember { CompanionStore(this) }
        val availability = remember { HealthConnectClient.getSdkStatus(this) }
        val reader = remember { if (availability == HealthConnectClient.SDK_AVAILABLE) HealthConnectReader(this) else null }
        var status by remember { mutableStateOf(if (availability == HealthConnectClient.SDK_AVAILABLE) "Ready" else "Health Connect is unavailable on this phone") }
        var snapshot by remember { mutableStateOf<WearableSnapshot?>(null) }
        var pairingCode by remember { mutableStateOf(store.pairingCode) }
        var grantedCount by remember { mutableIntStateOf(0) }

        val permissions = remember {
            setOf(
                HealthPermission.getReadPermission(StepsRecord::class),
                HealthPermission.getReadPermission(HeartRateRecord::class),
                HealthPermission.getReadPermission(SleepSessionRecord::class),
                HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
                HealthPermission.getReadPermission(DistanceRecord::class),
                HealthPermission.getReadPermission(OxygenSaturationRecord::class),
                HealthPermission.getReadPermission(WeightRecord::class)
            )
        }

        fun refreshPermissions() {
            val r = reader ?: return
            scope.launch {
                val granted = r.client.permissionController.getGrantedPermissions()
                grantedCount = permissions.count { it in granted }
                status = when {
                    grantedCount == permissions.size -> "Health access ready"
                    grantedCount > 0 -> "$grantedCount of ${permissions.size} health permissions granted — partial reads are OK"
                    else -> "Health access needs permission"
                }
            }
        }

        val launcher = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) {
            refreshPermissions()
        }

        LaunchedEffect(Unit) {
            refreshPermissions()
            if (pairingCode.isNotBlank() && reader != null) {
                runCatching { reader.readToday() }.onSuccess { snapshot = it }
            }
        }

        Surface(Modifier.fillMaxSize()) {
            Column(
                Modifier.padding(22.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text("JARVIS Companion", style = MaterialTheme.typography.headlineMedium)
                Text("WATCH → HEALTH CONNECT → JARVIS", color = MaterialTheme.colorScheme.primary)
                AssistChip(onClick = {}, label = { Text(status) })

                Text("1 · Health access", style = MaterialTheme.typography.titleMedium)
                Text(if (availability == HealthConnectClient.SDK_AVAILABLE) "$grantedCount / ${permissions.size} approved" else "Unavailable")
                Button(enabled = reader != null, onClick = { launcher.launch(permissions) }) { Text("Review Health Permissions") }

                Text("2 · JARVIS pairing", style = MaterialTheme.typography.titleMedium)
                OutlinedTextField(
                    modifier = Modifier.fillMaxWidth(),
                    value = pairingCode,
                    onValueChange = { pairingCode = it.trim(); store.pairingCode = pairingCode },
                    label = { Text("Pairing code") },
                    supportingText = { Text(if (pairingCode.isBlank()) "Create this on the JARVIS Companion setup website." else "Saved on this phone") }
                )

                Text("3 · Watch data", style = MaterialTheme.typography.titleMedium)
                Button(enabled = reader != null, onClick = {
                    scope.launch {
                        status = "Reading available health data…"
                        runCatching { reader!!.readToday() }
                            .onSuccess { snapshot = it; status = if (it.hasAnyData()) "Health data found" else "No Health Connect records found yet — FitCloud may need the direct bridge" }
                            .onFailure { status = "Health read failed: ${it.message ?: "unknown error"}" }
                    }
                }) { Text("Refresh Watch Data") }

                snapshot?.let { s ->
                    ElevatedCard(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text("TODAY", color = MaterialTheme.colorScheme.primary)
                            Text("Steps  ${s.steps ?: "—"}")
                            Text("Heart  ${s.latestHeartRate?.let { "$it bpm" } ?: "—"}")
                            Text("Sleep  ${s.sleepMinutes?.let { "$it min" } ?: "—"}")
                            Text("Calories  ${s.caloriesKcal?.toInt()?.let { "$it kcal" } ?: "—"}")
                            Text("Distance  ${s.distanceMeters?.toInt()?.let { "$it m" } ?: "—"}")
                            Text("SpO₂  ${s.oxygenPercent?.let { "${it.toInt()}%" } ?: "—"}")
                            Text("Weight  ${s.weightKg?.let { "%.1f kg".format(it) } ?: "—"}")
                            Text("Readable sources: ${if (s.availableMetrics.isEmpty()) "none" else s.availableMetrics.joinToString()}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Button(enabled = pairingCode.isNotBlank() && s.hasAnyData(), onClick = {
                        scope.launch {
                            store.pairingCode = pairingCode
                            status = "Syncing to JARVIS…"
                            val result = withContext(Dispatchers.IO) { JarvisApi.sync(s, pairingCode) }
                            if (result.first) {
                                store.lastSyncAt = System.currentTimeMillis()
                                status = "Synced to JARVIS"
                            } else status = "JARVIS sync rejected — create a fresh pairing code"
                        }
                    }) { Text("Sync to JARVIS") }
                }

                if (store.lastSyncAt > 0) Text("Last JARVIS sync: ${DateFormat.getDateTimeInstance().format(Date(store.lastSyncAt))}", style = MaterialTheme.typography.bodySmall)

                HorizontalDivider()
                Text("FitCloud direct bridge", style = MaterialTheme.typography.titleMedium)
                Text("Standby fallback. If Refresh Watch Data stays empty while FitCloud Pro shows current watch readings, the next field-test build will switch this same app to the official FitCloud SDK path.")

                TextButton(onClick = { store.clearPairing(); pairingCode = ""; status = "Pairing cleared" }) { Text("Disconnect this phone") }
            }
        }
    }
}
