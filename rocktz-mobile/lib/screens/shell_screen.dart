import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../session/auth_session.dart';
import '../widgets/app_ui.dart';
import 'account_screen.dart';
import 'home_screen.dart';
import 'notifications_screen.dart';
import 'opportunities_screen.dart';
import 'work_screen.dart';

class ShellScreen extends StatefulWidget {
  const ShellScreen({super.key});

  @override
  State<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends State<ShellScreen> {
  int index = 0;
  int unread = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _offerBiometrics());
    _refreshNav();
  }

  Future<void> _offerBiometrics() async {
    final session = context.read<AuthSession>();
    if (!session.offerBiometric || !mounted) {
      return;
    }
    final t = session.strings.t;
    final enable = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(t('enableBiometric')),
        content: Text(t('enableBiometricBody')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(t('later'))),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(session.biometricLabel)),
        ],
      ),
    );
    if (!mounted) {
      return;
    }
    if (enable == true) {
      await session.enableBiometrics();
    } else {
      session.dismissBiometricOffer();
    }
  }

  Future<void> _refreshNav() async {
    try {
      final json = await context.read<AuthSession>().api.getJson('/nav');
      if (mounted) setState(() => unread = json['unread'] as int? ?? 0);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final t = context.watch<AuthSession>().strings.t;
    final pages = [
      HomeScreen(
        onOpenContract: () => setState(() => index = 4),
        onOpenTab: (value) => setState(() => index = value),
      ),
      const OpportunitiesScreen(),
      const WorkScreen(),
      NotificationsScreen(onChanged: _refreshNav),
      const AccountScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: CreatorNavBar(
        index: index,
        unread: unread,
        labels: [t('home'), t('opportunities'), t('work'), t('alerts'), t('account')],
        onSelect: (value) {
          setState(() => index = value);
          if (value == 3) {
            _refreshNav();
          }
        },
      ),
    );
  }
}
