import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../session/auth_session.dart';
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
    _refreshNav();
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
      HomeScreen(onOpenContract: () => setState(() => index = 4)),
      const OpportunitiesScreen(),
      const WorkScreen(),
      NotificationsScreen(onChanged: _refreshNav),
      const AccountScreen(),
    ];
    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) {
          setState(() => index = value);
          if (value == 3) _refreshNav();
        },
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), label: t('home')),
          NavigationDestination(icon: const Icon(Icons.auto_awesome_outlined), label: t('opportunities')),
          NavigationDestination(icon: const Icon(Icons.work_outline), label: t('work')),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            label: t('alerts'),
          ),
          NavigationDestination(icon: const Icon(Icons.person_outline), label: t('account')),
        ],
      ),
    );
  }
}
