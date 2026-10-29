plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }
android {
 namespace = "com.jarvis.companion"; compileSdk = 36
 defaultConfig { applicationId = "com.jarvis.companion"; minSdk = 28; targetSdk = 35; versionCode = 3; versionName = "0.3.0-push6" }
 compileOptions {
   sourceCompatibility = JavaVersion.VERSION_17
   targetCompatibility = JavaVersion.VERSION_17
 }
 kotlinOptions { jvmTarget = "17" }
}
dependencies {
 implementation("androidx.core:core-ktx:1.15.0")
 implementation("androidx.activity:activity-compose:1.10.0")
 implementation("androidx.compose.material3:material3:1.3.1")
 implementation("androidx.compose.ui:ui:1.7.8")
 implementation("androidx.health.connect:connect-client:1.1.0")
 implementation("androidx.work:work-runtime-ktx:2.10.0")
}
