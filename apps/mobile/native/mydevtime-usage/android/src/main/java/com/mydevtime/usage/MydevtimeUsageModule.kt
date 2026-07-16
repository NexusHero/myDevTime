package com.mydevtime.usage

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Native app-usage capture for the Auto-Tracker (REQ-042, ADR-0058). Reads per-app
 * cumulative foreground time from Android's UsageStatsManager and exposes it to JS
 * behind the `NativeUsageModule` port (apps/mobile/src/autotracker/nativeUsage.ts).
 *
 * NOTE: this is the documented native scaffold. It compiles and runs only inside an
 * Expo Dev Client / prebuild build with the special PACKAGE_USAGE_STATS grant — it is
 * NOT part of the managed build and has not been verified on a device in this repo's
 * environment. `hasPermission`/`requestPermission` gate the grant; `query` returns the
 * cumulative totals the pure `diffUsage` turns into spans.
 */
class MydevtimeUsageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MydevtimeUsage")

    AsyncFunction("hasPermission") {
      hasUsageAccess(appContext.reactContext ?: return@AsyncFunction false)
    }

    AsyncFunction("requestPermission") {
      val ctx = appContext.reactContext ?: return@AsyncFunction
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
    }

    // Cumulative foreground time per app for today, as [{ source, totalMs }].
    AsyncFunction("query") {
      val ctx = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val usm = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val end = System.currentTimeMillis()
      val start = end - 24L * 60L * 60L * 1000L // last 24h window
      usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
        .filter { it.totalTimeInForeground > 0 }
        .map { mapOf("source" to it.packageName, "totalMs" to it.totalTimeInForeground) }
    }
  }

  private fun hasUsageAccess(ctx: Context): Boolean {
    val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = appOps.checkOpNoThrow(
      AppOpsManager.OPSTR_GET_USAGE_STATS,
      Process.myUid(),
      ctx.packageName,
    )
    return mode == AppOpsManager.MODE_ALLOWED
  }
}
