package com.lumio.app.updater

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LumioUpdaterPackage : ReactPackage {
  @Suppress("DEPRECATION") // Legacy-package bridge; the new-arch path loads it through interop.
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(LumioUpdaterModule(reactContext))

  @Suppress("DEPRECATION")
  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
