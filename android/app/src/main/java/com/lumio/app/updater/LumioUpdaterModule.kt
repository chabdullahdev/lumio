package com.lumio.app.updater

import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Minimal in-app updater for the sideloaded APK.
 *
 * Reports the installed version, downloads the APK published by
 * `scripts/publish-android-release.mjs`, verifies its SHA-256, and hands it to
 * the system package installer. Android shows its own install confirmation
 * ("Update app?") — silent installs are not possible for a normal app.
 */
class LumioUpdaterModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName(): String = "LumioUpdater"

  @ReactMethod
  fun getVersionCode(promise: Promise) {
    try {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      val code =
          if (android.os.Build.VERSION.SDK_INT >= 28) {
            info.longVersionCode
          } else {
            @Suppress("DEPRECATION") info.versionCode.toLong()
          }
      promise.resolve(code.toDouble())
    } catch (error: Exception) {
      promise.reject("E_VERSION", error.message, error)
    }
  }

  @ReactMethod
  fun getVersionName(promise: Promise) {
    try {
      val info = context.packageManager.getPackageInfo(context.packageName, 0)
      @Suppress("DEPRECATION") promise.resolve(info.versionName ?: "1.0")
    } catch (error: Exception) {
      promise.reject("E_VERSION", error.message, error)
    }
  }

  @ReactMethod
  fun canRequestPackageInstalls(promise: Promise) {
    val allowed =
        if (android.os.Build.VERSION.SDK_INT >= 26) {
          context.packageManager.canRequestPackageInstalls()
        } else {
          true
        }
    promise.resolve(allowed)
  }

  /** Opens the system screen where the user allows "install unknown apps". */
  @ReactMethod
  fun openInstallSettings(promise: Promise) {
    try {
      if (android.os.Build.VERSION.SDK_INT >= 26) {
        val intent =
            Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${context.packageName}"),
                )
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("E_SETTINGS", error.message, error)
    }
  }

  @ReactMethod
  fun downloadAndInstall(url: String, sha256: String, promise: Promise) {
    if (android.os.Build.VERSION.SDK_INT >= 26 &&
        !context.packageManager.canRequestPackageInstalls()) {
      promise.reject("E_PERMISSION", "Lumio is not allowed to install packages yet.")
      return
    }

    Thread {
          var downloaded: File? = null
          try {
            val dir = File(context.cacheDir, "updates").apply { mkdirs() }
            downloaded = File(dir, "lumio-update.apk")
            if (downloaded.exists()) {
              downloaded.delete()
            }

            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 20000
            connection.readTimeout = 60000
            connection.instanceFollowRedirects = true
            connection.connect()

            if (connection.responseCode !in 200..299) {
              throw IllegalStateException("Download failed with HTTP ${connection.responseCode}.")
            }

            val total = connection.contentLengthLong
            val digest = MessageDigest.getInstance("SHA-256")
            var bytes = 0L
            var lastEmit = 0L

            connection.inputStream.use { input ->
              FileOutputStream(downloaded).use { output ->
                val buffer = ByteArray(64 * 1024)
                while (true) {
                  val read = input.read(buffer)
                  if (read == -1) break
                  output.write(buffer, 0, read)
                  digest.update(buffer, 0, read)
                  bytes += read
                  val now = System.currentTimeMillis()
                  if (now - lastEmit >= 120 || (total > 0 && bytes >= total)) {
                    emitProgress(bytes, total)
                    lastEmit = now
                  }
                }
                output.flush()
              }
            }
            connection.disconnect()

            val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
            if (sha256.isNotEmpty() && !actual.equals(sha256, ignoreCase = true)) {
              downloaded.delete()
              throw IllegalStateException(
                  "The downloaded update failed its integrity check. Please try again.")
            }

            val file = downloaded
            Handler(Looper.getMainLooper()).post {
              try {
                val uri =
                    FileProvider.getUriForFile(
                        context, "${context.packageName}.fileprovider", file)
                val intent =
                    Intent(Intent.ACTION_VIEW).apply {
                      setDataAndType(uri, "application/vnd.android.package-archive")
                      addFlags(
                          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                context.startActivity(intent)
                promise.resolve(null)
              } catch (error: Exception) {
                promise.reject("E_INSTALL", error.message, error)
              }
            }
          } catch (error: Exception) {
            downloaded?.delete()
            promise.reject("E_DOWNLOAD", error.message, error)
          }
        }
        .start()
  }

  private fun emitProgress(bytes: Long, total: Long) {
    val payload =
        Arguments.createMap().apply {
          putDouble("bytes", bytes.toDouble())
          putDouble("total", total.toDouble())
        }
    context
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("LumioUpdaterProgress", payload)
  }
}
