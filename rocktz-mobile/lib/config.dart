import 'dart:io';

class AppConfig {
  static const productionApi = 'https://api.creatorz.digital/api';

  static String apiUrl() {
    const fromEnv = String.fromEnvironment('API_URL');
    if (fromEnv.isNotEmpty) {
      return fromEnv;
    }
    if (const bool.fromEnvironment('dart.vm.product')) {
      return productionApi;
    }
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:8000/api';
    }
    return 'http://127.0.0.1:8000/api';
  }
}
