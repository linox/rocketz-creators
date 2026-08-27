import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../app.dart';
import '../session/auth_session.dart';
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
    return Scaffold(
      appBar: AppBar(title: Text(t('account'))),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const LanguageSwitcher(),
                const SizedBox(height: 16),
                Text(t('mediaKit'), style: Theme.of(context).textTheme.titleMedium),
                TextField(controller: bio, maxLines: 4, decoration: InputDecoration(labelText: t('bio'))),
                TextField(controller: pix, decoration: InputDecoration(labelText: t('pix'))),
                if (error != null) Text(error!, style: const TextStyle(color: Colors.red)),
                FilledButton(onPressed: _save, child: Text(t('save'))),
                ListTile(
                  title: Text(t('contract')),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ContractScreen()),
                  ),
                ),
                TextButton(onPressed: session.logout, child: Text(t('logout'))),
              ],
            ),
    );
  }
}
