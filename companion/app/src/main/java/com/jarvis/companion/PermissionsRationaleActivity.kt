package com.jarvis.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

class PermissionsRationaleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Color(0xFF55E7FF), secondary = Color(0xFF7DFFB2))) {
                Surface(Modifier.fillMaxSize()) {
                    Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text("JARVIS Health Access", style = MaterialTheme.typography.headlineMedium)
                        Text("JARVIS Companion requests read-only access to the wellness metrics you choose so it can show and sync your watch data to your private JARVIS account. It does not request permission to modify Health Connect data.")
                        Text("You can deny individual metrics or remove access later in Health Connect settings.")
                        Button(onClick = { finish() }) { Text("Back") }
                    }
                }
            }
        }
    }
}
