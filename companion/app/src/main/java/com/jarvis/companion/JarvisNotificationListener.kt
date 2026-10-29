package com.jarvis.companion

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class JarvisNotificationListener : NotificationListenerService() {
    override fun onNotificationPosted(item: StatusBarNotification?) {
        val notification = item ?: return
        MessageNotificationBridge.handle(applicationContext, notification)
    }
}
