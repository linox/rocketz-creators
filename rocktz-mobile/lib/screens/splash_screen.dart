import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../widgets/brand_chrome.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: BrandBackdrop(
          child: SafeArea(
            child: Column(
              children: [
                Spacer(flex: 3),
                Center(child: GlassLogoMark()),
                SizedBox(height: 20),
                Center(child: CreatorzWordmark()),
                Spacer(flex: 4),
                _SplashSpinner(),
                SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SplashSpinner extends StatelessWidget {
  const _SplashSpinner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: 0.2),
        border: Border.all(color: Colors.white.withValues(alpha: 0.45)),
      ),
      padding: const EdgeInsets.all(14),
      child: const CircularProgressIndicator(color: Colors.white, strokeWidth: 2.4),
    );
  }
}

class AppStartup extends StatefulWidget {
  const AppStartup({super.key, required this.ready, required this.loggedIn, required this.home, required this.login});

  final bool ready;
  final bool loggedIn;
  final Widget home;
  final Widget login;

  @override
  State<AppStartup> createState() => _AppStartupState();
}

class _AppStartupState extends State<AppStartup> {
  bool _minTime = false;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 1100), () {
      if (mounted) setState(() => _minTime = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final showSplash = !widget.ready || !_minTime;
    if (showSplash) {
      return const SplashScreen();
    }
    return widget.loggedIn ? widget.home : widget.login;
  }
}

class WelcomeTagline extends StatelessWidget {
  const WelcomeTagline({super.key, required this.lines});

  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final line in lines)
          Text(
            line,
            textAlign: TextAlign.center,
            style: GoogleFonts.nunito(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              height: 1.25,
            ),
          ),
      ],
    );
  }
}
