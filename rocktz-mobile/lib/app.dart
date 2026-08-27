import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import 'l10n/strings.dart';
import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';
import 'screens/splash_screen.dart';
import 'session/auth_session.dart';
import 'theme/app_colors.dart';

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
        colorScheme: ColorScheme.fromSeed(seedColor: AppColors.indigo, surface: AppColors.canvas),
        scaffoldBackgroundColor: AppColors.canvas,
        useMaterial3: true,
        textTheme: GoogleFonts.nunitoTextTheme(),
        primaryTextTheme: GoogleFonts.nunitoTextTheme(),
        fontFamily: GoogleFonts.nunito().fontFamily,
        appBarTheme: AppBarTheme(
          backgroundColor: Colors.transparent,
          foregroundColor: AppColors.ink,
          elevation: 0,
          centerTitle: false,
          titleTextStyle: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 20, color: AppColors.ink),
        ),
        snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
      ),
      home: AppStartup(
        ready: session.ready,
        loggedIn: session.isLoggedIn,
        home: const ShellScreen(),
        login: const LoginScreen(),
      ),
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
