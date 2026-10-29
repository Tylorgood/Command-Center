package com.jarvis.companion

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import kotlin.concurrent.thread

class JarvisNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(item: StatusBarNotification?) {
        val n = item ?: return
        val p = n.packageName.lowercase()
        if (!(p.contains("messag") || p.contains("mms") || p.contains("sms"))) return
        val extras = n.notification.extras ?: return
        val sender = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
        val body = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
        if (body.isBlank()) return
        val token = CompanionStore(applicationContext).pairingCode
        if (token.isBlank()) return
        val sourceId = "${n.packageName}:${n.key}:${n.postTime}"
        thread(start = true, name = "jarvis-message-sync") {
            runCatching { JarvisApi.syncMessage(sourceId, n.packageName, sender.ifBlank { "Message" }, body, n.postTime, token) }
        }
    }
}
