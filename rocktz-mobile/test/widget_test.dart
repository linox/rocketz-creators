import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:rocktz_mobile/api/api_client.dart';
import 'package:rocktz_mobile/app.dart';
import 'package:rocktz_mobile/session/auth_session.dart';
import 'package:rocktz_mobile/session/token_store.dart';

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  testWidgets('shows creator login', (tester) async {
    final session = AuthSession(
      tokenStore: MemoryTokenStore(),
      clientFactory: (current) => ApiClient(
        baseUrl: 'http://api.test/api',
        httpClient: MockClient((request) async => http.Response('{}', 200)),
        tokenProvider: current.tokenValue,
        localeProvider: () => current.locale,
      ),
    );
    session.ready = true;

    await tester.pumpWidget(
      ChangeNotifierProvider.value(
        value: session,
        child: const CreatorzApp(),
      ),
    );

    expect(find.text('Entrar'), findsOneWidget);
    expect(find.text('Creatorz'), findsOneWidget);
  });
}
