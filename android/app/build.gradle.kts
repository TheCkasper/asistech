plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "gt.edu.asistech"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "gt.edu.asistech"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // URL base por defecto (Local)
        buildConfigField("String", "API_ASISTENCIA_URL", "\"http://10.0.2.2:8000/api/asistencia\"")
    }

    buildTypes {
        debug {
            // URL para pruebas locales en emulador o servidor local
            buildConfigField("String", "API_ASISTENCIA_URL", "\"http://10.0.2.2:8000/api/asistencia\"")
        }
        release {
            // URL de producción en BanaHosting / Cloudflare
            buildConfigField("String", "API_ASISTENCIA_URL", "\"https://asistech.divinevo.com/api/asistencia\"")
            optimization {
                enable = true
                packageScope = setOf("androidx.**", "kotlin.**", "kotlinx.**")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}