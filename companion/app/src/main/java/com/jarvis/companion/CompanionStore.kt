package com.jarvis.companion

import android.content.Context

class CompanionStore(context: Context) {
    private val prefs = context.getSharedPreferences("jarvis_companion", Context.MODE_PRIVATE)

    var pairingCode: String
        get() = prefs.getString("pairing_code", "").orEmpty()
        set(value) { prefs.edit().putString("pairing_code", value.trim()).apply() }

    var lastSyncAt: Long
        get() = prefs.getLong("last_sync_at", 0L)
        set(value) { prefs.edit().putLong("last_sync_at", value).apply() }

    fun clearPairing() {
        prefs.edit().remove("pairing_code").remove("last_sync_at").apply()
    }
}
