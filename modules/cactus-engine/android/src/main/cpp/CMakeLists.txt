cmake_minimum_required(VERSION 3.22.1)
project(cactus_bridge LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LIBS_DIR "${CMAKE_SOURCE_DIR}/../../../libs/${ANDROID_ABI}")
set(FFI_INCLUDE "${CMAKE_SOURCE_DIR}/../../../../ios/include")

add_library(cactus STATIC IMPORTED)
set_target_properties(cactus PROPERTIES IMPORTED_LOCATION "${LIBS_DIR}/libcactus.a")

add_library(curl STATIC IMPORTED)
set_target_properties(curl PROPERTIES IMPORTED_LOCATION "${LIBS_DIR}/libcurl.a")

add_library(mbedtls STATIC IMPORTED)
set_target_properties(mbedtls PROPERTIES IMPORTED_LOCATION "${LIBS_DIR}/libmbedtls.a")

add_library(mbedx509 STATIC IMPORTED)
set_target_properties(mbedx509 PROPERTIES IMPORTED_LOCATION "${LIBS_DIR}/libmbedx509.a")

add_library(mbedcrypto STATIC IMPORTED)
set_target_properties(mbedcrypto PROPERTIES IMPORTED_LOCATION "${LIBS_DIR}/libmbedcrypto.a")

add_library(cactus_bridge SHARED
    cactus_bridge.cpp
)

target_include_directories(cactus_bridge PRIVATE
    ${FFI_INCLUDE}
)

find_library(log-lib log)

target_link_libraries(cactus_bridge
    cactus
    curl
    mbedtls
    mbedx509
    mbedcrypto
    ${log-lib}
)
