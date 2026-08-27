import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api/api_client.dart';
import 'app.dart';
import 'config.dart';
import 'session/auth_session.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final session = AuthSession(
    clientFactory: (current) => ApiClient(
      baseUrl: AppConfig.apiUrl(),
      tokenProvider: current.tokenValue,
      localeProvider: () => current.locale,
    ),
  );
  runApp(
    ChangeNotifierProvider.value(
      value: session..bootstrap(),
      child: const CreatorzApp(),
    ),
  );
}
