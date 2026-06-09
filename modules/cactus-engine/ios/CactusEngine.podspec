Pod::Spec.new do |s|
  s.name           = 'CactusEngine'
  s.version        = '1.0.0'
  s.summary        = 'Cactus inference engine for Gemma 4 multimodal on-device AI'
  s.description    = 'Expo native module wrapping the Cactus C++ inference engine.'
  s.homepage       = 'https://github.com/cactuscompute/cactus'
  s.license        = { type: 'MIT' }
  s.author         = 'Cactus'
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.9'

  s.source         = { git: 'https://github.com/cactuscompute/cactus.git', tag: s.version.to_s }
  s.source_files   = '*.swift'
  s.preserve_paths = 'cactus_engine.h', 'module.modulemap', 'libs/**/*'

  ios_dir = __dir__

  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'SWIFT_INCLUDE_PATHS' => "\"#{ios_dir}\"",
    'HEADER_SEARCH_PATHS' => "\"#{ios_dir}\"",
    'OTHER_LDFLAGS' => '-lc++ -ObjC',
  }

  s.user_target_xcconfig = {
    'LIBRARY_SEARCH_PATHS[sdk=iphoneos*]' => "$(inherited) \"#{File.join(ios_dir, 'libs', 'device')}\"",
    'LIBRARY_SEARCH_PATHS[sdk=iphonesimulator*]' => "$(inherited) \"#{File.join(ios_dir, 'libs', 'simulator')}\"",
    'OTHER_LDFLAGS[sdk=iphoneos*]' => '$(inherited) -lcactus_engine -lcurl',
    'OTHER_LDFLAGS[sdk=iphonesimulator*]' => '$(inherited) -lcactus_engine -lcurl',
  }

  # Ensure the pod's own product directory is in the linker search path
  s.xcconfig = {
    'LIBRARY_SEARCH_PATHS' => '$(inherited) "$(PODS_CONFIGURATION_BUILD_DIR)/CactusEngine"',
  }

  s.frameworks = 'CoreML', 'Accelerate', 'Foundation', 'Security', 'SystemConfiguration', 'CFNetwork'

  s.dependency 'ExpoModulesCore'
end
