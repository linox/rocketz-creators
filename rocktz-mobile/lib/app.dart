import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'l10n/strings.dart';
import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';
import 'session/auth_session.dart';

class CreatorzApp extends StatelessWidget {
  const CreatorzApp({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final strings = session.strings;
    return MaterialApp(
      title: strings.t('appName'),
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6366F1)),
        useMaterial3: true,
        textTheme: GoogleFonts.nunitoTextTheme(),
        primaryTextTheme: GoogleFonts.nunitoTextTheme(),
        fontFamily: GoogleFonts.nunito().fontFamily,
      ),
      home: !session.ready
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : session.isLoggedIn
              ? const ShellScreen()
              : const LoginScreen(),
    );
  }
}

class LanguageSwitcher extends StatelessWidget {
  const LanguageSwitcher({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    return SegmentedButton<String>(
      segments: const [
        ButtonSegment(value: 'pt-BR', label: Text('PT')),
        ButtonSegment(value: 'en', label: Text('EN')),
        ButtonSegment(value: 'es', label: Text('ES')),
      ],
      selected: {AppStrings.normalize(session.locale)},
      onSelectionChanged: (value) => session.setLocale(value.first),
    );
  }
}
