import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../app.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';
import 'contract_screen.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  final bio = TextEditingController();
  final pix = TextEditingController();
  bool loading = true;
  String? error;
  Map<String, dynamic>? creator;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    bio.dispose();
    pix.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final session = context.read<AuthSession>();
    final id = session.user?.creator?.id;
    if (id == null) {
      return;
    }
    try {
      final json = await session.api.getJson('/creators/$id');
      final data = json['data'] as Map<String, dynamic>;
      creator = data;
      bio.text = data['bio'] as String? ?? '';
      pix.text = data['pix_key'] as String? ?? '';
    } on ApiException catch (e) {
      error = e.message;
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _save() async {
    final session = context.read<AuthSession>();
    final id = session.user?.creator?.id;
    if (id == null) {
      return;
    }
    try {
      await session.api.patchJson('/creators/$id', {
        'bio': bio.text,
        'pix_key': pix.text.trim(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(session.strings.t('save'))));
      }
    } on ApiException catch (e) {
      setState(() => error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final t = session.strings.t;
    final name = session.user?.creator?.artisticName ?? session.user?.name ?? '';
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : PinnedHeroBody(
              hero: PageHero(title: t('account'), subtitle: name),
              children: [
                SoftCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const LanguageSwitcher(),
                        const SizedBox(height: 16),
                        Text(t('mediaKit'), style: GoogleFonts.nunito(fontWeight: FontWeight.w800, fontSize: 16)),
                        const SizedBox(height: 8),
                        TextField(controller: bio, maxLines: 4, decoration: softField(t('bio'))),
                        const SizedBox(height: 12),
                        TextField(controller: pix, decoration: softField(t('pix'))),
                        if (error != null) ...[
                          const SizedBox(height: 8),
                          Text(error!, style: const TextStyle(color: Color(0xFFB91C1C))),
                        ],
                        const SizedBox(height: 16),
                        DarkPillButton(label: t('save'), onPressed: _save),
                        if (session.biometricAvailable)
                          SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(t('enableBiometric')),
                            subtitle: Text(session.biometricLabel),
                            value: session.biometricEnabled,
                            onChanged: (value) async {
                              if (value) {
                                await session.enableBiometrics();
                              } else {
                                await session.disableBiometrics();
                              }
                            },
                          ),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(t('contract'), style: GoogleFonts.nunito(fontWeight: FontWeight.w700)),
                          trailing: const Icon(Icons.chevron_right_rounded),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const ContractScreen()),
                          ),
                        ),
                        TextButton(onPressed: session.logout, child: Text(t('logout'))),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
