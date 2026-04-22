#include <jni.h>
#include <cstdlib>
#include <string>
#include <vector>
#include "cactus_ffi.h"

static cactus_model_t g_model = nullptr;

struct JNITokenCallbackData {
    JNIEnv* env;
    jobject callback;
    jmethodID method;
};

static void jni_token_callback(const char* token, uint32_t token_id, void* user_data) {
    auto* data = static_cast<JNITokenCallbackData*>(user_data);
    JNIEnv* env = data->env;
    jstring jtoken = env->NewStringUTF(token);
    env->CallVoidMethod(data->callback, data->method, jtoken, static_cast<jint>(token_id));
    env->DeleteLocalRef(jtoken);
}

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_cactusgemma_CactusEngineModule_nativeInit(
    JNIEnv* env, jobject, jstring modelPath
) {
    if (g_model) {
        cactus_destroy(g_model);
        g_model = nullptr;
    }
    const char* path = env->GetStringUTFChars(modelPath, nullptr);
    setenv("CACTUS_CLOUD_KEY", "", 1);
    cactus_set_telemetry_environment("cactus-gemma-demo-app", nullptr, nullptr);
    g_model = cactus_init(path, nullptr, false);
    env->ReleaseStringUTFChars(modelPath, path);
    return g_model != nullptr ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_cactusgemma_CactusEngineModule_nativeDestroy(JNIEnv*, jobject) {
    if (g_model) {
        cactus_destroy(g_model);
        g_model = nullptr;
    }
}

JNIEXPORT void JNICALL
Java_com_cactusgemma_CactusEngineModule_nativeReset(JNIEnv*, jobject) {
    if (g_model) cactus_reset(g_model);
}

JNIEXPORT void JNICALL
Java_com_cactusgemma_CactusEngineModule_nativeStop(JNIEnv*, jobject) {
    if (g_model) cactus_stop(g_model);
}

JNIEXPORT jstring JNICALL
Java_com_cactusgemma_CactusEngineModule_nativeComplete(
    JNIEnv* env, jobject,
    jstring messagesJson,
    jstring optionsJson,
    jbyteArray pcmData,
    jobject tokenCallback
) {
    if (!g_model) {
        jclass exClass = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(exClass, "Model not loaded");
        return nullptr;
    }

    const char* messages = env->GetStringUTFChars(messagesJson, nullptr);
    const char* options = optionsJson ? env->GetStringUTFChars(optionsJson, nullptr) : nullptr;

    const size_t bufferSize = 65536;
    std::vector<char> responseBuffer(bufferSize, 0);

    JNITokenCallbackData cbData{};
    cactus_token_callback cbFunc = nullptr;
    void* cbUserData = nullptr;

    if (tokenCallback) {
        jclass cbClass = env->GetObjectClass(tokenCallback);
        cbData.env = env;
        cbData.callback = tokenCallback;
        cbData.method = env->GetMethodID(cbClass, "onToken", "(Ljava/lang/String;I)V");
        env->DeleteLocalRef(cbClass);
        if (cbData.method) {
            cbFunc = jni_token_callback;
            cbUserData = &cbData;
        }
    }

    const uint8_t* pcmPtr = nullptr;
    size_t pcmSize = 0;
    jbyte* pcmBytes = nullptr;
    if (pcmData) {
        pcmSize = static_cast<size_t>(env->GetArrayLength(pcmData));
        pcmBytes = env->GetByteArrayElements(pcmData, nullptr);
        pcmPtr = reinterpret_cast<const uint8_t*>(pcmBytes);
    }

    int result = cactus_complete(
        g_model,
        messages,
        responseBuffer.data(),
        bufferSize,
        options,
        nullptr,
        cbFunc,
        cbUserData,
        pcmPtr,
        pcmSize
    );

    if (pcmBytes) {
        env->ReleaseByteArrayElements(pcmData, pcmBytes, JNI_ABORT);
    }

    env->ReleaseStringUTFChars(messagesJson, messages);
    if (options) env->ReleaseStringUTFChars(optionsJson, options);

    if (result < 0) {
        jclass exClass = env->FindClass("java/lang/RuntimeException");
        env->ThrowNew(exClass, cactus_get_last_error());
        return nullptr;
    }

    return env->NewStringUTF(responseBuffer.data());
}

} // extern "C"
