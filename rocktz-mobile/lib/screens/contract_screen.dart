import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import '../theme/app_colors.dart';
import '../widgets/app_ui.dart';

class ContractScreen extends StatefulWidget {
  const ContractScreen({super.key});

  @override
  State<ContractScreen> createState() => _ContractScreenState();
}

class _ContractScreenState extends State<ContractScreen> {
  final name = TextEditingController();
  final document = TextEditingController();
  final email = TextEditingController();
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthSession>().user;
    name.text = user?.creator?.fullName ?? user?.name ?? '';
    email.text = user?.email ?? '';
  }

  @override
  void dispose() {
    name.dispose();
    document.dispose();
    email.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    final session = context.read<AuthSession>();
    final id = session.user?.creator?.id;
    if (id == null) {
      return;
    }
    setState(() => loading = true);
    try {
      await session.api.postJson('/creators/$id/contract', {
        'full_name': name.text.trim(),
        'document': document.text.trim(),
        'email': email.text.trim(),
      });
      await session.refreshMe();
      if (mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: PinnedHeroBody(
        hero: PageHero(showBack: true, title: t('contract')),
        children: [
          SoftCard(
            child: Column(
              children: [
                TextField(controller: name, decoration: softField(t('fullName'))),
                const SizedBox(height: 12),
                TextField(controller: document, decoration: softField(t('document'))),
                const SizedBox(height: 12),
                TextField(controller: email, decoration: softField(t('email'))),
                if (error != null) ...[
                  const SizedBox(height: 8),
                  Text(error!, style: const TextStyle(color: Color(0xFFB91C1C))),
                ],
                const SizedBox(height: 16),
                DarkPillButton(label: t('acceptContract'), onPressed: loading ? null : _accept, busy: loading),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
