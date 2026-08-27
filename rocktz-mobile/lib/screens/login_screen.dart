import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../l10n/strings.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/brand_chrome.dart';
import 'register_screen.dart';
import 'splash_screen.dart';
import 'two_factor_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool loading = false;
  bool emailStep = false;
  String? error;

  Future<void> _unlock() async {
    final session = context.read<AuthSession>();
    setState(() {
      loading = true;
      error = null;
    });
    final ok = await session.unlockWithBiometrics();
    if (!mounted) return;
    setState(() {
      loading = false;
      if (!ok) error = session.strings.t('biometricFailed');
    });
  }

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = context.read<AuthSession>();
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await session.login(email.text.trim(), password.text);
    } on TwoFactorRequired catch (e) {
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => TwoFactorScreen(challengeToken: e.challengeToken),
      ));
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _forgot() async {
    final session = context.read<AuthSession>();
    try {
      await session.forgotPassword(email.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(session.strings.t('resetSent'))),
      );
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final t = session.strings.t;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
      body: BrandBackdrop(
        child: SafeArea(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 280),
            child: emailStep ? _form(t) : _welcome(t),
          ),
        ),
      ),
      ),
    );
  }

  Widget _welcome(String Function(String) t) {
    final session = context.watch<AuthSession>();
    return KeyedSubtree(
      key: const ValueKey('welcome'),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerRight,
              child: _LanguagePills(),
            ),
            const Spacer(flex: 2),
            const GlassLogoMark(),
            const SizedBox(height: 16),
            const CreatorzWordmark(),
            const SizedBox(height: 28),
            WelcomeTagline(lines: [t('tagline1'), t('tagline2'), t('tagline3')]),
            const Spacer(flex: 3),
            if (error != null) ...[
              Text(error!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white)),
              const SizedBox(height: 12),
            ],
            if (session.canUnlockWithBiometrics) ...[
              PillButton(
                label: '${t('signInBiometric')} ${session.biometricLabel}',
                onPressed: loading ? null : _unlock,
                busy: loading,
              ),
              const SizedBox(height: 12),
            ],
            PillButton(
              label: t('signInEmail'),
              filled: !session.canUnlockWithBiometrics,
              onPressed: () => setState(() {
                emailStep = true;
                error = null;
              }),
            ),
            const SizedBox(height: 12),
            PillButton(
              label: t('signup'),
              filled: false,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const RegisterScreen()),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              t('legalFooter'),
              textAlign: TextAlign.center,
              style: GoogleFonts.nunito(
                color: Colors.white.withValues(alpha: 0.88),
                fontSize: 12,
                height: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _form(String Function(String) t) {
    final fieldStyle = InputDecoration(
      filled: true,
      fillColor: const Color(0xFFF4F4F5),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    );

    return KeyedSubtree(
      key: const ValueKey('form'),
      child: Column(
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              onPressed: loading ? null : () => setState(() => emailStep = false),
              icon: const Icon(Icons.chevron_left, color: Colors.white, size: 32),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                const CreatorzWordmark(),
                const SizedBox(height: 28),
                Container(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(32),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: email,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.email],
                        decoration: fieldStyle.copyWith(labelText: t('email')),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration: fieldStyle.copyWith(labelText: t('password')),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 12),
                        Text(error!, style: const TextStyle(color: Color(0xFFB91C1C))),
                      ],
                      const SizedBox(height: 20),
                      SizedBox(
                        height: 56,
                        child: FilledButton(
                          onPressed: loading ? null : _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.ink,
                            shape: const StadiumBorder(),
                          ),
                          child: loading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
                                )
                              : Text(
                                  t('login'),
                                  style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16),
                                ),
                        ),
                      ),
                      TextButton(onPressed: loading ? null : _forgot, child: Text(t('forgot'))),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LanguagePills extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final current = AppStrings.normalize(session.locale);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final code in AppStrings.supported)
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: TextButton(
              onPressed: () => session.setLocale(code),
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
                backgroundColor: current == code ? Colors.white.withValues(alpha: 0.28) : Colors.transparent,
                minimumSize: const Size(44, 36),
                shape: const StadiumBorder(),
              ),
              child: Text(
                code == 'pt-BR' ? 'PT' : code.toUpperCase(),
                style: GoogleFonts.nunito(fontWeight: FontWeight.w800),
              ),
            ),
          ),
      ],
    );
  }
}
