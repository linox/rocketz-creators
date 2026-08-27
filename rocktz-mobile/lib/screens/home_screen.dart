import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_exception.dart';
import '../session/auth_session.dart';
import 'contract_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.onOpenContract});

  final VoidCallback? onOpenContract;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? stats;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final json = await context.read<AuthSession>().api.getJson('/dashboard');
      setState(() => stats = json);
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<AuthSession>();
    final t = session.strings.t;
    final creator = session.user?.creator;
    return Scaffold(
      appBar: AppBar(title: Text(t('home'))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(creator?.artisticName ?? session.user?.name ?? '',
                style: Theme.of(context).textTheme.headlineSmall),
            if (creator != null) Text('${t('status')}: ${creator.status}'),
            if (creator != null && !creator.contractAccepted)
              Card(
                child: ListTile(
                  title: Text(t('contract')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ContractScreen()),
                  ),
                ),
              ),
            if (loading) const Center(child: CircularProgressIndicator()),
            if (error != null) Text(error!),
            if (stats != null) ...[
              _kpi(t('campaigns'), '${stats!['campaigns'] ?? 0}'),
              _kpi(t('approved'), '${stats!['approved_campaigns'] ?? 0}'),
              _kpi(t('pending'), '${stats!['pending_applications'] ?? 0}'),
            ],
          ],
        ),
      ),
    );
  }

  Widget _kpi(String label, String value) {
    return Card(
      child: ListTile(title: Text(label), trailing: Text(value, style: Theme.of(context).textTheme.titleLarge)),
    );
  }
}
