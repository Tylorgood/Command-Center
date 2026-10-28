package com.jarvis.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF55E7FF))) {
                CompanionScreen()
            }
        }
    }

    @Composable
    private fun CompanionScreen() {
        val scope = rememberCoroutineScope()
        val reader = remember { HealthConnectReader(this) }
        var status by remember { mutableStateOf("Ready to connect") }
        var snapshot by remember { mutableStateOf<WearableSnapshot?>(null) }
        var pairingCode by remember { mutableStateOf("") }

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

        val launcher = rememberLauncherForActivityResult(
            PermissionController.createRequestPermissionResultContract()
        ) { granted ->
            status = if (granted.containsAll(permissions)) "Health Connect authorized" else "Some permissions were not granted"
        }

        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("JARVIS Companion", style = MaterialTheme.typography.headlineMedium)
                Text("FitCloud / Health Connect bridge")
                Text(status)

                Button(onClick = { launcher.launch(permissions) }) { Text("Connect Health Data") }

                OutlinedTextField(
                    value = pairingCode,
                    onValueChange = { pairingCode = it.trim() },
                    label = { Text("JARVIS pairing code") }
                )

                Button(onClick = {
                    scope.launch {
                        status = "Reading health data…"
                        runCatching { reader.readToday() }
                            .onSuccess { snapshot = it; status = "Health data ready" }
                            .onFailure { status = "Health read failed" }
                    }
                }) { Text("Read Now") }

                snapshot?.let { s ->
                    Text("Steps: ${s.steps ?: "—"}")
                    Text("Heart rate: ${s.latestHeartRate ?: "—"} bpm")
                    Text("Sleep: ${s.sleepMinutes ?: "—"} min")
                    Text("Calories: ${s.caloriesKcal?.toInt() ?: "—"} kcal")
                    Text("Distance: ${s.distanceMeters?.toInt() ?: "—"} m")
                    Text("SpO₂: ${s.oxygenPercent ?: "—"} %")

                    Button(enabled = pairingCode.isNotBlank(), onClick = {
                        scope.launch {
                            status = "Syncing to JARVIS…"
                            val result = withContext(Dispatchers.IO) { JarvisApi.sync(s, pairingCode) }
                            status = if (result.first) "Synced to JARVIS" else "JARVIS sync rejected"
                        }
                    }) { Text("Sync to JARVIS") }
                }
            }
        }
    }
}
